import { useEffect, useState } from "react";

/**
 * Returns the visual viewport height in pixels, shrinking when the on-screen
 * keyboard (iPad/iOS, desktop touch keyboards, virtual keyboards) covers part
 * of the layout. Falls back to window.innerHeight when visualViewport is
 * unavailable. Use as `style={{ height: vh }}` on fullscreen sheets so editors
 * never get hidden behind the keyboard.
 */
export function useViewportHeight(): number {
  const [vh, setVh] = useState<number>(() =>
    typeof window === "undefined"
      ? 0
      : window.visualViewport?.height ?? window.innerHeight
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    const update = () => {
      setVh(vv?.height ?? window.innerHeight);
    };
    update();
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  return vh;
}
