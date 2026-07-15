/**
 * Hand-written Supabase-style `Database` type mirroring the SQL migrations.
 * Conventions:
 *   - uuid / timestamptz / date / char(3) -> string
 *   - int / numeric -> number  (money columns are integer MINOR units)
 *   - boolean -> boolean
 *   - jsonb -> Json (Record<string, unknown> | ...) | null
 * Keep in sync with packages/database/migrations/*.sql.
 */

import type {
  SubscriptionStatus,
  PlanTier,
  OwnershipType,
  GradingCompany,
  RawCondition,
  CardFinish,
  ScanTypeValue,
  ScanStatus,
  CaptureType,
  AlertDirection,
  AlertCadence,
  NotificationType,
  ValuationType,
  CollectionVisibility,
  JobStatus,
  DataQualitySeverity,
  SubmissionRecommendation,
} from './constants.js';

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

/** jsonb column shape used throughout the schema. */
type JsonObject = Record<string, unknown>;

/** Helper: derive an Insert type by making the given keys optional. */
type WithOptional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Columns that always have DB defaults and can be omitted on insert.
type Timestamps = 'created_at' | 'updated_at';

// ---------------------------------------------------------------------------
// profiles
// ---------------------------------------------------------------------------
interface ProfileRow {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  preferred_currency: string;
  preferred_language: string;
  timezone: string;
  is_admin: boolean;
  terms_accepted_at: string | null;
  privacy_accepted_at: string | null;
  onboarding_completed_at: string | null;
  created_at: string;
  updated_at: string;
}
type ProfileInsert = WithOptional<
  ProfileRow,
  | 'display_name'
  | 'avatar_url'
  | 'preferred_currency'
  | 'preferred_language'
  | 'timezone'
  | 'is_admin'
  | 'terms_accepted_at'
  | 'privacy_accepted_at'
  | 'onboarding_completed_at'
  | Timestamps
>;

// ---------------------------------------------------------------------------
// admin_roles
// ---------------------------------------------------------------------------
interface AdminRoleRow {
  user_id: string;
  role: string;
  granted_at: string;
  granted_by: string | null;
}
type AdminRoleInsert = WithOptional<AdminRoleRow, 'role' | 'granted_at' | 'granted_by'>;

// ---------------------------------------------------------------------------
// subscriptions
// ---------------------------------------------------------------------------
interface SubscriptionRow {
  id: string;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  status: SubscriptionStatus;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  trial_ends_at: string | null;
  created_at: string;
  updated_at: string;
}
type SubscriptionInsert = WithOptional<
  SubscriptionRow,
  | 'id'
  | 'stripe_customer_id'
  | 'stripe_subscription_id'
  | 'stripe_price_id'
  | 'status'
  | 'current_period_start'
  | 'current_period_end'
  | 'cancel_at_period_end'
  | 'trial_ends_at'
  | Timestamps
>;

// ---------------------------------------------------------------------------
// entitlements
// ---------------------------------------------------------------------------
interface EntitlementRow {
  user_id: string;
  plan: PlanTier;
  collection_limit: number;
  quick_scan_monthly_limit: number;
  grade_scan_monthly_limit: number;
  alerts_limit: number;
  history_days: number;
  exports_enabled: boolean;
  advanced_analytics_enabled: boolean;
  batch_scanning_enabled: boolean;
  created_at: string;
  updated_at: string;
}
type EntitlementInsert = WithOptional<
  EntitlementRow,
  | 'plan'
  | 'collection_limit'
  | 'quick_scan_monthly_limit'
  | 'grade_scan_monthly_limit'
  | 'alerts_limit'
  | 'history_days'
  | 'exports_enabled'
  | 'advanced_analytics_enabled'
  | 'batch_scanning_enabled'
  | Timestamps
>;

