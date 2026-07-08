# KOSMOS-Link

**A collaborative web platform for sharing, viewing, and annotating 3D Gaussian Splat scans and 3D models — directly in the browser.**

KOSMOS-Link is a research project developed at **TH OWL (Technische Hochschule Ostwestfalen-Lippe), Germany**. Its goal is to build a shared, cross-departmental archive of 3D scans and models — captured by students and staff — that can be preserved, explored, and reused *"from generation to generation."*

The most novel part of the project is a **spatial annotation system** that lets users pin comments to exact points in 3D space — including inside Gaussian Splat scenes, where no established annotation solution exists.

---

## What it does

- **Upload 3D content** — Gaussian Splat scans (`.ply`, `.sog`, `.splat`, `.spz`) and classic 3D models (`.glb`).
- **View in the browser** — a cross-platform WebGL viewer renders both Gaussian Splats and polygon models with orbit / zoom / pan controls. No plugins or downloads required.
- **Annotate in 3D space** — switch to annotate mode, click any point on a scan, and pin a comment there. Pins persist and are visible to everyone; click a pin to read or delete it. Works on **both** GLB models and Gaussian Splats.
- **Comment & discuss** — a per-scan comment thread supports interdisciplinary feedback between departments.
- **Organize with tags** — tag scans on upload and filter the gallery by tag.
- **Share & control access** — every scan has a public/private toggle and a shareable link. Public scans appear in a community gallery.
- **Download scans** — original files can be downloaded for reuse in other tools.
- **Capture screenshots** — export a full-resolution image of the current viewport.
- **Auto-thumbnails** — a preview image is generated automatically the first time a scan is viewed.

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | React + Vite |
| Styling | Tailwind CSS |
| 3D rendering | Three.js |
| Gaussian Splat rendering | [SparkJS](https://sparkjs.dev) (`@sparkjsdev/spark`) |
| Auth / Database / Storage | Supabase (PostgreSQL + Row Level Security) |
| Routing | React Router |

Gaussian Splats and GLB models are rendered together in a single Three.js scene. Spatial annotations use Three.js raycasting to convert a 2D click into a 3D world point; for splats this uses SparkJS's built-in raycasting against the point cloud.

---

## Core MVP features (agreed scope)

1. ✅ 3D scan upload (`.splat` / `.ply` and more)
2. ✅ Browser-based Gaussian Splat viewer (WebGL / Three.js)
3. ✅ Spatial annotation system — click-to-annotate in 3D space *(core research contribution)*
4. ✅ User accounts and scan sharing (auth + public/private links)
5. ✅ Scan gallery / dashboard with tagging

### Additional features built
Comments · downloadable scans · viewport screenshots · auto-generated thumbnails · **combine & arrange multiple scans in one scene (save/load)** · **WebXR / VR support**

### Planned / future work
Video flythroughs · AI renders from the viewport · university (institutional) SSO login.

---

## Getting started

### Prerequisites
- Node.js 20+
- A [Supabase](https://supabase.com) project

### Setup

```bash
# install dependencies
npm install

# create a .env file in the project root:
#   VITE_SUPABASE_URL=your-supabase-url
#   VITE_SUPABASE_KEY=your-supabase-anon-key

# start the dev server
npm run dev
```

The Supabase project needs an `assets` storage bucket plus `assets`, `comments`, and `annotations` tables with row-level-security policies for authenticated access and public read of shared content.

---

## Project context

The vision behind KOSMOS-Link: a department captures a real-world subject (for example, a historical courtyard or a temporary art exhibition) as a Gaussian Splat scan. That scan is uploaded, shared, annotated, and later downloaded by other students who build on it — combining it with their own work or reusing it in teaching. Exhibitions that would otherwise disappear can be "relived," even in VR, and passed on to future cohorts.

---

*Developing as a research project (30 CP) at TH OWL.*
