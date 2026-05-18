# Observable Behavior Lab

Prototype V0 d'observation comportementale en temps réel avec webcam, OpenCV et MediaPipe.

## Objectif du prototype

Le prototype reste volontairement simple :

- lecture webcam ;
- détection du corps ;
- détection du visage ;
- affichage du squelette et des contours du visage ;
- FPS affiché en temps réel ;
- scores simples à l'écran : ouverture posturale, activité motrice et stabilité de la tête ;
- résumé descriptif de session à la fermeture.

Le projet décrit uniquement des signaux observables. Il ne produit pas d'interprétation psychologique.

## Structure

```text
behavior-project/
├── main.py
├── requirements.txt
├── README.md
├── detectors/
│   ├── pose_detector.py
│   └── face_detector.py
├── metrics/
│   ├── posture.py
│   ├── movement.py
│   └── gaze.py
├── reports/
│   └── generator.py
├── utils/
│   └── drawing.py
└── data/
```

## Installation

### Windows

```bash
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

### Linux / macOS

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Lancement

```bash
python main.py
```

Appuyer sur `q` pour quitter la fenêtre webcam. Un résumé descriptif est affiché dans le terminal en fin de session.

## Métriques V0

- **Movement activity** : variation moyenne des landmarks du corps entre deux frames, lissée sur quelques images.
- **Posture openness** : distance normalisée entre les épaules gauche et droite.
- **Head stability** : stabilité approximative de la position de la pointe du nez détectée par Face Mesh.

Ces métriques sont des indicateurs techniques de prototype. Elles devront être calibrées avant tout usage sérieux.