// ---------------------------------------------------------------------------
// usage_periods
// ---------------------------------------------------------------------------
interface UsagePeriodRow {
  id: string;
  user_id: string;
  period_start: string;
  period_end: string;
  quick_scans_used: number;
  grade_scans_used: number;
  provider_credits_used: number;
  created_at: string;
  updated_at: string;
}
type UsagePeriodInsert = WithOptional<
  UsagePeriodRow,
  'id' | 'quick_scans_used' | 'grade_scans_used' | 'provider_credits_used' | Timestamps
>;

// ---------------------------------------------------------------------------
// stripe_webhook_events
// ---------------------------------------------------------------------------
interface StripeWebhookEventRow {
  id: string;
  type: string | null;
  payload: JsonObject | null;
  processed_at: string | null;
  created_at: string;
}
type StripeWebhookEventInsert = WithOptional<
  StripeWebhookEventRow,
  'type' | 'payload' | 'processed_at' | 'created_at'
>;

// ---------------------------------------------------------------------------
// sets
// ---------------------------------------------------------------------------
interface SetRow {
  id: string;
  name: string;
  series: string | null;
  language: string;
  printed_total: number | null;
  total: number | null;
  release_date: string | null;
  symbol_url: string | null;
  logo_url: string | null;
  canonical_slug: string;
  metadata: JsonObject | null;
  created_at: string;
  updated_at: string;
}
type SetInsert = WithOptional<
  SetRow,
  | 'id'
  | 'series'
  | 'language'
  | 'printed_total'
  | 'total'
  | 'release_date'
  | 'symbol_url'
  | 'logo_url'
  | 'metadata'
  | Timestamps
>;

// ---------------------------------------------------------------------------
// cards
// ---------------------------------------------------------------------------
interface CardRow {
  id: string;
  set_id: string;
  name: string;
  number: string | null;
  printed_number: string | null;
  rarity: string | null;
  supertype: string | null;
  subtypes: string[];
  language: string;
  artist: string | null;
  regulation_mark: string | null;
  image_small_url: string | null;
  image_large_url: string | null;
  canonical_slug: string;
  metadata: JsonObject | null;
  /** Generated column: digits of `number`, null if none. */
  normalized_number: string | null;
  created_at: string;
  updated_at: string;
}
type CardInsert = WithOptional<
  CardRow,
  | 'id'
  | 'number'
  | 'printed_number'
  | 'rarity'
  | 'supertype'
  | 'subtypes'
  | 'language'
  | 'artist'
  | 'regulation_mark'
  | 'image_small_url'
  | 'image_large_url'
  | 'metadata'
  | 'normalized_number'
  | Timestamps
>;

// ---------------------------------------------------------------------------
// card_variants
// ---------------------------------------------------------------------------
interface CardVariantRow {
  id: string;
  card_id: string;
  finish: CardFinish;
  edition: string | null;
  language: string;
  stamp: string | null;
  variant_name: string | null;
  metadata: JsonObject | null;
  created_at: string;
  updated_at: string;
}
type CardVariantInsert = WithOptional<
  CardVariantRow,
  'id' | 'finish' | 'edition' | 'language' | 'stamp' | 'variant_name' | 'metadata' | Timestamps
>;

// ---------------------------------------------------------------------------
// external_id_mappings
// ---------------------------------------------------------------------------
interface ExternalIdMappingRow {
  id: string;
  entity_type: string;
  internal_id: string;
  provider: string;
  external_id: string;
  external_url: string | null;
  metadata: JsonObject | null;
  created_at: string;
  updated_at: string;
}
type ExternalIdMappingInsert = WithOptional<
  ExternalIdMappingRow,
  'id' | 'external_url' | 'metadata' | Timestamps
>;

// ---------------------------------------------------------------------------
// collections
// ---------------------------------------------------------------------------
interface CollectionRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  visibility: CollectionVisibility;
  created_at: string;
  updated_at: string;
}
type CollectionInsert = WithOptional<
  CollectionRow,
  'id' | 'description' | 'is_default' | 'visibility' | Timestamps
>;

