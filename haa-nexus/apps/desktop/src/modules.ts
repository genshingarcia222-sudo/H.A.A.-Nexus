import { ModuleRegistry, type NexusModule } from "@haa-nexus/nexus-core";
import type { ComponentType } from "react";
import { LiveScribing } from "./routes/LiveScribing.js";

export const moduleRegistry = new ModuleRegistry<ComponentType>();

const liveScribingModule: NexusModule<ComponentType> = {
  id: "live-scribing",
  title: "Live Scribing",
  scenarioSchemaVersion: "0.0.0-unbuilt", // real scenario engine arrives Phase 2
  workspaceComponent: LiveScribing,
  competencyDomains: [
    "Chief Complaint",
    "HPI",
    "ROS",
    "Physical Examination",
    "Terminology",
    "Accuracy",
    "Completeness",
    "Relevance",
    "Pertinent Positives/Negatives",
    "Assessment",
    "Plan",
    "Time Efficiency"
  ]
};

moduleRegistry.register(liveScribingModule);
