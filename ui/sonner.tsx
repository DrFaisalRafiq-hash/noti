import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * Sonner wrapper that keeps stacked toasts above the safe-area + on-screen
 * keyboard, and re-anchors when the iPad rotates. We track the gap between
 * the visualViewport bottom and the layout viewport so toasts ride above
 * the keyboard, then add the home-indicator inset on top of that.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    const update = () => {
      if (!vv) return setKeyboardOffset(0);
      const layoutH = window.innerHeight;
      const visibleBottom = vv.height + vv.offsetTop;
      // Anything hidden below the visual viewport (keyboard, accessory bar).
      setKeyboardOffset(Math.max(0, layoutH - visibleBottom));
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

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      // Bottom-center keeps toasts off the composer's right-side action rail
      // and is symmetric across portrait/landscape rotation.
      position="bottom-center"
      offset={16}
      style={
        {
          // Lift the entire stack above the keyboard + home indicator. Sonner
          // reads `--offset` from its container; we override it dynamically.
          "--offset-bottom": `calc(${keyboardOffset}px + env(safe-area-inset-bottom) + 16px)`,
          "--offset-top": "calc(env(safe-area-inset-top) + 16px)",
          "--offset-left": "calc(env(safe-area-inset-left) + 16px)",
          "--offset-right": "calc(env(safe-area-inset-right) + 16px)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
