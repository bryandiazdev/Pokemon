/**
 * Normalized provider interfaces. Provider-specific response shapes are
 * translated to these types INSIDE each adapter and never leak outward.
 */

import type {
  RawCondition,
  GradingCompany,
  CardFinish,
  Language,
  DataFreshness,
} from '@psr/types';

// ---------- Normalized entities ----------

export interface NormalizedSet {
  externalId: string;
  provider: string;
  name: string;
  series: string | null;
  language: Language;
  printedTotal: number | null;
  total: number | null;
  releaseDate: string | null; // ISO date
  symbolUrl: string | null;
  logoUrl: string | null;
  metadata?: Record<string, unknown>;
}

export interface NormalizedCard {
  externalId: string;
  provider: string;
  setExternalId: string;
  name: string;
  number: string;
  printedNumber: string | null;
  rarity: string | null;
  supertype: string | null;
  subtypes: string[];
  language: Language;
  artist: string | null;
  regulationMark: string | null;
  imageSmallUrl: string | null;
  imageLargeUrl: string | null;
  metadata?: Record<string, unknown>;
}

/** Money as minor units + currency, provider-native. */
export interface NormalizedPrice {
  provider: string;
  market: string; // e.g. "tcgplayer", "cardmarket"
  currency: string;
  condition?: RawCondition;
  finish?: CardFinish;
  valueMinor: number;
  lowMinor?: number;
  highMinor?: number;
  sampleSize?: number;
  valuationType: 'market' | 'low' | 'mid' | 'high' | 'estimate';
  recordedForDate: string; // ISO date
  providerUpdatedAt?: string;
  freshness: DataFreshness;
}

export interface NormalizedGradedPrice extends NormalizedPrice {
  gradingCompany: GradingCompany;
  grade: string; // e.g. "10", "9.5"
  label?: string;
  designation?: string;
}

export interface NormalizedPricePoint {
  date: string; // ISO date
  valueMinor: number;
  currency: string;
  freshness: DataFreshness;
}

export interface NormalizedPopulationReport {
  gradingCompany: GradingCompany;
  total: number;
  byGrade: Record<string, number>;
  gemRate?: number; // fraction 0..1
  asOf: string;
  provider: string;
}

export interface CertificationResult {
  found: boolean;
  gradingCompany?: GradingCompany;
  grade?: string;
  certificationNumber: string;
  cardName?: string;
  verifiedAt: string;
  provider: string;
}

export interface NormalizedListing {
  provider: string;
  marketplace: string;
  title: string;
  priceMinor: number;
  currency: string;
  url: string;
  condition?: string;
  /** Asking prices are NOT sold prices — always labeled as such downstream. */
  listingType: 'active_listing';
  observedAt: string;
}

export interface CardRecognitionCandidate {
  cardExternalId?: string;
  cardName?: string;
  setHint?: string;
  numberHint?: string;
  language?: Language;
  confidence: number; // 0..1
  ranking: number;
  evidence?: Record<string, unknown>;
}

export interface CardRecognitionResult {
  candidates: CardRecognitionCandidate[];
  provider: string;
  /** True when the top candidate is confident enough to auto-select. */
  requiresConfirmation: boolean;
}

// ---------- Inputs ----------

export interface CardSearchInput {
  query: string;
  language?: Language;
  setExternalId?: string;
  limit?: number;
  cursor?: string;
}
export interface CardSearchResult {
  cards: NormalizedCard[];
  nextCursor: string | null;
}
export interface SetSearchInput {
  language?: Language;
  limit?: number;
  cursor?: string;
}
export interface PricingInput {
  cardExternalId: string;
  finish?: CardFinish;
  currency?: string;
}
export interface PriceHistoryInput extends PricingInput {
  from: string;
  to: string;
}
export interface GradedPricingInput extends PricingInput {
  gradingCompany?: GradingCompany;
}
export interface GradedHistoryInput extends PriceHistoryInput {
  gradingCompany: GradingCompany;
  grade: string;
}
export interface PopulationInput {
  cardExternalId: string;
  gradingCompany: GradingCompany;
}
export interface CertificationInput {
  gradingCompany: GradingCompany;
  certificationNumber: string;
}
export interface ListingSearchInput {
  cardExternalId?: string;
  query?: string;
  limit?: number;
}
export interface CardImageInput {
  /** base64 or a short-lived signed URL — never a public bucket path. */
  imageRef: string;
  language?: Language;
  /**
   * Optional OCR text extracted on-device or by a vision OCR pass. The
   * catalog-OCR recognition adapter uses these hints to rank candidates. A pure
   * image-recognition provider may ignore them.
   */
  ocr?: {
    name?: string;
    number?: string;
    setName?: string;
    rawText?: string;
  };
}

// ---------- Capability interfaces ----------

export interface CardCatalogProvider {
  readonly name: string;
  searchCards(input: CardSearchInput): Promise<CardSearchResult>;
  getCard(externalId: string): Promise<NormalizedCard>;
  getSet(externalId: string): Promise<NormalizedSet>;
  listSets(input: SetSearchInput): Promise<NormalizedSet[]>;
}
export interface CardRecognitionProvider {
  readonly name: string;
  identifyCard(input: CardImageInput): Promise<CardRecognitionResult>;
}
export interface RawPricingProvider {
  readonly name: string;
  getCurrentRawPrices(input: PricingInput): Promise<NormalizedPrice[]>;
  getRawPriceHistory(input: PriceHistoryInput): Promise<NormalizedPricePoint[]>;
}
export interface GradedPricingProvider {
  readonly name: string;
  getCurrentGradedPrices(input: GradedPricingInput): Promise<NormalizedGradedPrice[]>;
  getGradedPriceHistory(input: GradedHistoryInput): Promise<NormalizedPricePoint[]>;
}
export interface PopulationProvider {
  readonly name: string;
  getPopulation(input: PopulationInput): Promise<NormalizedPopulationReport>;
}
export interface CertificationProvider {
  readonly name: string;
  verifyCertification(input: CertificationInput): Promise<CertificationResult>;
}
export interface MarketplaceProvider {
  readonly name: string;
  getActiveListings(input: ListingSearchInput): Promise<NormalizedListing[]>;
}

export type Capability =
  | 'catalog'
  | 'recognition'
  | 'rawPricing'
  | 'gradedPricing'
  | 'population'
  | 'certification'
  | 'activeListings';

export interface ProviderCapabilities {
  catalog?: CardCatalogProvider;
  recognition?: CardRecognitionProvider;
  rawPricing?: RawPricingProvider;
  gradedPricing?: GradedPricingProvider;
  population?: PopulationProvider;
  certification?: CertificationProvider;
  activeListings?: MarketplaceProvider;
}

export interface ProviderHealth {
  provider: string;
  capability: Capability;
  state: 'closed' | 'open' | 'half_open';
  healthy: boolean;
  lastError?: string;
  lastCheckedAt: string;
}
