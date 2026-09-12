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
