import { Link } from "react-router-dom";
import { Card } from "@haa-nexus/ui-kit";

/**
 * The catch-all route.
 *
 * Without one, an unknown path rendered nothing at all: no message, and - worse
 * - no navigation rail, because the rail lives in the shell layout and an
 * unmatched path matched no layout either. A learner who mistyped a URL, or
 * followed a link to a route that has since moved, lost every way back except
 * editing the address bar.
 *
 * It sits inside `AppShell` for exactly that reason, so the rail survives. It
 * renders no reference content, so it needs no closed-book gate - and it must
 * stay that way: adding terminology, lessons or question content here would put
 * reference material on an ungated route, which the D4 enforcement scan would
 * catch.
 */
export function NotFound() {
  return (
    <div style={{ display: "grid", gap: "var(--nexus-space-3)", maxWidth: 720 }}>
      <Card title="That page does not exist">
        <p style={{ margin: 0, fontSize: "var(--nexus-font-size-sm)" }}>
          The address you followed does not match anything in Nexus. Nothing was lost, and any
          attempt you had in progress is untouched.
        </p>
        <p
          style={{
            margin: "var(--nexus-space-2) 0 0 0",
            fontSize: "var(--nexus-font-size-sm)"
          }}
        >
          <Link to="/">Return to the dashboard</Link>, or pick a module from the navigation.
        </p>
      </Card>
    </div>
  );
}