// ---------------------------------------------------------------------------
// collection_items
// ---------------------------------------------------------------------------
interface CollectionItemRow {
  id: string;
  collection_id: string;
  user_id: string;
  card_id: string;
  card_variant_id: string | null;
  quantity: number;
  ownership_type: OwnershipType;
  raw_condition: RawCondition | null;
  grading_company: GradingCompany | null;
  grade: number | null;
  grade_label: string | null;
  certification_number: string | null;
  purchase_price_minor: number | null;
  purchase_currency: string;
  purchase_date: string | null;
  acquisition_source: string | null;
  notes: string | null;
  front_image_path: string | null;
  back_image_path: string | null;
  estimated_value_minor: number | null;
  valuation_price_point_id: string | null;
  created_at: string;
  updated_at: string;
}
type CollectionItemInsert = WithOptional<
  CollectionItemRow,
  | 'id'
  | 'card_variant_id'
  | 'quantity'
  | 'ownership_type'
  | 'raw_condition'
  | 'grading_company'
  | 'grade'
  | 'grade_label'
  | 'certification_number'
  | 'purchase_price_minor'
  | 'purchase_currency'
  | 'purchase_date'
  | 'acquisition_source'
  | 'notes'
  | 'front_image_path'
  | 'back_image_path'
  | 'estimated_value_minor'
  | 'valuation_price_point_id'
  | Timestamps
>;

// ---------------------------------------------------------------------------
// user_tags
// ---------------------------------------------------------------------------
interface UserTagRow {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  created_at: string;
  updated_at: string;
}
type UserTagInsert = WithOptional<UserTagRow, 'id' | 'color' | Timestamps>;

// ---------------------------------------------------------------------------
// collection_item_tags
// ---------------------------------------------------------------------------
interface CollectionItemTagRow {
  collection_item_id: string;
  user_tag_id: string;
  user_id: string;
  created_at: string;
}
type CollectionItemTagInsert = WithOptional<CollectionItemTagRow, 'created_at'>;

// ---------------------------------------------------------------------------
// price_points
// ---------------------------------------------------------------------------
interface PricePointRow {
  id: string;
  card_id: string;
  card_variant_id: string | null;
  provider: string;
  market: string;
  currency: string;
  condition: RawCondition | null;
  grading_company: GradingCompany | null;
  grade: number | null;
  value_minor: number;
  low_value_minor: number | null;
  high_value_minor: number | null;
  sample_size: number | null;
  valuation_type: ValuationType;
  recorded_for_date: string;
  provider_updated_at: string | null;
  created_at: string;
}
type PricePointInsert = WithOptional<
  PricePointRow,
  | 'id'
  | 'card_variant_id'
  | 'market'
  | 'currency'
  | 'condition'
  | 'grading_company'
  | 'grade'
  | 'low_value_minor'
  | 'high_value_minor'
  | 'sample_size'
  | 'valuation_type'
  | 'provider_updated_at'
  | 'created_at'
>;

// ---------------------------------------------------------------------------
// portfolio_snapshots
// ---------------------------------------------------------------------------
interface PortfolioSnapshotRow {
  id: string;
  user_id: string;
  snapshot_date: string;
  total_market_value_minor: number;
  total_cost_basis_minor: number;
  unrealized_gain_minor: number;
  card_count: number;
  graded_card_count: number;
  raw_card_count: number;
  breakdown: JsonObject | null;
  created_at: string;
}
type PortfolioSnapshotInsert = WithOptional<
  PortfolioSnapshotRow,
  | 'id'
  | 'total_market_value_minor'
  | 'total_cost_basis_minor'
  | 'unrealized_gain_minor'
  | 'card_count'
  | 'graded_card_count'
  | 'raw_card_count'
  | 'breakdown'
  | 'created_at'
>;

// ---------------------------------------------------------------------------
// currency_rates
// ---------------------------------------------------------------------------
interface CurrencyRateRow {
  id: string;
  base: string;
  quote: string;
  rate: number;
  as_of: string;
  created_at: string;
}
type CurrencyRateInsert = WithOptional<CurrencyRateRow, 'id' | 'created_at'>;

