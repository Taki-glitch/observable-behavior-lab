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
const sessionStatusPill = document.querySelector("#sessionStatusPill");
const fpsBadge = document.querySelector("#fpsBadge");
const timelineCanvas = document.querySelector("#timelineCanvas");
const timelineContext = timelineCanvas.getContext("2d");
const heatmapCanvas = document.querySelector("#heatmapCanvas");
const heatmapContext = heatmapCanvas.getContext("2d");
const headTraceCanvas = document.querySelector("#headTraceCanvas");
const headTraceContext = headTraceCanvas.getContext("2d");
const postureCanvas = document.querySelector("#postureCanvas");
const postureContext = postureCanvas.getContext("2d");
const deviceVideo = document.querySelector("#deviceVideo");
const deviceCanvas = document.querySelector("#deviceCanvas");
const deviceContext = deviceCanvas.getContext("2d", { willReadFrequently: true });
const serverFeed = document.querySelector("#videoFeed");
const sourceBadge = document.querySelector("#sourceBadge");
const activeSource = document.querySelector("#activeSource");
const sampleCount = document.querySelector("#sampleCount");
const platformHint = document.querySelector("#platformHint");
const videoTitle = document.querySelector("#videoTitle");
const deviceModeButton = document.querySelector("#deviceModeButton");
const serverModeButton = document.querySelector("#serverModeButton");
const startSessionButton = document.querySelector("#startSessionButton");
const stopSessionButton = document.querySelector("#stopSessionButton");
const exportReportButton = document.querySelector("#exportReportButton");

const cards = new Map();
const offscreenCanvas = document.createElement("canvas");
const offscreenContext = offscreenCanvas.getContext("2d", { willReadFrequently: true });
const heatmapColumns = 24;
const heatmapRows = 14;
const heatmapGrid = Array.from({ length: heatmapColumns * heatmapRows }, () => 0);
const headTrace = [];
const runtimeHistory = [];
const runtimeEvents = [];
const lastEventTimes = new Map();

let mode = "device";
let mediaStream = null;
let previousGrayFrame = null;
let animationFrame = null;
let previousFrameTime = performance.now();
let currentMetrics = { movement: 0, posture: 0, head: 0, confidence: 0, fps: 0 };
let activePosture = { centerX: 0.5, centerY: 0.42, spread: 0.35 };
let session = createEmptySession();

function createEmptySession() {
  return {
    active: false,
    startedAt: null,
    stoppedAt: null,
    samples: [],
    events: [],
    source: mode,
    summary: "Démarre une session pour générer un rapport exportable.",
  };
}

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

async function useDeviceCamera() {
  mode = "device";
  stopServerFeed();
  updateModeUi();
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
    });
    deviceVideo.srcObject = mediaStream;
    await deviceVideo.play();
    previousGrayFrame = null;
    previousFrameTime = performance.now();
    cancelAnimationFrame(animationFrame);
    animationFrame = requestAnimationFrame(processDeviceFrame);
    platformHint.textContent = "Caméra navigateur active : compatible téléphone, tablette et ordinateur sur HTTPS ou localhost.";
  } catch (error) {
    platformHint.textContent = `Accès caméra navigateur impossible (${error.message}). Bascule possible vers le flux serveur.`;
    useServerCamera();
  }
}

function useServerCamera() {
  mode = "server";
  stopDeviceCamera();
  serverFeed.src = `/video_feed?cache=${Date.now()}`;
  updateModeUi();
  refreshServerDashboard();
}

function stopDeviceCamera() {
  cancelAnimationFrame(animationFrame);
  animationFrame = null;
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  }
}

function stopServerFeed() {
  serverFeed.removeAttribute("src");
}

function updateModeUi() {
  const isDevice = mode === "device";
  serverFeed.classList.toggle("hidden", isDevice);
  deviceCanvas.classList.toggle("hidden", !isDevice);
  sourceBadge.textContent = isDevice ? "DEVICE" : "SERVER";
  activeSource.textContent = `Source: ${isDevice ? "device browser" : "server MediaPipe"}`;
  videoTitle.textContent = isDevice ? "Device camera + visual overlays" : "Server skeleton + FaceMesh overlay";
  deviceModeButton.classList.toggle("primary", isDevice);
  serverModeButton.classList.toggle("primary", !isDevice);
}

