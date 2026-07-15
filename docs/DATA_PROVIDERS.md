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

### Pokémon TCG API (pokemontcg.io)
- **Use in PSR:** primary **catalog** source in the reference adapter (sets, cards, images,
  basic TCGplayer/Cardmarket price snapshots where present).
- Free tier with API key; generous but rate-limited. Good English coverage; limited JP.
- ✅ Catalog, images. ⚠️ Pricing is embedded/limited; not a substitute for a pricing provider.
- Adapter implemented: `packages/providers/src/adapters/pokemontcg`.

### TCGdex
- Open catalog data incl. multilingual (JP/FR/DE…). Good fallback/enrichment for catalog.
- ✅ Multilingual catalog. ❌ No first-party market pricing.

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
  - **Catalog** — Pokémon TCG API adapter (`CATALOG_PROVIDER=pokemontcg`).
  - **Raw pricing** — Pokémon TCG API adapter (`RAW_PRICING_PROVIDER=pokemontcg`) that
    normalizes the card object's embedded TCGplayer (USD) + Cardmarket (EUR) prices to
    `NormalizedPrice[]`. No history from this source by design — daily `price_points` snapshots
    build history (see the price-snapshot job). Tested with mocked fetch fixtures.
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
