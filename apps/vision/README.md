# psr-vision — Pokémon Stock Radar Vision Service

A FastAPI microservice that analyzes photos of Pokémon trading cards and
estimates **grade potential** using deterministic OpenCV computer vision plus a
conservative, versioned rules engine.

> **Important:** This service produces *estimates only*. It is not a grade, is not
> affiliated with PSA/BGS/CGC or any grading company, and a grading company may
> return a different result. Every grade-potential response embeds a full
> disclaimer. A general-purpose LLM is never used as the grading engine.

## What it does

- **Image quality** gate (focus/blur, exposure, glare, coverage, resolution,
  color cast) with human-readable retake instructions.
- **Card detection & rectification** (contour + perspective warp to a canonical
  2.5"×3.5" / 500×700 card).
- **Centering** via gradient projection profiles (border-width ratios + score).
- **Corners / edges / surface / structural** heuristic condition analysis, each
  honest about its confidence and limits.
- **Grade potential** fusion → estimated grade *range*, ceiling, confidence,
  limiting defects, suggested recaptures, and a submission recommendation.

## Requirements

- Python 3.13

## Run

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000
```

Then open http://localhost:8000/docs for the interactive API.

Optional: set `VISION_SERVICE_API_KEY` to require an `x-api-key` header on all
routes. If unset, the service runs in open dev/demo mode.

The optional `ml` extra (`pip install -e ".[ml]"`) pulls in torch/onnxruntime for
future acceleration. These are **never imported at module load** — the service
runs and all tests pass without them.

## Test

```bash
pytest
```

Tests synthesize deterministic card images with NumPy/OpenCV, so they need no
real photos, no network, and no paid providers.

## Key endpoints

| Method | Path | Purpose |
| ------ | ---- | ------- |
| GET  | `/health` | Liveness |
| GET  | `/version` | Service / model / rules versions |
| POST | `/v1/images/quality` | Quality report for one image |
| POST | `/v1/cards/detect` | Card boundary detection |
| POST | `/v1/cards/rectify` | Perspective-corrected card + annotated PNG |
| POST | `/v1/cards/orientation` | Portrait normalization + weak front/back guess |
| POST | `/v1/cards/centering` | Border ratios + centering score |
| POST | `/v1/cards/corners` | Per-corner condition |
| POST | `/v1/cards/edges` | Per-edge condition |
| POST | `/v1/cards/surface` | Surface condition (low confidence from flat image) |
| POST | `/v1/cards/structural` | Dimensional / warp observations |
| POST | `/v1/cards/grade-potential` | Full fusion → grade-potential estimate |

### grade-potential multi-capture contract

`/v1/cards/grade-potential` accepts a list of `files` plus a parallel list of
`capture_types` form fields (e.g. `front`, `back`, `front_angled`, `corner_tl`).
If fewer capture types are supplied than files, the first file defaults to
`front` and the rest to `additional`. The primary front-like capture drives
geometry; angled/back captures raise confidence when present.

## Error envelope

All errors return a consistent JSON body:

```json
{ "success": false, "error": { "code": "unprocessable_entity", "message": "..." } }
```
