import { useState } from "react";
import { Card } from "@haa-nexus/ui-kit";
import { terminologyRepository } from "../content/scenarios.js";

export function KnowledgeBase() {
  const [query, setQuery] = useState("");
  const results = terminologyRepository.search(query);

  return (
    <div style={{ display: "grid", gap: "var(--nexus-space-3)", maxWidth: 720 }}>
      <h1 style={{ fontSize: "var(--nexus-font-size-xl)", margin: 0 }}>Knowledge Base</h1>

      <input
        aria-label="Search terminology"
        placeholder="Search terminology (e.g. 'dyspnea', 'palpitations')"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{
          padding: "var(--nexus-space-2)",
          border: "1px solid var(--nexus-color-border)",
          borderRadius: "var(--nexus-radius)",
          font: "inherit"
        }}
      />

      {results.length === 0 && (
        <p style={{ color: "var(--nexus-color-ink-secondary)" }}>No terminology entries match that search.</p>
      )}

      <div style={{ display: "grid", gap: "var(--nexus-space-3)" }}>
        {results.map((entry) => (
          <Card key={entry.id} title={`${entry.layTerm} → ${entry.clinicalTerm}`}>
            <p style={{ margin: "0 0 var(--nexus-space-2) 0", fontSize: "var(--nexus-font-size-xs)", color: "var(--nexus-color-ink-secondary)" }}>
              {entry.category}
            </p>
            <p style={{ margin: "0 0 var(--nexus-space-2) 0", fontSize: "var(--nexus-font-size-sm)" }}>{entry.explanation}</p>
            {entry.acceptedAlternatives.length > 0 && (
              <p style={{ margin: 0, fontSize: "var(--nexus-font-size-xs)", color: "var(--nexus-color-ink-secondary)" }}>
                Accepted forms: {entry.acceptedAlternatives.join(", ")}
              </p>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
