import { useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import { AppShell } from "./components/AppShell.js";
import { Dashboard } from "./routes/Dashboard.js";
import { LiveScribing } from "./routes/LiveScribing.js";
import { Training } from "./routes/Training.js";
import { KnowledgeBase } from "./routes/KnowledgeBase.js";
import { Analytics } from "./routes/Analytics.js";
import { Settings } from "./routes/Settings.js";
import { useProfileStore } from "./store/profileStore.js";
import "./modules.js"; // ensures module registration runs once at startup

export function App() {
  const hydrate = useProfileStore((s) => s.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/live-scribing" element={<LiveScribing />} />
        <Route path="/training" element={<Training />} />
        <Route path="/knowledge-base" element={<KnowledgeBase />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}