// ---------------------------------------------------------------------------
// scan_sessions
// ---------------------------------------------------------------------------
interface ScanSessionRow {
  id: string;
  user_id: string;
  scan_type: ScanTypeValue;
  status: ScanStatus;
  source: string | null;
  selected_card_id: string | null;
  recognition_confidence: number | null;
  provider: string | null;
  provider_cost: number | null;
  error_code: string | null;
  started_at: string;
  completed_at: string | null;
}
type ScanSessionInsert = WithOptional<
  ScanSessionRow,
  | 'id'
  | 'status'
  | 'source'
  | 'selected_card_id'
  | 'recognition_confidence'
  | 'provider'
  | 'provider_cost'
  | 'error_code'
  | 'started_at'
  | 'completed_at'
>;

// ---------------------------------------------------------------------------
// scan_images
// ---------------------------------------------------------------------------
interface ScanImageRow {
  id: string;
  scan_session_id: string;
  user_id: string;
  capture_type: CaptureType;
  storage_path: string;
  width: number | null;
  height: number | null;
  blur_score: number | null;
  glare_score: number | null;
  exposure_score: number | null;
  perspective_score: number | null;
  accepted: boolean;
  rejection_reason: string | null;
  created_at: string;
}
type ScanImageInsert = WithOptional<
  ScanImageRow,
  | 'id'
  | 'width'
  | 'height'
  | 'blur_score'
  | 'glare_score'
  | 'exposure_score'
  | 'perspective_score'
  | 'accepted'
  | 'rejection_reason'
  | 'created_at'
>;

// ---------------------------------------------------------------------------
// recognition_candidates
// ---------------------------------------------------------------------------
interface RecognitionCandidateRow {
  id: string;
  scan_session_id: string;
  user_id: string;
  card_id: string | null;
  provider: string | null;
  confidence: number | null;
  ranking: number | null;
  evidence: JsonObject | null;
  created_at: string;
}
type RecognitionCandidateInsert = WithOptional<
  RecognitionCandidateRow,
  'id' | 'card_id' | 'provider' | 'confidence' | 'ranking' | 'evidence' | 'created_at'
>;

// ---------------------------------------------------------------------------
// grade_reports
// ---------------------------------------------------------------------------
interface GradeReportRow {
  id: string;
  user_id: string;
  scan_session_id: string | null;
  card_id: string | null;
  estimated_min_grade: number | null;
  estimated_max_grade: number | null;
  estimated_ceiling: number | null;
  overall_confidence: number | null;
  centering_score: number | null;
  corner_score: number | null;
  edge_score: number | null;
  surface_score: number | null;
  structural_score: number | null;
  image_quality_score: number | null;
  submission_recommendation: SubmissionRecommendation | null;
  model_version: string | null;
  rules_version: string | null;
  disclaimer_version: string | null;
  share_token: string | null;
  share_expires_at: string | null;
  created_at: string;
}
type GradeReportInsert = WithOptional<
  GradeReportRow,
  | 'id'
  | 'scan_session_id'
  | 'card_id'
  | 'estimated_min_grade'
  | 'estimated_max_grade'
  | 'estimated_ceiling'
  | 'overall_confidence'
  | 'centering_score'
  | 'corner_score'
  | 'edge_score'
  | 'surface_score'
  | 'structural_score'
  | 'image_quality_score'
  | 'submission_recommendation'
  | 'model_version'
  | 'rules_version'
  | 'disclaimer_version'
  | 'share_token'
  | 'share_expires_at'
  | 'created_at'
>;

// ---------------------------------------------------------------------------
// grade_findings
// ---------------------------------------------------------------------------
interface GradeFindingRow {
  id: string;
  grade_report_id: string;
  user_id: string;
  category: string;
  severity: DataQualitySeverity;
  title: string | null;
  explanation: string | null;
  capture_type: CaptureType | null;
  bounding_box: JsonObject | null;
  mask_path: string | null;
  confidence: number | null;
  grade_cap: number | null;
  created_at: string;
}
type GradeFindingInsert = WithOptional<
  GradeFindingRow,
  | 'id'
  | 'severity'
  | 'title'
  | 'explanation'
  | 'capture_type'
  | 'bounding_box'
  | 'mask_path'
  | 'confidence'
  | 'grade_cap'
  | 'created_at'
