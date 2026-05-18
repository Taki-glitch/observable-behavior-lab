# Observable Behavior Lab

Prototype V3 de tableau de bord d'analyse comportementale en temps réel avec webcam, OpenCV, MediaPipe et interface web responsive.

## Objectif du prototype

Le projet devient une interface de laboratoire, pas une simple fenêtre webcam :

- flux vidéo live dans un dashboard web ;
- mode **caméra navigateur** pour téléphone, tablette et ordinateur ;
- mode **caméra serveur** pour utiliser les détecteurs Python MediaPipe ;
- pipeline séparé entre détection, mesures, observations prudentes et rapport explicable ;
- cartes de métriques temps réel avec jauges animées ;
- smoothing temporel pour réduire le bruit frame-to-frame ;
- calibration de baseline pour adapter les scores à la personne, la distance caméra et le cadrage ;
- normalisation bornée de tous les scores sur une échelle 0 → 100 ;
- sessions d'analyse avec Start, Stop et Export Report ;
- stockage des scores, timestamps, métriques et observations pendant une session ;
- timeline graphique sur environ 30 secondes ;
- heatmap de mouvement, trace tête/regard et visualisation d'ouverture posturale ;
- journal d'observations horodatées ;
- résumé automatique de session ;
- indicateur de confiance basé sur la visibilité ou la qualité du signal.

Le projet décrit uniquement des signaux observables. Il ne produit pas d'interprétation psychologique.

## Pipeline d'analyse

Le code est volontairement découpé en quatre couches :

1. **Détection** (`detectors/`) : MediaPipe détecte les landmarks corps et visage.
2. **Mesures** (`metrics/`) : les landmarks sont transformés en scores numériques normalisés, calibrés et lissés.
3. **Observations** (`observations/`) : un moteur descriptif transforme les scores en messages prudents comme `High upper-body movement observed.`.
4. **Rapport** (`reports/`) : le résumé textuel explique les scores et observations sans inférer d'émotions.

Les hypothèses prudentes existent uniquement comme aide optionnelle basse confiance. Elles ne sont pas activées dans le résumé par défaut.

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
│   ├── calibration.py
│   ├── normalization.py
│   ├── smoothing.py
│   ├── posture.py
│   ├── movement.py
│   └── gaze.py
├── observations/
│   └── engine.py
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

## Calibration et smoothing

- Le bouton **Calibrate Baseline** remet à zéro les baselines de mouvement, posture et tête/regard.
- Les métriques serveur utilisent un lissage exponentiel : `smoothed = 0.8 * previous + 0.2 * current`.
- Les métriques navigateur utilisent le même principe côté JavaScript.
- Les scores sont toujours bornés entre `0` et `100` pour rester comparables et interprétables.

## Sessions d'analyse

- **Start Session** remet à zéro les samples et commence l'enregistrement des métriques.
- **Stop Session** fige la session et génère un résumé descriptif.
- **Export Report** télécharge un fichier JSON contenant :
  - timestamps ;
  - scores ;
  - observations ;
  - résumé ;
  - captures PNG de la timeline, de la heatmap, de la trace tête/regard et de la vue posture.

## Métriques V3

- **Movement activity** : variation moyenne des pixels ou landmarks entre deux frames, calibrée sur un bruit de baseline puis lissée.
- **Posture openness** : distance normalisée entre les épaules côté serveur, ou proxy visuel d'ouverture en mode navigateur.
- **Head stability** : stabilité approximative de la pointe du nez côté serveur, ou stabilité de la trajectoire de mouvement en mode navigateur.
- **Confidence** : signal technique indiquant si les landmarks ou le signal vidéo sont exploitables.

Ces métriques sont des indicateurs techniques de prototype. Elles devront être calibrées avant tout usage sérieux.

## API locale

Le dashboard consomme plusieurs routes locales :

- `GET /video_feed` : flux MJPEG de la webcam annotée côté serveur ;
- `GET /api/metrics` : métriques courantes, historique, calibration, observations et état de session ;
- `GET /api/summary` : résumé descriptif courant ;
- `POST /api/session/start` : démarre une session côté serveur ;
- `POST /api/session/stop` : arrête la session côté serveur ;
- `GET /api/session/export` : export JSON de la session côté serveur ;
- `POST /api/calibration/reset` : remet à zéro la calibration côté serveur.
