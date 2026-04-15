import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

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