>;

// ---------------------------------------------------------------------------
// actual_grading_results
// ---------------------------------------------------------------------------
interface ActualGradingResultRow {
  id: string;
  user_id: string;
  grade_report_id: string | null;
  grading_company: GradingCompany;
  actual_grade: number | null;
  certification_number: string | null;
  submitted_at: string | null;
  returned_at: string | null;
  consent_for_model_improvement: boolean;
  created_at: string;
}
type ActualGradingResultInsert = WithOptional<
  ActualGradingResultRow,
  | 'id'
  | 'grade_report_id'
  | 'actual_grade'
  | 'certification_number'
  | 'submitted_at'
  | 'returned_at'
  | 'consent_for_model_improvement'
  | 'created_at'
>;

// ---------------------------------------------------------------------------
// grade_training_examples
// ---------------------------------------------------------------------------
interface GradeTrainingExampleRow {
  id: string;
  user_id: string;
  grade_report_id: string | null;
  scan_image_id: string | null;
  actual_grade: number | null;
  grading_company: GradingCompany | null;
  label_payload: JsonObject | null;
  consented: boolean;
  consented_at: string | null;
  created_at: string;
  updated_at: string;
}
type GradeTrainingExampleInsert = WithOptional<
  GradeTrainingExampleRow,
  | 'id'
  | 'grade_report_id'
  | 'scan_image_id'
  | 'actual_grade'
  | 'grading_company'
  | 'label_payload'
  | 'consented'
  | 'consented_at'
  | Timestamps
>;

// ---------------------------------------------------------------------------
// watchlist_items
// ---------------------------------------------------------------------------
interface WatchlistItemRow {
  id: string;
  user_id: string;
  card_id: string;
  card_variant_id: string | null;
  target_condition: RawCondition | null;
  target_grading_company: GradingCompany | null;
  target_grade: number | null;
  created_at: string;
}
type WatchlistItemInsert = WithOptional<
  WatchlistItemRow,
  'id' | 'card_variant_id' | 'target_condition' | 'target_grading_company' | 'target_grade' | 'created_at'
>;

// ---------------------------------------------------------------------------
// price_alerts
// ---------------------------------------------------------------------------
interface PriceAlertRow {
  id: string;
  user_id: string;
  card_id: string;
  card_variant_id: string | null;
  condition: RawCondition | null;
  grading_company: GradingCompany | null;
  grade: number | null;
  direction: AlertDirection;
  threshold: number | null;
  percentage_change: number | null;
  cadence: AlertCadence;
  enabled: boolean;
  last_triggered_at: string | null;
  created_at: string;
  updated_at: string;
}
type PriceAlertInsert = WithOptional<
  PriceAlertRow,
  | 'id'
  | 'card_variant_id'
  | 'condition'
  | 'grading_company'
  | 'grade'
  | 'threshold'
  | 'percentage_change'
  | 'cadence'
  | 'enabled'
  | 'last_triggered_at'
  | Timestamps
>;

// ---------------------------------------------------------------------------
// notifications
// ---------------------------------------------------------------------------
interface NotificationRow {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  action_url: string | null;
  read_at: string | null;
  created_at: string;
}
type NotificationInsert = WithOptional<
  NotificationRow,
  'id' | 'body' | 'action_url' | 'read_at' | 'created_at'
>;

// ---------------------------------------------------------------------------
// email_preferences
// ---------------------------------------------------------------------------
interface EmailPreferenceRow {
  user_id: string;
  marketing: boolean;
  price_alerts: boolean;
  digests: boolean;
  product: boolean;
  created_at: string;
  updated_at: string;
}
type EmailPreferenceInsert = WithOptional<
  EmailPreferenceRow,
  'marketing' | 'price_alerts' | 'digests' | 'product' | Timestamps
