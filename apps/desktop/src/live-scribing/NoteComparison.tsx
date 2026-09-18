import {
  buildNoteComparison,
  type DocumentationDraft,
  type EvaluationResult,
  type NoteComparisonExpectation,
  type NoteComparisonStatus,
  type Scenario
} from "@haa-nexus/nexus-core";
import { Card } from "@haa-nexus/ui-kit";

/**
 * Architecture Package Section 34(10): "Review a note comparison (encounter
 * vs. learner vs. expected)."
 *
 * Shown after submission, beside the score and feedback. It presents what the
 * evaluator already decided - every status comes from the evaluation itself -
 * so the comparison and the feedback list can never tell the learner
 * different things.
 */

const SECTION_LABELS: Record<string, string> = {
  chiefComplaint: "Chief Complaint",
  hpi: "HPI",
  ros: "ROS",
  physicalExam: "Physical Exam",
  assessment: "Assessment",
  plan: "Plan",
  additionalNotes: "Additional Notes"
};

/** Text, not colour, carries the status (the app's accessibility convention). */
const STATUS_LABELS: Record<NoteComparisonStatus, string> = {
  documented: "Documented",
  omission: "Missing",
  incorrect_negative: "Reversed",
  wrong_section: "Wrong section",
  incorrect_terminology: "Lay term"
};

const STATUS_BADGE: Record<NoteComparisonStatus, string> = {
  documented: "nexus-badge nexus-badge--minor",
  omission: "nexus-badge nexus-badge--major",
  incorrect_negative: "nexus-badge nexus-badge--critical",
  wrong_section: "nexus-badge nexus-badge--major",
  incorrect_terminology: "nexus-badge nexus-badge--minor"
};

const cellStyle = {
  verticalAlign: "top" as const,
  padding: "var(--nexus-space-2)",
  borderTop: "1px solid var(--nexus-color-border)",
  fontSize: "var(--nexus-font-size-sm)",
  whiteSpace: "pre-wrap" as const
};

function Expectation({ item }: { item: NoteComparisonExpectation }) {
  return (
    <li style={{ marginBottom: "var(--nexus-space-1)" }}>
      <span className={STATUS_BADGE[item.status]}>{STATUS_LABELS[item.status]}</span>{" "}
      {item.description}
      {item.isPertinentNegative ? " (pertinent negative)" : ""}
      <div style={{ color: "var(--nexus-color-ink-secondary)" }}>from: {item.sourceFact}</div>
    </li>
  );
}

export function NoteComparison({
  scenario,
  draft,
  evaluation
}: {
  scenario: Scenario;
  draft: DocumentationDraft;
  evaluation: EvaluationResult;
}) {
  const rows = buildNoteComparison(scenario, draft, evaluation);

  return (
    <Card title="Note comparison">
      <p style={{ marginTop: 0, fontSize: "var(--nexus-font-size-sm)", color: "var(--nexus-color-ink-secondary)" }}>
        The encounter as it happened, what you documented, and what this scenario required. Statuses
        are the same ones used in your feedback above.
      </p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 640 }}>
          <caption
            style={{
              position: "absolute",
              width: 1,
              height: 1,
              overflow: "hidden",
              clip: "rect(0 0 0 0)",
              whiteSpace: "nowrap"
            }}
          >
            Note comparison by section: encounter, your documentation, and what was required
          </caption>
          <thead>
            <tr>
              {["Section", "Encounter", "Your note", "Expected"].map((h) => (
                <th
                  key={h}
                  scope="col"
                  style={{ textAlign: "left", padding: "var(--nexus-space-2)", fontSize: "var(--nexus-font-size-sm)" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.section}>
                <th scope="row" style={{ ...cellStyle, textAlign: "left", whiteSpace: "nowrap" }}>
                  {SECTION_LABELS[row.section] ?? row.section}
                </th>
                <td style={cellStyle}>
                  {row.encounter || <span style={{ color: "var(--nexus-color-ink-secondary)" }}>—</span>}
                </td>
                <td style={cellStyle}>
                  {row.learner || (
                    <span style={{ color: "var(--nexus-color-ink-secondary)" }}>Nothing documented</span>
                  )}
                </td>
                <td style={cellStyle}>
                  {row.expected.length === 0 ? (
                    <span style={{ color: "var(--nexus-color-ink-secondary)" }}>Nothing required here</span>
                  ) : (
                    <ul style={{ margin: 0, paddingLeft: "var(--nexus-space-3)" }}>
                      {row.expected.map((item) => (
                        <Expectation key={item.requirementId} item={item} />
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
