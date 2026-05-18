# Observable Behavior Lab

Prototype V2 de tableau de bord d'analyse comportementale en temps réel avec webcam, OpenCV, MediaPipe et interface web responsive.

## Objectif du prototype

Le projet devient une interface de laboratoire, pas une simple fenêtre webcam :

- flux vidéo live dans un dashboard web ;
- mode **caméra navigateur** pour téléphone, tablette et ordinateur ;
- mode **caméra serveur** pour utiliser les détecteurs Python MediaPipe ;
- détection du corps et du visage avec MediaPipe côté serveur ;
- cartes de métriques temps réel avec jauges animées ;
- sessions d'analyse avec Start, Stop et Export Report ;
- stockage des scores, timestamps, métriques et observations pendant une session ;
- timeline graphique sur environ 30 secondes ;
- heatmap de mouvement, trace tête/regard et visualisation d'ouverture posturale ;
- journal d'observations horodatées ;
- résumé automatique de session ;
- indicateur de confiance basé sur la visibilité ou la qualité du signal.

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

## Installation locale

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

## Lancement du dashboard local

```bash
python main.py
```

Ouvrir ensuite :

```text
http://127.0.0.1:8000
```

La page affiche le flux webcam, les scores, les sessions, la timeline, les visualisations et le journal d'observations. Arrêter le serveur avec `Ctrl+C`.

## Utilisation multi-plateforme

Le bouton **Use this device camera** active `getUserMedia` directement dans le navigateur. C'est le mode recommandé pour accéder au site depuis un téléphone, une tablette ou un ordinateur sans utiliser la webcam Python de la machine serveur.

Pour un accès depuis un autre appareil, héberger le dossier `web/` ou le serveur Python sur une adresse accessible du réseau. Les navigateurs exigent généralement HTTPS pour autoriser la caméra, sauf sur `localhost`.

## Sessions d'analyse

- **Start Session** remet à zéro les samples et commence l'enregistrement des métriques.
- **Stop Session** fige la session et génère un résumé descriptif.
- **Export Report** télécharge un fichier JSON contenant :
  - timestamps ;
  - scores ;
  - observations ;
  - résumé ;
  - captures PNG de la timeline, de la heatmap, de la trace tête/regard et de la vue posture.

## Métriques V2

- **Movement activity** : variation moyenne des pixels ou landmarks entre deux frames, lissée sur quelques images.
- **Posture openness** : distance normalisée entre les épaules côté serveur, ou proxy visuel d'ouverture en mode navigateur.
- **Head stability** : stabilité approximative de la pointe du nez côté serveur, ou stabilité de la trajectoire de mouvement en mode navigateur.
- **Confidence** : signal technique indiquant si les landmarks ou le signal vidéo sont exploitables.

Ces métriques sont des indicateurs techniques de prototype. Elles devront être calibrées avant tout usage sérieux.

## API locale

Le dashboard consomme plusieurs routes locales :

- `GET /video_feed` : flux MJPEG de la webcam annotée côté serveur ;
- `GET /api/metrics` : métriques courantes, historique, observations et état de session ;
- `GET /api/summary` : résumé descriptif courant ;
- `POST /api/session/start` : démarre une session côté serveur ;
- `POST /api/session/stop` : arrête la session côté serveur ;
- `GET /api/session/export` : export JSON de la session côté serveur.