>;

// ---------------------------------------------------------------------------
// provider_request_logs
// ---------------------------------------------------------------------------
interface ProviderRequestLogRow {
  id: string;
  provider: string;
  operation: string;
  status: string;
  credits_used: number;
  duration_ms: number | null;
  cache_hit: boolean;
  error_code: string | null;
  created_at: string;
}
type ProviderRequestLogInsert = WithOptional<
  ProviderRequestLogRow,
  'id' | 'credits_used' | 'duration_ms' | 'cache_hit' | 'error_code' | 'created_at'
>;

// ---------------------------------------------------------------------------
// provider_sync_runs
// ---------------------------------------------------------------------------
interface ProviderSyncRunRow {
  id: string;
  provider: string;
  entity_type: string | null;
  status: JobStatus;
  started_at: string | null;
  finished_at: string | null;
  records_synced: number;
  error_code: string | null;
  metadata: JsonObject | null;
  created_at: string;
}
type ProviderSyncRunInsert = WithOptional<
  ProviderSyncRunRow,
  | 'id'
  | 'entity_type'
  | 'status'
  | 'started_at'
  | 'finished_at'
  | 'records_synced'
  | 'error_code'
  | 'metadata'
  | 'created_at'
>;

// ---------------------------------------------------------------------------
// background_jobs
// ---------------------------------------------------------------------------
interface BackgroundJobRow {
  id: string;
  job_type: string;
  status: JobStatus;
  payload: JsonObject | null;
  result: JsonObject | null;
  error_code: string | null;
  attempts: number;
  run_after: string;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}
type BackgroundJobInsert = WithOptional<
  BackgroundJobRow,
  | 'id'
  | 'status'
  | 'payload'
  | 'result'
  | 'error_code'
  | 'attempts'
  | 'run_after'
  | 'started_at'
  | 'finished_at'
  | Timestamps
>;

// ---------------------------------------------------------------------------
// feature_flags
// ---------------------------------------------------------------------------
interface FeatureFlagRow {
  key: string;
  enabled: boolean;
  rollout: number;
  payload: JsonObject | null;
  created_at: string;
  updated_at: string;
}
type FeatureFlagInsert = WithOptional<
  FeatureFlagRow,
  'enabled' | 'rollout' | 'payload' | Timestamps
>;

// ---------------------------------------------------------------------------
// audit_logs
// ---------------------------------------------------------------------------
interface AuditLogRow {
  id: string;
  actor_user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: JsonObject | null;
  created_at: string;
}
type AuditLogInsert = WithOptional<
  AuditLogRow,
  'id' | 'actor_user_id' | 'entity_type' | 'entity_id' | 'metadata' | 'created_at'
>;

// ---------------------------------------------------------------------------
// saved_searches
// ---------------------------------------------------------------------------
interface SavedSearchRow {
  id: string;
  user_id: string;
  name: string;
  query: JsonObject | null;
  created_at: string;
  updated_at: string;
}
type SavedSearchInsert = WithOptional<SavedSearchRow, 'id' | 'query' | Timestamps>;

// ---------------------------------------------------------------------------
// import_jobs
// ---------------------------------------------------------------------------
interface ImportJobRow {
  id: string;
  user_id: string;
  source: string | null;
  status: JobStatus;
  total_rows: number;
  processed_rows: number;
  error_rows: number;
  storage_path: string | null;
  result: JsonObject | null;
  error_code: string | null;
  created_at: string;
  updated_at: string;
}
type ImportJobInsert = WithOptional<
  ImportJobRow,
  | 'id'
  | 'source'
  | 'status'
  | 'total_rows'
  | 'processed_rows'
  | 'error_rows'
  | 'storage_path'
  | 'result'
  | 'error_code'
  | Timestamps
>;

