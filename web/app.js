const metricDefinitions = [
  { key: "movement", label: "Movement Activity", color: "var(--movement)" },
  { key: "posture", label: "Posture Openness", color: "var(--posture)" },
  { key: "head", label: "Head Stability", color: "var(--head)" },
  { key: "confidence", label: "Confidence", color: "var(--confidence)" },
];

const metricCards = document.querySelector("#metricCards");
const eventLog = document.querySelector("#eventLog");
const sessionSummary = document.querySelector("#sessionSummary");
const sessionDuration = document.querySelector("#sessionDuration");
const fpsBadge = document.querySelector("#fpsBadge");
const timelineCanvas = document.querySelector("#timelineCanvas");
const timelineContext = timelineCanvas.getContext("2d");
const cards = new Map();

function buildMetricCards() {
  metricDefinitions.forEach((definition) => {
    const card = document.createElement("article");
    card.className = "metric-card";
    card.style.setProperty("--accent", definition.color);
    card.innerHTML = `
      <div class="metric-topline">
        <span class="metric-label">${definition.label}</span>
        <span class="metric-value">0 / 100</span>
      </div>
      <div class="gauge-track"><div class="gauge-fill"></div></div>
    `;
    metricCards.append(card);
    cards.set(definition.key, {
      value: card.querySelector(".metric-value"),
      fill: card.querySelector(".gauge-fill"),
    });
  });
}

function updateMetrics(metrics) {
  metricDefinitions.forEach((definition) => {
    const score = clamp(metrics[definition.key] ?? 0, 0, 100);
    const card = cards.get(definition.key);
    card.value.textContent = `${Math.round(score)} / 100`;
    card.fill.style.width = `${score}%`;
  });
  fpsBadge.textContent = `FPS ${Math.round(metrics.fps ?? 0)}`;
}

function updateEvents(events) {
  if (!events.length) {
    eventLog.className = "event-log empty";
    eventLog.textContent = "En attente des premiers signaux observables...";
    return;
  }

  eventLog.className = "event-log";
  eventLog.innerHTML = events
    .map(
      (event) => `
        <div class="event-item ${event.type}">
          <span class="event-time">${event.time}</span>
          <strong>${event.message}</strong>
        </div>
      `,
    )
    .join("");
}

function drawTimeline(history) {
  const ratio = window.devicePixelRatio || 1;
  const width = timelineCanvas.clientWidth;
  const height = timelineCanvas.height;
  timelineCanvas.width = width * ratio;
  timelineCanvas.height = height * ratio;
  timelineContext.setTransform(ratio, 0, 0, ratio, 0, 0);
  timelineContext.clearRect(0, 0, width, height);

  const padding = { top: 16, right: 24, bottom: 28, left: 38 };
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;

  drawGrid(width, height, padding, graphWidth, graphHeight);
  if (history.length < 2) {
    drawEmptyTimeline(width, height);
    return;
  }

  drawSeries(history, "movement", "#6ee7b7", padding, graphWidth, graphHeight);
  drawSeries(history, "posture", "#60a5fa", padding, graphWidth, graphHeight);
  drawSeries(history, "head", "#c084fc", padding, graphWidth, graphHeight);
}

function drawGrid(width, height, padding, graphWidth, graphHeight) {
  timelineContext.strokeStyle = "rgba(145, 180, 255, 0.14)";
  timelineContext.lineWidth = 1;
  timelineContext.font = "12px Inter, sans-serif";
  timelineContext.fillStyle = "rgba(219, 234, 254, 0.62)";

  for (let index = 0; index <= 4; index += 1) {
    const y = padding.top + (graphHeight / 4) * index;
    timelineContext.beginPath();
    timelineContext.moveTo(padding.left, y);
    timelineContext.lineTo(width - padding.right, y);
    timelineContext.stroke();
    timelineContext.fillText(`${100 - index * 25}`, 6, y + 4);
  }
}

function drawSeries(history, key, color, padding, graphWidth, graphHeight) {
  const maxIndex = Math.max(history.length - 1, 1);
  timelineContext.beginPath();
  timelineContext.strokeStyle = color;
  timelineContext.lineWidth = 3;
  history.forEach((point, index) => {
    const x = padding.left + (index / maxIndex) * graphWidth;
    const y = padding.top + graphHeight - (clamp(point[key], 0, 100) / 100) * graphHeight;
    if (index === 0) {
      timelineContext.moveTo(x, y);
    } else {
      timelineContext.lineTo(x, y);
    }
  });
  timelineContext.stroke();
}

function drawEmptyTimeline(width, height) {
  timelineContext.fillStyle = "rgba(219, 234, 254, 0.58)";
  timelineContext.font = "15px Inter, sans-serif";
  timelineContext.fillText("Collecte des premiers points de timeline...", width / 2 - 150, height / 2);
}

async function refreshDashboard() {
  const response = await fetch("/api/metrics", { cache: "no-store" });
  const data = await response.json();
  updateMetrics(data.metrics);
  updateEvents(data.events);
  drawTimeline(data.history);
  sessionSummary.textContent = data.summary;
  sessionDuration.textContent = `Session ${data.duration.toFixed(1)}s`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

buildMetricCards();
refreshDashboard();
setInterval(refreshDashboard, 600);
window.addEventListener("resize", refreshDashboard);
