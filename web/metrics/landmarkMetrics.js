const LEFT_SHOULDER = 11;
const RIGHT_SHOULDER = 12;
const NOSE_TIP = 1;

function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function distance(a, b) {
  if (!a || !b) return 0;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function normalizeRange(value, minimum, maximum) {
  if (maximum <= minimum) return 0;
  return clamp(((value - minimum) / (maximum - minimum)) * 100);
}

function normalizeCentered(value, center, halfRange) {
  if (halfRange <= 0) return 50;
  return clamp(50 + ((value - center) / halfRange) * 50);
}

function smooth(previous, current, alpha = 0.2) {
  return previous === null ? current : previous * (1 - alpha) + current * alpha;
}

export function createLandmarkMetricsEngine() {
  let previousPose = null;
  let previousNose = null;
  let samples = 0;
  let movementBaseline = 0.002;
  let shoulderBaseline = 0.24;
  let headBaseline = 0.001;
  let smoothed = { movement: null, posture: null, head: null, confidence: null };

  function updateCalibration(rawMovement, shoulderWidth, headMotion) {
    samples += 1;
    const weight = 1 / Math.min(samples, 45);
    movementBaseline = movementBaseline * (1 - weight) + rawMovement * weight;
    if (shoulderWidth > 0) shoulderBaseline = shoulderBaseline * (1 - weight) + shoulderWidth * weight;
    headBaseline = headBaseline * (1 - weight) + headMotion * weight;
  }

  function compute(poseLandmarks, faceLandmarks) {
    const pose = poseLandmarks?.[0] ?? null;
    const face = faceLandmarks?.[0] ?? null;
    if (!pose) {
      smoothed.confidence = smooth(smoothed.confidence, 35);
      return { metrics: null, calibration: state() };
    }

    let rawMovement = 0;
    if (previousPose) {
      const compared = Math.min(pose.length, previousPose.length);
      for (let index = 0; index < compared; index += 1) {
        rawMovement += distance(pose[index], previousPose[index]);
      }
      rawMovement /= compared;
    }

    const shoulderWidth = distance(pose[LEFT_SHOULDER], pose[RIGHT_SHOULDER]);
    const nose = face?.[NOSE_TIP] ?? pose[0];
    const headMotion = previousNose ? distance(nose, previousNose) : 0;
    updateCalibration(rawMovement, shoulderWidth, headMotion);

    const movement = normalizeRange(rawMovement, movementBaseline, movementBaseline + 0.035);
    const posture = normalizeCentered(shoulderWidth, shoulderBaseline, Math.max(0.04, shoulderBaseline * 0.35));
    const head = 100 - normalizeRange(headMotion, headBaseline, headBaseline + 0.025);
    const confidence = clamp((pose ? 60 : 0) + (face ? 35 : 0) + (samples >= 45 ? 5 : 0));

    previousPose = pose.map((landmark) => ({ x: landmark.x, y: landmark.y }));
    previousNose = nose ? { x: nose.x, y: nose.y } : null;

    smoothed = {
      movement: smooth(smoothed.movement, movement),
      posture: smooth(smoothed.posture, posture),
      head: smooth(smoothed.head, head),
      confidence: smooth(smoothed.confidence, confidence),
    };

    return { metrics: { ...smoothed }, calibration: state() };
  }

  function reset() {
    previousPose = null;
    previousNose = null;
    samples = 0;
    movementBaseline = 0.002;
    shoulderBaseline = 0.24;
    headBaseline = 0.001;
    smoothed = { movement: null, posture: null, head: null, confidence: null };
  }

  function state() {
    return {
      ready: samples >= 45,
      samples,
      movementBaseline,
      shoulderBaseline,
      headBaseline,
    };
  }

  return { compute, reset, state };
}
