import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import posthog from "posthog-js";
import App from "./App.tsx";
import "./index.css";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  tracesSampleRate: 1.0,
});

if (import.meta.env.VITE_POSTHOG_KEY) {
  posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
    api_host: import.meta.env.VITE_POSTHOG_HOST || "https://app.posthog.com",
    autocapture: true,
  });
}

// App version — updated at build time via Vite's define
const APP_VERSION = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";
const VERSION_KEY = "erp-app-version";

// Version check: if stored version differs, clear localStorage and reload
const storedVersion = localStorage.getItem(VERSION_KEY);
if (storedVersion && storedVersion !== APP_VERSION) {
  // Preserve auth-related keys
  const authKey = localStorage.getItem("sb-cjmoecedmsguxewyhdie-auth-token");
  localStorage.clear();
  if (authKey) localStorage.setItem("sb-cjmoecedmsguxewyhdie-auth-token", authKey);
  localStorage.setItem(VERSION_KEY, APP_VERSION);
  window.location.reload();
} else {
  localStorage.setItem(VERSION_KEY, APP_VERSION);
}

// Guard: never register SW inside iframes or preview hosts
const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
})();

const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

if (isPreviewHost || isInIframe) {
  navigator.serviceWorker?.getRegistrations().then((registrations) => {
    registrations.forEach((r) => r.unregister());
  });
}

createRoot(document.getElementById("root")!).render(<App />);