// ---------------------------------------------------------------------------
// export_jobs
// ---------------------------------------------------------------------------
interface ExportJobRow {
  id: string;
  user_id: string;
  format: string | null;
  status: JobStatus;
  storage_path: string | null;
  result: JsonObject | null;
  error_code: string | null;
  created_at: string;
  updated_at: string;
}
type ExportJobInsert = WithOptional<
  ExportJobRow,
  'id' | 'format' | 'status' | 'storage_path' | 'result' | 'error_code' | Timestamps
>;

// ---------------------------------------------------------------------------
// data_quality_issues
// ---------------------------------------------------------------------------
interface DataQualityIssueRow {
  id: string;
  entity_type: string;
  entity_id: string | null;
  issue_code: string;
  severity: DataQualitySeverity;
  details: JsonObject | null;
  resolved_at: string | null;
  created_at: string;
}
type DataQualityIssueInsert = WithOptional<
  DataQualityIssueRow,
  'id' | 'entity_id' | 'severity' | 'details' | 'resolved_at' | 'created_at'
>;

// ---------------------------------------------------------------------------
// api_keys
// ---------------------------------------------------------------------------
interface ApiKeyRow {
  id: string;
  user_id: string;
  name: string | null;
  hashed_key: string;
  prefix: string;
  scopes: string[];
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}
type ApiKeyInsert = WithOptional<
  ApiKeyRow,
  'id' | 'name' | 'scopes' | 'last_used_at' | 'revoked_at' | 'created_at'
>;

/** A table definition in Supabase style. */
interface TableDef<Row, Insert> {
  Row: Row;
  Insert: Insert;
  Update: Partial<Insert>;
}

export interface Database {
  public: {
    Tables: {
      profiles: TableDef<ProfileRow, ProfileInsert>;
      admin_roles: TableDef<AdminRoleRow, AdminRoleInsert>;
      subscriptions: TableDef<SubscriptionRow, SubscriptionInsert>;
      entitlements: TableDef<EntitlementRow, EntitlementInsert>;
      usage_periods: TableDef<UsagePeriodRow, UsagePeriodInsert>;
      stripe_webhook_events: TableDef<StripeWebhookEventRow, StripeWebhookEventInsert>;
      sets: TableDef<SetRow, SetInsert>;
      cards: TableDef<CardRow, CardInsert>;
      card_variants: TableDef<CardVariantRow, CardVariantInsert>;
      external_id_mappings: TableDef<ExternalIdMappingRow, ExternalIdMappingInsert>;
      collections: TableDef<CollectionRow, CollectionInsert>;
      collection_items: TableDef<CollectionItemRow, CollectionItemInsert>;
      user_tags: TableDef<UserTagRow, UserTagInsert>;
      collection_item_tags: TableDef<CollectionItemTagRow, CollectionItemTagInsert>;
      price_points: TableDef<PricePointRow, PricePointInsert>;
      portfolio_snapshots: TableDef<PortfolioSnapshotRow, PortfolioSnapshotInsert>;
      currency_rates: TableDef<CurrencyRateRow, CurrencyRateInsert>;
      scan_sessions: TableDef<ScanSessionRow, ScanSessionInsert>;
      scan_images: TableDef<ScanImageRow, ScanImageInsert>;
      recognition_candidates: TableDef<RecognitionCandidateRow, RecognitionCandidateInsert>;
      grade_reports: TableDef<GradeReportRow, GradeReportInsert>;
      grade_findings: TableDef<GradeFindingRow, GradeFindingInsert>;
      actual_grading_results: TableDef<ActualGradingResultRow, ActualGradingResultInsert>;
      grade_training_examples: TableDef<GradeTrainingExampleRow, GradeTrainingExampleInsert>;
      watchlist_items: TableDef<WatchlistItemRow, WatchlistItemInsert>;
      price_alerts: TableDef<PriceAlertRow, PriceAlertInsert>;
      notifications: TableDef<NotificationRow, NotificationInsert>;
      email_preferences: TableDef<EmailPreferenceRow, EmailPreferenceInsert>;
      provider_request_logs: TableDef<ProviderRequestLogRow, ProviderRequestLogInsert>;
      provider_sync_runs: TableDef<ProviderSyncRunRow, ProviderSyncRunInsert>;
      background_jobs: TableDef<BackgroundJobRow, BackgroundJobInsert>;
      feature_flags: TableDef<FeatureFlagRow, FeatureFlagInsert>;
      audit_logs: TableDef<AuditLogRow, AuditLogInsert>;
      saved_searches: TableDef<SavedSearchRow, SavedSearchInsert>;
      import_jobs: TableDef<ImportJobRow, ImportJobInsert>;
      export_jobs: TableDef<ExportJobRow, ExportJobInsert>;
      data_quality_issues: TableDef<DataQualityIssueRow, DataQualityIssueInsert>;
      api_keys: TableDef<ApiKeyRow, ApiKeyInsert>;
    };
    Enums: {
      subscription_status: SubscriptionStatus;
      plan_tier: PlanTier;
      ownership_type: OwnershipType;
      grading_company: GradingCompany;
      raw_condition: RawCondition;
      card_finish: CardFinish;
      scan_type: ScanTypeValue;
      scan_status: ScanStatus;
      capture_type: CaptureType;
      alert_direction: AlertDirection;
      alert_cadence: AlertCadence;
      notification_type: NotificationType;
      valuation_type: ValuationType;
      collection_visibility: CollectionVisibility;
      job_status: JobStatus;
      data_quality_severity: DataQualitySeverity;
      submission_recommendation: SubmissionRecommendation;
    };
  };
}

