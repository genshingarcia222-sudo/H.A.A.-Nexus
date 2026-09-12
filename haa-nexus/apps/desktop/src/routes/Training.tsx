import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Card, Button } from "@haa-nexus/ui-kit";
import type { TrainingLesson } from "@haa-nexus/nexus-core";
import { lessonRepository } from "../content/scenarios.js";

export function Training() {
  const location = useLocation();
  const initialLessonId = (location.state as { lessonId?: string } | null)?.lessonId ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(initialLessonId);
  const lessons = lessonRepository.list();
  const selected = selectedId ? lessonRepository.get(selectedId) : null;

  if (selected) {
    return <LessonViewer lesson={selected} onBack={() => setSelectedId(null)} />;
  }

  return (
    <div style={{ display: "grid", gap: "var(--nexus-space-3)", maxWidth: 720 }}>
      <h1 style={{ fontSize: "var(--nexus-font-size-xl)", margin: 0 }}>Training</h1>
      {lessons.map((lesson) => (
        <Card key={lesson.id} title={lesson.title}>
          <p style={{ margin: "0 0 var(--nexus-space-2) 0", fontSize: "var(--nexus-font-size-xs)", color: "var(--nexus-color-ink-secondary)" }}>
            {lesson.category}
          </p>
          <Button variant="secondary" onClick={() => setSelectedId(lesson.id)}>
            Open lesson
          </Button>
        </Card>
      ))}
    </div>
  );
}

function LessonViewer({ lesson, onBack }: { lesson: TrainingLesson; onBack: () => void }) {
  return (
    <div style={{ display: "grid", gap: "var(--nexus-space-3)", maxWidth: 720 }}>
      <Button variant="secondary" onClick={onBack}>
        ← Back to Training
      </Button>

      <Card title={lesson.title}>
        <p style={{ margin: 0 }}>{lesson.explanation}</p>
      </Card>

      {lesson.examples.length > 0 && (
        <Card title="Examples">
          <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
            {lesson.examples.map((example, i) => (
              <li key={i} style={{ fontSize: "var(--nexus-font-size-sm)", marginBottom: "var(--nexus-space-1)" }}>
                {example}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {lesson.knowledgeChecks.length > 0 && (
        <Card title="Knowledge Checks">
          <div style={{ display: "grid", gap: "var(--nexus-space-3)" }}>
            {lesson.knowledgeChecks.map((check, i) => (
              <KnowledgeCheckItem key={i} question={check.question} options={check.options} correctOptionIndex={check.correctOptionIndex} />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function KnowledgeCheckItem({
  question,
  options,
  correctOptionIndex
}: {
  question: string;
  options: string[];
  correctOptionIndex: number;
}) {
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <div>
      <p style={{ margin: "0 0 var(--nexus-space-2) 0", fontSize: "var(--nexus-font-size-sm)", fontWeight: 600 }}>{question}</p>
      <div style={{ display: "grid", gap: "var(--nexus-space-1)" }}>
        {options.map((option, i) => {
          const isSelected = selected === i;
          const isCorrect = i === correctOptionIndex;
          const showResult = selected !== null;
          return (
            <button
              key={i}
              onClick={() => setSelected(i)}
              className="nexus-btn nexus-btn--secondary"
              style={{
                textAlign: "left",
                borderColor: showResult && isSelected ? (isCorrect ? "var(--nexus-color-accent)" : "var(--nexus-color-critical)") : undefined,
                background: showResult && isCorrect ? "var(--nexus-color-accent-muted)" : undefined
              }}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}
