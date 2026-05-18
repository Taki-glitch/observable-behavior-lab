"""Face landmark detection wrapper built on top of MediaPipe Face Mesh."""

import cv2
import mediapipe as mp


class FaceDetector:
    """Process webcam frames and draw compact face landmarks."""

    def __init__(self, min_detection_confidence=0.5, min_tracking_confidence=0.5):
        self.mp_face_mesh = mp.solutions.face_mesh
        self.face_mesh = self.mp_face_mesh.FaceMesh(
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=min_detection_confidence,
            min_tracking_confidence=min_tracking_confidence,
        )
        self.drawer = mp.solutions.drawing_utils
        self.styles = mp.solutions.drawing_styles

    def process(self, frame):
        """Return MediaPipe face mesh results for a BGR frame."""
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        rgb.flags.writeable = False
        results = self.face_mesh.process(rgb)
        rgb.flags.writeable = True
        return results

    def draw(self, frame, results):
        """Draw face mesh contours when a face is visible."""
        if not results.multi_face_landmarks:
            return frame

        for face_landmarks in results.multi_face_landmarks:
            self.drawer.draw_landmarks(
                image=frame,
                landmark_list=face_landmarks,
                connections=self.mp_face_mesh.FACEMESH_CONTOURS,
                landmark_drawing_spec=None,
                connection_drawing_spec=self.styles.get_default_face_mesh_contours_style(),
            )
        return frame

    def close(self):
        """Release MediaPipe resources."""
        self.face_mesh.close()