function processDeviceFrame(now) {
  if (mode !== "device" || !deviceVideo.videoWidth) {
    animationFrame = requestAnimationFrame(processDeviceFrame);
    return;
  }

  const displayWidth = deviceCanvas.clientWidth;
  const displayHeight = deviceCanvas.clientHeight || deviceCanvas.clientWidth * 0.5625;
  resizeCanvasToElement(deviceCanvas, displayWidth, displayHeight);
  deviceContext.drawImage(deviceVideo, 0, 0, displayWidth, displayHeight);

  const elapsed = Math.max(now - previousFrameTime, 1);
  previousFrameTime = now;
  const fps = 1000 / elapsed;
  const analysis = analyzeDeviceMotion();
  currentMetrics = { ...analysis.metrics, fps };

  drawDeviceOverlays(analysis);
  pushRuntimeSample(currentMetrics);
  captureSessionSample(currentMetrics);
  updateMetrics(currentMetrics);
  updateEvents(session.active ? session.events : runtimeEvents);
  drawTimeline(session.active ? session.samples : runtimeHistory);
  drawVisualizationPanels();
  updateSessionUi();

  animationFrame = requestAnimationFrame(processDeviceFrame);
}

function analyzeDeviceMotion() {
  offscreenCanvas.width = heatmapColumns;
  offscreenCanvas.height = heatmapRows;
  offscreenContext.drawImage(deviceVideo, 0, 0, heatmapColumns, heatmapRows);
  const frame = offscreenContext.getImageData(0, 0, heatmapColumns, heatmapRows).data;
  const grayFrame = new Float32Array(heatmapColumns * heatmapRows);
  let totalDiff = 0;
  let weightedX = 0;
  let weightedY = 0;
  let activeCells = 0;
  let minX = heatmapColumns;
  let maxX = 0;

  for (let index = 0; index < grayFrame.length; index += 1) {
    const pixelIndex = index * 4;
    const gray = frame[pixelIndex] * 0.299 + frame[pixelIndex + 1] * 0.587 + frame[pixelIndex + 2] * 0.114;
    grayFrame[index] = gray;
    const diff = previousGrayFrame ? Math.abs(gray - previousGrayFrame[index]) : 0;
    const normalizedDiff = diff / 255;
    heatmapGrid[index] = Math.max(heatmapGrid[index] * 0.965, normalizedDiff);
    totalDiff += normalizedDiff;
    if (normalizedDiff > 0.045) {
      const x = index % heatmapColumns;
      const y = Math.floor(index / heatmapColumns);
      weightedX += x * normalizedDiff;
      weightedY += y * normalizedDiff;
      activeCells += normalizedDiff;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
    }
  }

  previousGrayFrame = grayFrame;
  const movement = clamp((totalDiff / grayFrame.length) * 620, 0, 100);
  const centerX = activeCells ? weightedX / activeCells / (heatmapColumns - 1) : activePosture.centerX;
  const centerY = activeCells ? weightedY / activeCells / (heatmapRows - 1) : activePosture.centerY;
  const spread = activeCells ? (maxX - minX + 1) / heatmapColumns : activePosture.spread;
  const previousHead = headTrace.at(-1) ?? { x: centerX, y: centerY };
  const jitter = Math.hypot(centerX - previousHead.x, centerY - previousHead.y);
  const head = clamp(100 - jitter * 520 - movement * 0.22, 0, 100);
  const posture = clamp((spread - 0.12) * 165, 0, 100);
  const confidence = clamp(55 + movement * 0.35 + activeCells * 4, 35, 92);

  activePosture = { centerX, centerY, spread };
  headTrace.push({ x: centerX, y: centerY, t: performance.now() });
  while (headTrace.length > 90) headTrace.shift();

  return { metrics: { movement, posture, head, confidence }, centerX, centerY, spread };
}

