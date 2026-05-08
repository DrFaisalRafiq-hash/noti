import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Apply saved brand palette + theme preference before first paint
try {
  const p = localStorage.getItem("noti-palette") || "forest";
  document.documentElement.setAttribute("data-palette", p);

  // Forest, midnight, and obsidian are dark-mode-locked palettes.
  const darkLocked = p === "forest" || p === "midnight" || p === "obsidian";

  const t = localStorage.getItem("monolith-theme");
  const isDark =
    darkLocked ||
    t === "dark" ||
    ((t === "system" || !t) && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
} catch {}

createRoot(document.getElementById("root")!).render(<App />);

// Fade out the brand splash once React has painted.
// Hold a minimum visible time so the logo isn't a flash on fast loads.
const SPLASH_MIN_MS = 3200;
const splashStart = performance.now();
function dismissSplash() {
  const el = document.getElementById("noti-splash");
  if (!el) return;
  const wait = Math.max(0, SPLASH_MIN_MS - (performance.now() - splashStart));
  setTimeout(() => {
    el.classList.add("noti-splash-hide");
    setTimeout(() => el.remove(), 500);
  }, wait);
}
requestAnimationFrame(() => requestAnimationFrame(dismissSplash));
