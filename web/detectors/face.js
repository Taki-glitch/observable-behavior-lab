import { FaceLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18";

const WASM_ROOT = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm";
const FACE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task";

let sharedVision = null;

async function getVisionFileset() {
  if (!sharedVision) {
    sharedVision = await FilesetResolver.forVisionTasks(WASM_ROOT);
  }
  return sharedVision;
}

export async function createFaceDetector() {
  const vision = await getVisionFileset();
  const landmarker = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: FACE_MODEL_URL,
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numFaces: 1,
    minFaceDetectionConfidence: 0.45,
    minFacePresenceConfidence: 0.45,
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

export function drawFaceLandmarks(context, landmarks, width, height) {
  if (!landmarks?.length) return;
  context.save();
  context.fillStyle = "rgba(192, 132, 252, 0.85)";
  for (let index = 0; index < landmarks.length; index += 6) {
    const landmark = landmarks[index];
    context.beginPath();
    context.arc(landmark.x * width, landmark.y * height, 1.6, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}