function drawDeviceOverlays(analysis) {
  const width = deviceCanvas.clientWidth;
  const height = deviceCanvas.clientHeight || deviceCanvas.clientWidth * 0.5625;
  drawHeatmapOverlay(deviceContext, width, height, 0.34);
  drawHeadTraceOnContext(deviceContext, width, height);
  drawPostureGuide(deviceContext, width, height, analysis);
  deviceContext.fillStyle = "rgba(8, 12, 24, 0.82)";
  deviceContext.fillRect(16, 16, 470, 44);
  deviceContext.fillStyle = "#e6f6ff";
  deviceContext.font = "700 18px Inter, sans-serif";
  deviceContext.fillText(`Browser analysis | confidence ${Math.round(currentMetrics.confidence)}/100`, 30, 44);
}

function pushRuntimeSample(metrics) {
  const sample = buildSample(metrics, performance.now());
  runtimeHistory.push(sample);
  while (runtimeHistory.length > 120) runtimeHistory.shift();
  recordObservation(metrics, runtimeEvents);
}

function captureSessionSample(metrics) {
  if (!session.active) return;
  const sample = buildSample(metrics, performance.now());
  session.samples.push(sample);
  recordObservation(metrics, session.events);
  session.summary = buildSessionSummary(session);
}

function buildSample(metrics, timestamp) {
  const startedAt = session.active ? session.startedAt : performance.timeOrigin;
  return {
    time: Number(((Date.now() - startedAt) / 1000).toFixed(1)),
    timestamp: new Date().toISOString(),
    movement: Number(metrics.movement.toFixed(1)),
    posture: Number(metrics.posture.toFixed(1)),
    head: Number(metrics.head.toFixed(1)),
    confidence: Number(metrics.confidence.toFixed(1)),
    fps: Number(metrics.fps.toFixed(1)),
    frameTime: Math.round(timestamp),
  };
}

function recordObservation(metrics, targetEvents) {
  const now = Date.now();
  const rules = [
    [metrics.movement >= 65, "movement", "Increased upper-body movement detected"],
    [metrics.head <= 45, "head", "Reduced head stability observed"],
    [metrics.posture <= 35 && metrics.confidence >= 55, "posture", "Rather closed posture proxy observed"],
    [metrics.confidence < 50, "confidence", "Partial visual signal detected"],
  ];

  rules.forEach(([condition, type, message]) => {
    if (!condition) return;
    const key = `${targetEvents === session.events ? "session" : "runtime"}-${type}`;
    if (now - (lastEventTimes.get(key) ?? 0) < 5000) return;
    lastEventTimes.set(key, now);
    targetEvents.unshift({ time: new Date().toLocaleTimeString(), type, message });
    targetEvents.splice(12);
  });
}

function startSession() {
  session = createEmptySession();
  session.active = true;
  session.startedAt = Date.now();
  session.source = mode;
  startSessionButton.disabled = true;
  stopSessionButton.disabled = false;
  exportReportButton.disabled = true;
  sessionStatusPill.classList.add("recording");
  postSessionCommand("/api/session/start");
}

function stopSession() {
  if (!session.active) return;
  session.active = false;
  session.stoppedAt = Date.now();
  session.summary = buildSessionSummary(session);
  startSessionButton.disabled = false;
  stopSessionButton.disabled = true;
  exportReportButton.disabled = session.samples.length === 0;
  sessionStatusPill.classList.remove("recording");
  sessionSummary.textContent = session.summary;
  postSessionCommand("/api/session/stop");
}

