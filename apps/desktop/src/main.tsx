import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import "@haa-nexus/ui-kit/src/theme.css";
import "@haa-nexus/ui-kit/src/components.css";
import { App } from "./App.js";
import { useEntitlementStore } from "./store/entitlementStore.js";
import { previewSubscription } from "./preview/previewEntitlement.js";

// The website previews the highest tier so implemented paid features are
// visible without a subscription system. It resolves through the real
// capability matrix, and is a no-op outside the browser build.
useEntitlementStore.getState().setSubscription(previewSubscription());

// HashRouter, not BrowserRouter: Tauri serves the app from a local
// asset root without a server-side fallback for deep links.
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);
