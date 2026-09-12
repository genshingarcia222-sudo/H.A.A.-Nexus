import { Card } from "@haa-nexus/ui-kit";

export interface ComingSoonProps {
  title: string;
  phase: string;
  detail: string;
}

/**
 * Per the design skill's guidance on emptiness: explain what isn't here yet
 * and when it arrives, in the interface's own voice — not a vague "coming
 * soon" sticker.
 */
export function ComingSoon({ title, phase, detail }: ComingSoonProps) {
  return (
    <Card title={title}>
      <p style={{ color: "var(--nexus-color-ink-secondary)", marginTop: 0 }}>
        Scheduled for {phase}. {detail}
      </p>
    </Card>
  );
}
