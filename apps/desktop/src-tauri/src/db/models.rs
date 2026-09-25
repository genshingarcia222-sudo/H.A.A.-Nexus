use serde::{Deserialize, Serialize};

/// Mirrors nexus-core's SessionFlag (simulation-engine/types.ts).
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SessionFlagDto {
    #[serde(rename = "beatId")]
    pub beat_id: String,
    #[serde(rename = "flagType")]
    pub flag_type: String,
    pub timestamp: i64,
}

/// Mirrors nexus-core's DocumentationDraft (simulation-engine/documentation-draft.ts).
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct DocumentationDraftDto {
    #[serde(rename = "chiefComplaint")]
    pub chief_complaint: String,
    pub hpi: String,
    pub ros: String,
    #[serde(rename = "physicalExam")]
    pub physical_exam: String,
    pub assessment: String,
    pub plan: String,
    #[serde(rename = "additionalNotes")]
    pub additional_notes: String,
}

/// Mirrors nexus-core's EvaluationResult (evaluation-engine/types.ts).
/// Stored as opaque JSON blobs (category_scores_json, errors_json,
/// scoring_weights_json) since the Rust layer doesn't need to inspect
/// their internals - only persist and return them intact.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EvaluationResultDto {
    #[serde(rename = "overallScore")]
    pub overall_score: f64,
    #[serde(rename = "categoryScores")]
    pub category_scores: serde_json::Value,
    pub errors: serde_json::Value,
    #[serde(rename = "scoringWeightsUsed")]
    pub scoring_weights_used: serde_json::Value,
    #[serde(rename = "timeEfficiencyRatio")]
    pub time_efficiency_ratio: f64,
    #[serde(rename = "evaluatedAt")]
    pub evaluated_at: i64,
}

/// Mirrors nexus-core's SessionRecord (persistence/types.ts) exactly -
/// this is the DTO that crosses the Tauri IPC boundary in both directions.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SessionRecordDto {
    pub id: String,
    #[serde(rename = "scenarioId")]
    pub scenario_id: String,
    #[serde(rename = "scenarioVersion")]
    pub scenario_version: String,
    #[serde(rename = "scenarioTitle")]
    pub scenario_title: String,
    pub mode: String,
    pub status: String,
    #[serde(rename = "startedAt")]
    pub started_at: i64,
    #[serde(rename = "activeMs")]
    pub active_ms: i64,
    #[serde(rename = "pausedMs")]
    pub paused_ms: i64,
    #[serde(rename = "completedAt")]
    pub completed_at: Option<i64>,
    pub flags: Vec<SessionFlagDto>,
    pub draft: DocumentationDraftDto,
    pub evaluation: Option<EvaluationResultDto>,
}

/// Mirrors nexus-core's UserProfile (persistence/types.ts).
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserProfileDto {
    #[serde(rename = "displayName")]
    pub display_name: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
}

/// Mirrors nexus-core's CompetencyRecord (competency-engine/index.ts).
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CompetencyRecordDto {
    /// Which body of results this record aggregates (decision D5): "practice"
    /// or "assessment". Part of the record's identity, not a display label.
    pub population: String,
    pub domain: String,
    pub level: String,
    #[serde(rename = "avgScore")]
    pub avg_score: f64,
    #[serde(rename = "recentScore")]
    pub recent_score: f64,
    pub trend: String,
    #[serde(rename = "attemptCount")]
    pub attempt_count: i64,
    pub confidence: f64,
    #[serde(rename = "recentScores")]
    pub recent_scores: Vec<f64>,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
}

/// Mirrors nexus-core's SelectionTrace
/// (`training-engine/delivery.ts`, stored by `persistence/delivery-event-repository.ts`).
///
/// Evidence about one selection decision. It is carried across IPC whole and
/// stored as canonical JSON: the columns beside it hold everything selection
/// needs to query, so the trace stays readable rather than shredded.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SelectionTraceDto {
    pub novelty: String,
    #[serde(rename = "bestNoveltyAvailable")]
    pub best_novelty_available: String,
    #[serde(rename = "crossUserOverExposed")]
    pub cross_user_over_exposed: bool,
    #[serde(rename = "crossUserShare", skip_serializing_if = "Option::is_none")]
    pub cross_user_share: Option<f64>,
    #[serde(rename = "diversityCost")]
    pub diversity_cost: f64,
    #[serde(rename = "poolSize")]
    pub pool_size: i64,
    #[serde(rename = "stratumKey")]
    pub stratum_key: String,
    pub reasons: Vec<String>,
}

/// Mirrors nexus-core's DeliveryEvent (`persistence/delivery-event-repository.ts`).
///
/// One item delivered to one learner in one session (D12 work package 8). The
/// ledger is append-only: there is a command to append and a command to record
/// an answer exactly once, and no command that edits or deletes anything.
///
/// `learner_ref` is pseudonymous. A name or an email arriving in that field
/// would be a privacy defect, not a display choice.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DeliveryEventDto {
    #[serde(rename = "deliveryId")]
    pub delivery_id: String,
    #[serde(rename = "sessionId")]
    pub session_id: String,
    #[serde(rename = "learnerRef")]
    pub learner_ref: String,
    #[serde(rename = "cohortRef", skip_serializing_if = "Option::is_none")]
    pub cohort_ref: Option<String>,
    /// D5: "practice" or "assessment", part of the row's identity.
    pub population: String,
    #[serde(rename = "itemId")]
    pub item_id: String,
    #[serde(rename = "itemRevision")]
    pub item_revision: i64,
    #[serde(rename = "conceptId", skip_serializing_if = "Option::is_none")]
    pub concept_id: Option<String>,
    #[serde(rename = "corpusReleaseId")]
    pub corpus_release_id: String,
    #[serde(rename = "policyVersion")]
    pub policy_version: String,
    #[serde(rename = "envelopeId")]
    pub envelope_id: String,
    #[serde(rename = "tierAtDelivery")]
    pub tier_at_delivery: String,
    pub modality: String,
    #[serde(rename = "difficultyLevel")]
    pub difficulty_level: i64,
    pub jurisdictions: Vec<String>,
    #[serde(rename = "deliveredAt")]
    pub delivered_at: String,
    #[serde(rename = "deliveredOn")]
    pub delivered_on: String,
    #[serde(rename = "slotIndex")]
    pub slot_index: i64,
    #[serde(rename = "answeredChoiceId", skip_serializing_if = "Option::is_none")]
    pub answered_choice_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub correct: Option<bool>,
    #[serde(rename = "answeredAt", skip_serializing_if = "Option::is_none")]
    pub answered_at: Option<String>,
    pub trace: SelectionTraceDto,
}
