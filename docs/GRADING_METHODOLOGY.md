# Grade-Potential Methodology

## What this is — and what it is not

Pokémon Stock Radar produces a **Grade Potential** estimate: a conservative, camera-based
condition analysis that suggests a *range* of plausible outcomes and a *ceiling*. It is a
decision-support tool for deciding whether to submit a card for professional grading.

**It is an estimate, not a grade.** We do not and cannot guarantee a grade. Professional grading
is subjective and performed in person under magnification. Cameras miss microscopic and hidden
defects. Lighting, focus, glare, sleeves, image compression, and camera quality all affect the
analysis. PSR is **not affiliated with** PSA, Beckett/BGS, CGC, SGC, TAG, ACE, or any grading
company, and a grading company may return a different result.

Approved language: *Grade Potential, Estimated PSA Range, Estimated Grade Ceiling, Computer-Vision
Condition Analysis, Possible PSA 10 Candidate, Submission Candidate, Estimated Maximum Grade,
Confidence Level.* Forbidden: *Guaranteed PSA 10/Grade/Gem Mint, Official PSA Grade, PSA Approved.*

## Hybrid engine (no single black box)

A general-purpose LLM/VLM is **never** the sole grading engine. The pipeline is:

1. **Deterministic OpenCV geometry** — card boundary detection, homography rectification,
   orientation normalization, background segmentation, and **centering** measurement (border
   widths → L/R and T/B ratios). This is the most trustworthy signal and is fully deterministic.
2. **Classical vision** — corner whitening (luminance/edge analysis in corner ROIs), edge
   whitening/chipping (edge-band brightness vs. card body), surface scratch/print-line/glare
   detection (gradient + frequency cues), structural checks (contour convexity, dimensional
   ratio vs. reference for possible warping/trimming — flagged, never accused).
3. **Trainable models (optional, ONNX)** — object-detection/segmentation for defects, plugged in
   behind the same finding interface when a properly licensed, labeled dataset exists. Until then
   these are marked **experimental** and off by default.
4. **Rules engine** (`@psr/grading-rules`) — versioned per grading company. Maps sub-scores +
   findings to a conservative min/max/ceiling with a `grade_cap` per limiting defect.
5. **Confidence calibration** — image-quality gates reduce confidence; missing angled-light or
   video reduces surface confidence; ambiguous centering reduces centering confidence.
6. **Multimodal AI (optional)** — only to *explain* ambiguous findings in plain language, never
   to produce the grade.

## Sub-scores produced
`centering`, `corner`, `edge`, `surface`, `structural`, `image_quality` → each 0–100 with a
confidence. Fused into `estimated_min_grade`, `estimated_max_grade`, `estimated_ceiling`,
`overall_confidence`, `submission_recommendation`, plus machine-readable `grade_findings`
(category, severity, bbox/mask, explanation, grade_cap) and annotated evidence images.

## Centering (deterministic)
Measure L/R/T/B border widths on the rectified front (and back when available). Ratios expressed
as `min:max` (e.g. 60/40). Thresholds are **versioned and sourced** in
`packages/grading-rules/src/rules/*.json` with `effectiveDate` and `source`. We do **not** assume
identical border geometry for every card — layout classification + reference templates + symmetry
cues drive measurement, and confidence drops when the layout is ambiguous (full-art, alt-art).

## Conservative bias
- Return **ranges**, not false precision.
- Any single serious limiting defect caps the ceiling regardless of other strong scores.
- Poor image quality → we refuse a high-confidence result and require explicit user opt-in to
  proceed at reduced confidence.
- Structural irregularities use neutral language: *"Possible dimensional irregularity detected.
  Professional in-person inspection is recommended."* We never accuse users of alteration.

## Never instruct users to alter cards
We never tell users to clean, recolor whitening, trim, press, aggressively flatten, apply
chemicals, polish, or conceal defects.

## Training-data pipeline (future model improvement)
Users may report the **actual** grade a company returned, with explicit `consent_for_model_
improvement`. Consented examples are stored separately from production data, are deletable, and
are never used for advertising. No private image is used for training without explicit consent,
and consent is revocable.

## Versioning
Every report stores `model_version`, `rules_version`, and `disclaimer_version` so results are
reproducible and auditable as rules evolve.

## Disclaimer (rendered on every report)
> This is a computer-vision **estimate**, not a grade. Professional grading is subjective and
> performed in person; cameras can miss microscopic or hidden defects, and lighting, focus,
> glare, sleeves, and image quality affect results. Pokémon Stock Radar is not affiliated with
> PSA or any grading company, and a grading company may return a different result. This is not
> financial advice.