// ---------------------------------------------------------------------------
// Convenience aliases
// ---------------------------------------------------------------------------
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
export type Enums<T extends keyof Database['public']['Enums']> =
  Database['public']['Enums'][T];

// Per-entity row aliases.
export type Profile = Tables<'profiles'>;
export type AdminRole = Tables<'admin_roles'>;
export type Subscription = Tables<'subscriptions'>;
export type Entitlement = Tables<'entitlements'>;
export type UsagePeriod = Tables<'usage_periods'>;
export type StripeWebhookEvent = Tables<'stripe_webhook_events'>;
export type Set_ = Tables<'sets'>;
export type Card = Tables<'cards'>;
export type CardVariant = Tables<'card_variants'>;
export type ExternalIdMapping = Tables<'external_id_mappings'>;
export type Collection = Tables<'collections'>;
export type CollectionItem = Tables<'collection_items'>;
export type UserTag = Tables<'user_tags'>;
export type CollectionItemTag = Tables<'collection_item_tags'>;
export type PricePoint = Tables<'price_points'>;
export type PortfolioSnapshot = Tables<'portfolio_snapshots'>;
export type CurrencyRate = Tables<'currency_rates'>;
export type ScanSession = Tables<'scan_sessions'>;
export type ScanImage = Tables<'scan_images'>;
export type RecognitionCandidate = Tables<'recognition_candidates'>;
export type GradeReport = Tables<'grade_reports'>;
export type GradeFinding = Tables<'grade_findings'>;
export type ActualGradingResult = Tables<'actual_grading_results'>;
export type GradeTrainingExample = Tables<'grade_training_examples'>;
export type WatchlistItem = Tables<'watchlist_items'>;
export type PriceAlert = Tables<'price_alerts'>;
export type Notification = Tables<'notifications'>;
export type EmailPreference = Tables<'email_preferences'>;
export type ProviderRequestLog = Tables<'provider_request_logs'>;
export type ProviderSyncRun = Tables<'provider_sync_runs'>;
export type BackgroundJob = Tables<'background_jobs'>;
export type FeatureFlag = Tables<'feature_flags'>;
export type AuditLog = Tables<'audit_logs'>;
export type SavedSearch = Tables<'saved_searches'>;
export type ImportJob = Tables<'import_jobs'>;
export type ExportJob = Tables<'export_jobs'>;
export type DataQualityIssue = Tables<'data_quality_issues'>;
export type ApiKey = Tables<'api_keys'>;