function exportReport() {
  const report = {
    generatedAt: new Date().toISOString(),
    source: session.source,
    startedAt: session.startedAt ? new Date(session.startedAt).toISOString() : null,
    stoppedAt: session.stoppedAt ? new Date(session.stoppedAt).toISOString() : null,
    durationSeconds: sessionDurationSeconds(),
    summary: session.summary,
    observations: session.events,
    samples: session.samples,
    charts: {
      timelinePng: timelineCanvas.toDataURL("image/png"),
      heatmapPng: heatmapCanvas.toDataURL("image/png"),
      headTracePng: headTraceCanvas.toDataURL("image/png"),
      posturePng: postureCanvas.toDataURL("image/png"),
    },
  };
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `behavior-session-${new Date().toISOString().replaceAll(":", "-")}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function postSessionCommand(path) {
  if (mode !== "server") return;
  try {
    await fetch(path, { method: "POST" });
  } catch (_error) {
    // Local browser sessions still work if the optional Python session endpoint is unreachable.
  }
}

function buildSessionSummary(currentSession) {
  if (!currentSession.samples.length) {
    return "Session Summary\n----------------\n\nNo samples captured yet.";
  }
  const averages = averageSamples(currentSession.samples);
  const movementLabel = describeScore(averages.movement, "Low", "Moderate", "High");
  const postureLabel = describeScore(averages.posture, "Rather closed", "Neutral", "Rather open");
  const headLabel = describeScore(averages.head, "Low", "Low to moderate", "Moderate to high");
  const duration = sessionDurationSeconds(currentSession);
  return [
    "Session Summary",
    "----------------",
    "",
    `Source: ${currentSession.source}`,
    `Duration: ${duration.toFixed(1)} seconds`,
    `Samples: ${currentSession.samples.length}`,
    "",
    `Movement Activity: ${movementLabel} (${averages.movement.toFixed(1)}/100)`,
    `Posture: ${postureLabel} (${averages.posture.toFixed(1)}/100)`,
    `Head Stability: ${headLabel} (${averages.head.toFixed(1)}/100)`,
    `Confidence: ${averages.confidence.toFixed(1)}/100`,
    "",
    "Observations:",
    ...(currentSession.events.length ? currentSession.events.map((event) => `[${event.time}] ${event.message}`) : ["No notable observation thresholds crossed."]),
    "",
    "Confidence: Low to moderate",
  ].join("\n");
}

function averageSamples(samples) {
  const totals = samples.reduce(
    (accumulator, sample) => ({
      movement: accumulator.movement + sample.movement,
      posture: accumulator.posture + sample.posture,
      head: accumulator.head + sample.head,
      confidence: accumulator.confidence + sample.confidence,
    }),
    { movement: 0, posture: 0, head: 0, confidence: 0 },
  );
  return Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, value / samples.length]));
}

function describeScore(score, lowLabel, middleLabel, highLabel) {
  if (score < 34) return lowLabel;
  if (score < 67) return middleLabel;
  return highLabel;
}

function sessionDurationSeconds(currentSession = session) {
  if (!currentSession.startedAt) return 0;
  const end = currentSession.stoppedAt ?? Date.now();
  return (end - currentSession.startedAt) / 1000;
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
  const width = timelineCanvas.clientWidth;
  const height = timelineCanvas.height;
  resizeCanvasToElement(timelineCanvas, width, height);
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
    if (index === 0) timelineContext.moveTo(x, y);
    else timelineContext.lineTo(x, y);
  });
  timelineContext.stroke();
}

function drawEmptyTimeline(width, height) {
  timelineContext.fillStyle = "rgba(219, 234, 254, 0.58)";
  timelineContext.font = "15px Inter, sans-serif";
  timelineContext.fillText("Collecte des premiers points de timeline...", width / 2 - 150, height / 2);
}

function drawVisualizationPanels() {
  drawPanelBase(heatmapCanvas, heatmapContext);
  drawHeatmapOverlay(heatmapContext, heatmapCanvas.clientWidth, heatmapCanvas.height, 0.85);
  drawPanelBase(headTraceCanvas, headTraceContext);
  drawHeadTraceOnContext(headTraceContext, headTraceCanvas.clientWidth, headTraceCanvas.height);
  drawPanelBase(postureCanvas, postureContext);
  drawPostureGuide(postureContext, postureCanvas.clientWidth, postureCanvas.height, activePosture);
}

function drawPanelBase(canvas, context) {
  const width = canvas.clientWidth;
  const height = canvas.height;
  resizeCanvasToElement(canvas, width, height);
  context.clearRect(0, 0, width, height);
  context.fillStyle = "rgba(2, 6, 23, 0.45)";
  context.fillRect(0, 0, width, height);
}

function drawHeatmapOverlay(context, width, height, alpha) {
  const cellWidth = width / heatmapColumns;
  const cellHeight = height / heatmapRows;
  heatmapGrid.forEach((value, index) => {
    const intensity = clamp(value * 5, 0, 1);
    if (intensity < 0.02) return;
    const x = (index % heatmapColumns) * cellWidth;
    const y = Math.floor(index / heatmapColumns) * cellHeight;
    context.fillStyle = `rgba(251, 113, 133, ${intensity * alpha})`;
    context.fillRect(x, y, cellWidth + 1, cellHeight + 1);
  });
}

function drawHeadTraceOnContext(context, width, height) {
  if (headTrace.length < 2) return;
  context.strokeStyle = "rgba(192, 132, 252, 0.92)";
  context.lineWidth = 3;
  context.beginPath();
  headTrace.forEach((point, index) => {
    const x = point.x * width;
    const y = point.y * height;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.stroke();
  const latest = headTrace.at(-1);
  context.fillStyle = "#fef3c7";
  context.beginPath();
  context.arc(latest.x * width, latest.y * height, 6, 0, Math.PI * 2);
  context.fill();
}

function drawPostureGuide(context, width, height, posture) {
  const centerX = posture.centerX * width;
  const centerY = posture.centerY * height;
  const halfSpread = (posture.spread * width) / 2;
  context.strokeStyle = "rgba(96, 165, 250, 0.95)";
  context.lineWidth = 5;
  context.beginPath();
  context.moveTo(centerX - halfSpread, centerY);
  context.lineTo(centerX + halfSpread, centerY);
  context.stroke();
  context.fillStyle = "rgba(96, 165, 250, 0.25)";
  context.fillRect(centerX - halfSpread, centerY - 26, halfSpread * 2, 52);
}

async function refreshServerDashboard() {
  if (mode !== "server") return;
  try {
    const response = await fetch("/api/metrics", { cache: "no-store" });
    const data = await response.json();
    currentMetrics = data.metrics;
    updateMetrics(currentMetrics);
    const history = session.active ? session.samples : data.history;
    if (session.active) captureSessionSample(currentMetrics);
    drawTimeline(history);
    updateEvents(session.active ? session.events : data.events);
    sessionSummary.textContent = session.active ? buildSessionSummary(session) : data.summary;
    drawVisualizationPanels();
    updateSessionUi();
  } catch (_error) {
    platformHint.textContent = "Flux serveur indisponible. Utilise la caméra du navigateur pour une expérience multi-plateforme.";
  }
}

function updateSessionUi() {
  const duration = session.active ? sessionDurationSeconds() : sessionDurationSeconds(session);
  sessionDuration.textContent = session.active ? `Recording ${duration.toFixed(1)}s` : session.stoppedAt ? `Stopped ${duration.toFixed(1)}s` : "Session inactive";
  sampleCount.textContent = `${session.samples.length} samples`;
  if (session.active) sessionSummary.textContent = buildSessionSummary(session);
}

function resizeCanvasToElement(canvas, width, height) {
  const ratio = window.devicePixelRatio || 1;
  const safeWidth = Math.max(1, Math.round(width));
  const safeHeight = Math.max(1, Math.round(height));
  if (canvas.width !== safeWidth * ratio || canvas.height !== safeHeight * ratio) {
    canvas.width = safeWidth * ratio;
    canvas.height = safeHeight * ratio;
  }
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

deviceModeButton.addEventListener("click", useDeviceCamera);
serverModeButton.addEventListener("click", useServerCamera);
startSessionButton.addEventListener("click", startSession);
stopSessionButton.addEventListener("click", stopSession);
exportReportButton.addEventListener("click", exportReport);
window.addEventListener("resize", () => {
  drawTimeline(session.active ? session.samples : runtimeHistory);
  drawVisualizationPanels();
});

buildMetricCards();
updateModeUi();
drawTimeline([]);
drawVisualizationPanels();
useDeviceCamera();
setInterval(refreshServerDashboard, 700);
