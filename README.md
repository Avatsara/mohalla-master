# Mohalla Master · मोहल्ला मास्टर

> A location-based challenge game that tests how well you know the real landmarks in your neighbourhood.

## What it does

Mohalla Master uses your device's GPS to fetch real Points of Interest from OpenStreetMap within 1 km of where you are standing. Each round names a real place — a chai stall, temple, school, or market — and challenges you to drop a pin on the map where you think it is, before a 30-second timer runs out. You score points based on how close you are.

**Five rounds. Up to 5,000 points. All in your own streets.**

---

## Project Structure

```
mohalla-master/
├── index.html          ← Single-page app (all 4 screens)
├── css/
│   └── style.css       ← All styles
├── js/
│   ├── overpass.js     ← OSM/Overpass API integration
│   ├── scoring.js      ← Haversine distance + points logic
│   └── app.js          ← Main game controller
├── vercel.json         ← Vercel deployment config
├── netlify.toml        ← Netlify deployment config
└── README.md
```

---

## Local Development

No build step. No npm. Just open in a browser:

```bash
# Option 1 — Python (any OS)
python3 -m http.server 3000
# then open http://localhost:3000

# Option 2 — Node.js
npx serve .
# then open the URL shown

# Option 3 — VS Code
# Install "Live Server" extension → right-click index.html → Open with Live Server
```

> **Important:** Geolocation requires a **secure origin** (HTTPS or localhost).  
> Opening `index.html` directly as a `file://` URL will not work.

---

## Deploy in 2 minutes

### Vercel (recommended)
1. Push this folder to a GitHub repo.
2. Go to [vercel.com](https://vercel.com) → New Project → import your repo.
3. Framework preset: **Other**. Leave all defaults. Click Deploy.
4. Share the generated `*.vercel.app` URL.

### Netlify
1. Push to GitHub.
2. Go to [netlify.com](https://netlify.com) → Add new site → Import from Git.
3. Build command: *(leave empty)*. Publish directory: `.`
4. Click Deploy.

### GitHub Pages
1. Push to GitHub.
2. Settings → Pages → Branch: `main` / Root `/`.
3. Your site will be at `https://<username>.github.io/<repo>/`.

---

## Tech Stack

| Layer        | Technology                                    |
|-------------|-----------------------------------------------|
| Maps         | [Leaflet.js 1.9](https://leafletjs.com/)      |
| Tiles        | CartoDB Dark (free, no API key needed)         |
| POI Data     | [Overpass API](https://overpass-api.de/) (OSM) |
| Geolocation  | Browser `navigator.geolocation` API            |
| Screenshots  | `navigator.mediaDevices.getDisplayMedia()`     |
| Hosting      | Vercel / Netlify / GitHub Pages (static)       |
| Build tools  | **None** — pure HTML/CSS/JS                    |

---

## Privacy

- Location data is used **only in-browser** to query the Overpass API.
- No coordinates are ever sent to any Anthropic or project server.
- No accounts, cookies, or analytics are used.
- Overpass API receives only approximate bounding-box queries (no user identity).

---

## Scoring Formula

```
base_score  = round(1000 × e^(−distance_metres / 200))
time_bonus  = round(200 × time_left / 30)
round_score = base_score + time_bonus
```

| Distance  | Base score |
|-----------|-----------|
| 0 m       | 1 000     |
| 25 m      | 882       |
| 75 m      | 686       |
| 150 m     | 472       |
| 300 m     | 223       |
| 600 m     | 50        |

Max per round: **1 200 pts** (bull's-eye + full time bonus).  
Max total (5 rounds): **6 000 pts**.

---

## Capstone Info

**Mohalla Master** — B.Tech Computer Science & Engineering Capstone  
Academic Year 2025–26

**References**
- MDN: [Geolocation API](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API)
- MDN: [MediaDevices API](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices)
- [Leaflet.js Documentation](https://leafletjs.com/reference.html)
- [Overpass API Guide](https://wiki.openstreetmap.org/wiki/Overpass_API)
- [OpenStreetMap contributors](https://openstreetmap.org/copyright)
