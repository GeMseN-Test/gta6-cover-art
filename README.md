![Vice City Cover Studio](https://make.fun/badge/gta6-cover-art-01/GeMseN-Test/gta6-cover-art.svg)
![rank](https://make.fun/badge/gta6-cover-art-01/GeMseN-Test/gta6-cover-art/rank.svg)
![reward](https://make.fun/badge/gta6-cover-art-01/GeMseN-Test/gta6-cover-art/reward.svg)

# Vice City Cover Studio

Turn a photo of yourself (or anyone) plus a caption into a GTA 6-style cover poster — right in your browser, fully offline. No uploads, no account, no server: your photo never leaves your machine.

Built for the [Make GTA 6 Cover Art](https://make.fun/bounty/gta6-cover-art-01) bounty on [make.fun](https://make.fun).

## What it does

- **Multi-panel cover layout** — the classic game-cover look: one big hero photo framed by smaller panels, bold outlined title text, and a sunset Vice City / neon grade.
- **Any photo works** — drag, drop, or pick a photo, then crop it, move it around, and zoom it inside each panel until it sits right.
- **Multiple panels, multiple photos** — fill the side panels with extra photos, or reuse one photo with a different crop in each.
- **Caption editor** — type your own title and tagline, pick the grade (Sunset, Neon Nights, or Vice Pink), and watch the cover update live.
- **One-click PNG export** — download the finished cover in the common post sizes: 1080×1080 (square), 1080×1350 (portrait), or 1920×1080 (wide).

## How to run (offline)

You only need Node.js 22. No install step, no network needed after this repo is on your disk.

```bash
# from the repo root
node serve.ts
```

Then open <http://localhost:8080> in any desktop browser. Pick a photo, tweak the panels and caption, hit **Export PNG**.

Everything runs from the static files in this repo. Photos are read with the browser's local file picker and drawn straight onto a canvas — nothing is uploaded anywhere.

## How it works

- `app/` — the whole studio: the cover renderer, the editor UI, and the sample photos used for the demo shots.
- `main.ts` — build entry point: copies `app/` and `screenshots/` into the output folder and writes the submission dossier.
- `serve.ts` — tiny static server for local use (also serves the `?shot=` demo scenes used for the screenshots below).
- `shots.json` — the three demo scenes captured for the screenshots.
- `screenshots/` — the captured demo shots.

## Screenshots

| Shot | What it shows |
| --- | --- |
| `1-cover.jpg` | The finished cover art — multi-panel, bold caption, sunset grade |
| `2-editor.jpg` | The editor with a sample photo loaded and the controls |
| `3-cover.jpg` | A second cover variant — neon grade, different layout |

## Notes

- This is a fan-made cover maker. It is **not affiliated with, endorsed by, or connected to Rockstar Games**, and it uses no Rockstar logos, artwork, or fonts.
- Your photos stay on your device. The app works with the network cable unplugged.

---

Made with make.fun — referral code `5c2wyg2x`.
