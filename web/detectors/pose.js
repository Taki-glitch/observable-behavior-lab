import { FilesetResolver, PoseLandmarker } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18";

const WASM_ROOT = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm";
const POSE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task";

export const POSE_CONNECTIONS = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
];

let sharedVision = null;

async function getVisionFileset() {
  if (!sharedVision) {
    sharedVision = await FilesetResolver.forVisionTasks(WASM_ROOT);
  }
  return sharedVision;
}

export async function createPoseDetector() {
  const vision = await getVisionFileset();
  const landmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: POSE_MODEL_URL,
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numPoses: 1,
    minPoseDetectionConfidence: 0.45,
    minPosePresenceConfidence: 0.45,
    minTrackingConfidence: 0.45,
  });

  return {
    detect(video, timestampMs) {
      return landmarker.detectForVideo(video, timestampMs);
    },
    close() {
      landmarker.close();
    },
  };
}

export function drawPoseLandmarks(context, landmarks, width, height) {
  if (!landmarks?.length) return;
  context.save();
  context.lineWidth = 4;
  context.strokeStyle = "rgba(110, 231, 183, 0.95)";
  POSE_CONNECTIONS.forEach(([start, end]) => {
    const a = landmarks[start];
    const b = landmarks[end];
    if (!a || !b) return;
    context.beginPath();
    context.moveTo(a.x * width, a.y * height);
    context.lineTo(b.x * width, b.y * height);
    context.stroke();
  });

  context.fillStyle = "rgba(219, 234, 254, 0.95)";
  landmarks.forEach((landmark) => {
    context.beginPath();
    context.arc(landmark.x * width, landmark.y * height, 3, 0, Math.PI * 2);
    context.fill();
  });
  context.restore();
}
