/**
 * Rotation safety tests
 * ---------------------
 * jsdom can't truly render a device, but we can simulate iPad rotation by
 * swapping window.innerWidth/innerHeight + visualViewport, dispatching the
 * matching events, and asserting that:
 *   1. `useViewportHeight` re-reports the new height (no stale fixed values).
 *   2. The brand splash markup uses orientation-agnostic sizing (vmin) and
 *      includes safe-area padding on every side.
 *   3. Page chrome (Index/Landing) uses dynamic-viewport min heights so it
 *      never overflows on a short landscape iPad viewport.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { useViewportHeight } from "@/hooks/useViewportHeight";

type Size = { w: number; h: number };
const PORTRAIT: Size = { w: 820, h: 1180 };   // iPad Air portrait
const LANDSCAPE: Size = { w: 1180, h: 820 };  // iPad Air landscape

function setViewport({ w, h }: Size) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: w });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: h });
  // Force the hook's fallback path (innerHeight) by leaving visualViewport
  // unset — replacing it after mount would orphan the captured listener.
  Object.defineProperty(window, "visualViewport", {
    configurable: true,
    value: undefined,
  });
}

function rotate(size: Size) {
  setViewport(size);
  act(() => {
    window.dispatchEvent(new Event("resize"));
    window.dispatchEvent(new Event("orientationchange"));
  });
}

describe("rotation safety", () => {
  beforeEach(() => setViewport(PORTRAIT));
  afterEach(() => setViewport(PORTRAIT));

  it("useViewportHeight tracks portrait → landscape rotation", () => {
    const { result } = renderHook(() => useViewportHeight());
    expect(result.current).toBe(PORTRAIT.h);

    rotate(LANDSCAPE);
    expect(result.current).toBe(LANDSCAPE.h);

    rotate(PORTRAIT);
    expect(result.current).toBe(PORTRAIT.h);
  });

  it("brand splash markup is orientation-agnostic", () => {
    const html = readFileSync(resolve(__dirname, "../../index.html"), "utf8");

    // Splash stage is sized off the smaller axis so it stays square in any
    // orientation — never `vw` or fixed pixel widths.
    expect(html).toMatch(/\.noti-stage[\s\S]*?width:\s*min\([^)]*vmin/);
    expect(html).not.toMatch(/\.noti-stage[\s\S]*?width:\s*\d+vw/);

    // Splash root pads all four safe-area insets so a rotated iPad never
    // clips the mark behind the dynamic island or home indicator.
    const splashBlock = html.match(/#noti-splash\s*\{[\s\S]*?\}/)?.[0] ?? "";
    expect(splashBlock).toMatch(/safe-area-inset-top/);
    expect(splashBlock).toMatch(/safe-area-inset-bottom/);
    expect(splashBlock).toMatch(/safe-area-inset-left/);
    expect(splashBlock).toMatch(/safe-area-inset-right/);

    // No CSS orientation lock anywhere in the document head.
    expect(html).not.toMatch(/screen\.orientation\.lock/);
  });

  it("manifest does not lock orientation", () => {
    const manifest = JSON.parse(
      readFileSync(resolve(__dirname, "../../public/manifest.webmanifest"), "utf8")
    );
    expect(["any", "natural"]).toContain(manifest.orientation);
  });

  it("page chrome uses dynamic-viewport units (no fixed h-screen / 100vh)", () => {
    const files = [
      "../pages/Index.tsx",
      "../pages/Landing.tsx",
      "../pages/Auth.tsx",
      "../components/NoteViewer.tsx",
      "../components/Composer.tsx",
    ];
    for (const rel of files) {
      const src = readFileSync(resolve(__dirname, rel), "utf8");
      // Tailwind `min-h-screen` collapses to 100vh which is buggy on iPad
      // landscape with the floating URL bar — we should be on `min-h-dvh`.
      expect(
        src,
        `${rel} should not use min-h-screen (use min-h-dvh)`
      ).not.toMatch(/\bmin-h-screen\b/);
      // Hard 100vh literals would survive rotation badly too.
      expect(src, `${rel} should not hard-code 100vh`).not.toMatch(/\b100vh\b/);
    }
  });

  it("shared modal primitives cap height to dvh", () => {
    const dialog = readFileSync(resolve(__dirname, "../components/ui/dialog.tsx"), "utf8");
    const drawer = readFileSync(resolve(__dirname, "../components/ui/drawer.tsx"), "utf8");
    const sheet = readFileSync(resolve(__dirname, "../components/ui/sheet.tsx"), "utf8");
    expect(dialog).toMatch(/100dvh/);
    expect(drawer).toMatch(/100dvh/);
    expect(sheet).toMatch(/100dvh/);
    // And carry safe-area insets so rotating doesn't push content off-screen.
    expect(dialog).toMatch(/safe-area-inset-left/);
    expect(sheet).toMatch(/safe-area-inset-left/);
  });
});
