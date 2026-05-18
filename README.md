# Observable Behavior Lab

Prototype V1 de tableau de bord d'analyse comportementale en temps réel avec webcam, OpenCV, MediaPipe et une interface web HTML/CSS/JS.

## Objectif du prototype

Le projet devient une interface de laboratoire, pas une simple fenêtre webcam :

- flux vidéo live servi dans un dashboard web ;
- détection du corps et du visage avec MediaPipe ;
- affichage du squelette et des contours FaceMesh sur la vidéo ;
- cartes de métriques temps réel avec jauges animées ;
- timeline graphique sur environ 30 secondes ;
- journal d'observations horodatées ;
- résumé automatique de session ;
- indicateur de confiance basé sur la visibilité des landmarks.

Le projet décrit uniquement des signaux observables. Il ne produit pas d'interprétation psychologique.

## Structure

```text
behavior-project/
├── main.py
├── server.py
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
├── web/
│   ├── index.html
│   ├── styles.css
│   └── app.js
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

## Lancement du dashboard

```bash
python main.py
```

Ouvrir ensuite :

```text
http://127.0.0.1:8000
```

La page affiche le flux webcam annoté, les scores, la timeline et le journal d'observations. Arrêter le serveur avec `Ctrl+C`.

## Métriques V1

- **Movement activity** : variation moyenne des landmarks du corps entre deux frames, lissée sur quelques images.
- **Posture openness** : distance normalisée entre les épaules gauche et droite.
- **Head stability** : stabilité approximative de la position de la pointe du nez détectée par Face Mesh.
- **Confidence** : signal technique indiquant si les landmarks corps et visage sont visibles.

Ces métriques sont des indicateurs techniques de prototype. Elles devront être calibrées avant tout usage sérieux.

## API locale

Le dashboard consomme deux routes locales :

- `GET /video_feed` : flux MJPEG de la webcam annotée ;
- `GET /api/metrics` : métriques courantes, historique, observations et résumé de session.
