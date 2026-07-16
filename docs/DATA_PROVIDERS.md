# Data Providers

External data changes, gets more expensive, or disappears. PSR isolates every provider behind a
normalized adapter (`@psr/providers`). This document tracks what each provider offers and the
due-diligence required **before** enabling it in production.

> ⚠️ The availability, licensing, pricing, and rate limits below **must be re-verified at
> implementation time** against each provider's current terms. Do not enable a live provider in
> production until the "Commercial use" and "Caching/retention" rows are confirmed for your account.

## Capability matrix (interfaces)

| Capability | Interface | Env selector |
|---|---|---|
| Catalog (sets/cards) | `CardCatalogProvider` | `CATALOG_PROVIDER` |
| Recognition (image → card) | `CardRecognitionProvider` | `RECOGNITION_PROVIDER` |
| Raw pricing | `RawPricingProvider` | `RAW_PRICING_PROVIDER` |
| Graded pricing | `GradedPricingProvider` | `GRADED_PRICING_PROVIDER` |
| Population | `PopulationProvider` | `POPULATION_PROVIDER` |
| Certification verify | `CertificationProvider` | `CERTIFICATION_PROVIDER` |
| Active listings | `MarketplaceProvider` | `ACTIVE_LISTINGS_PROVIDER` |

Every selector accepts `demo` (fixtures). Default in all `.env.example` values is `demo`.

## Providers to evaluate

For each provider, confirm and record: **API availability · commercial-use permission ·
supported countries · currencies · raw-condition coverage · graded-price coverage · historical
depth · image recognition · rate limits · credit costs · attribution · caching restrictions ·
data-retention restrictions · webhook support.**

### TCGdex ★ recommended free live source (`PROVIDER_PRESET=tcgdex`)
- **Use in PSR:** primary **catalog + raw pricing** live adapter. Verified 2026-07.
- **Free and KEYLESS** — no API key, no account. Multilingual (EN/JP/FR/DE/…).
- Market pricing embedded in each card object: **TCGplayer (USD)** by printing
  (low/mid/high/market/directLow) and **Cardmarket (EUR)** (avg/low/trend + avg1/avg7/avg30).
  Updated ~hourly. Set fetch includes its full card list; images via `assets.tcgdex.net`.
- ✅ Catalog, images, raw prices (USD + EUR), sparse Cardmarket trend for history.
  ❌ No graded/PSA prices, no population. Confirm current terms/rate-limits before heavy
  production use; be a good citizen (cache, our snapshot job batches requests).
- Adapters implemented: `packages/providers/src/adapters/tcgdex.ts`.

### Pokémon TCG API (pokemontcg.io) — now paid via Scrydex
- **⚠️ 2026 status:** pokemontcg.io has moved to **Scrydex**, a commercial API (paid, ~$29/mo).
  The legacy free key still works for now but is being wound down — prefer TCGdex.
- Catalog + embedded TCGplayer/Cardmarket price snapshots. Adapters:
  `packages/providers/src/adapters/pokemontcg.ts` + `pokemontcg-pricing.ts`
  (`CATALOG_PROVIDER=pokemontcg`, optional `POKEMON_TCG_API_KEY`).

### Scrydex
- Positioned as Pokémon/TCG pricing + catalog API. Verify commercial tier, graded coverage,
  historical depth, and caching terms before enabling.

### JustTCG
- TCG pricing API. Verify raw-condition granularity, graded coverage, rate limits, attribution.

### PriceCharting
- Raw + graded price points and history for many products. Verify **API** access + commercial
  license + caching/retention terms. **Do not scrape the website.**

### PSA Public API
- Certification verification + population where exposed. Verify access approval + rate limits.
  Use for `CertificationProvider` / `PopulationProvider` only via the official API.

### eBay Browse API
- **Active listings** only (never sold-listing scraping). OAuth app credentials required.
  Present asking prices clearly labeled — never as completed sales or "market value".

### Cardmarket
- EU market data where an official/licensed API is commercially available to you. Confirm terms.

## Hard rules
- **No scraping** of TCGplayer, eBay sold listings, PSA, PriceCharting, Cardmarket, marketplace
  pages, or population pages. Official/licensed APIs only.
- Never present **asking** prices as **sold** prices, or converted currency as a native
  observation, or interpolated points as observed data.
- Respect each provider's caching and retention limits; `provider_request_logs` stores only
  sanitized operational metadata (never response bodies with licensed data beyond permitted
  caching).
- Attribution: render provider attribution wherever their data is shown (see `/attribution`).

## Fallback & health
The registry supports priority + fallback per capability, circuit breakers, and health checks.
If the primary provider's breaker is open, the next configured provider (or demo fixtures in
non-prod) serves the request, and the response is badged as degraded/stale.

## Current status in this repo
- **Implemented (live, behind the interfaces):**
  - **Catalog + raw pricing — TCGdex (free, keyless): the recommended default live source.**
    `PROVIDER_PRESET=tcgdex` (or `CATALOG_PROVIDER=tcgdex` / `RAW_PRICING_PROVIDER=tcgdex`).
    Normalizes TCGplayer (USD) + Cardmarket (EUR) prices to `NormalizedPrice[]`; a genuine sparse
    Cardmarket trend powers history until our daily `price_points` snapshots accrue dense data.
    Tested with mocked fetch fixtures + verified against the live API.
  - **Catalog + raw pricing — Pokémon TCG API** (`=pokemontcg`, now paid via Scrydex; optional
    `POKEMON_TCG_API_KEY`). Same normalization. Kept as a legacy option.
  - **Recognition** — Catalog-OCR adapter (`RECOGNITION_PROVIDER=catalog-ocr`): ranks catalog
    candidates from OCR text (name/number/set) with a deterministic bigram similarity + number/
    language bonuses; never auto-selects ambiguous look-alikes. A hosted image-recognition
    provider can replace it behind the same interface. Tested.
- **Implemented (fixtures):** demo adapters for every capability; registry with
  timeout/retry/circuit-breaker/cache; contract tests.
- **Stubbed with interface + docs (enable by adding creds + finishing the adapter):** Scrydex,
  JustTCG, PriceCharting, PSA, eBay Browse, TCGdex, Cardmarket, graded pricing, population,
  certification, active listings.

> Note on OCR: the catalog-OCR recognition adapter expects OCR text (`CardImageInput.ocr`)
> supplied on-device (e.g. Tesseract.js) or by a vision OCR pass. This keeps recognition free
> and provider-agnostic; the demo recognition adapter returns ranked candidates without OCR.
