import * as React from "react";
import { cn } from "@/lib/utils";

// Noti "page-bell" — a document with a folded top-right corner and a bell
// glyph centered on the page. This IS the brand mark.
//
// Geometry is authored on a 96-unit viewBox (matches the source SVG spec).
// Stroke widths come from a size→stroke lookup table and are scaled into
// viewBox units so the silhouette stays balanced from 16px favicon to 256px
// hero.
//
// Spec reference (render size px → stroke px at that size):
//   16  → 5.0    20 → 4.5    24 → 3.5    32 → 3.0
//   40  → 2.5    48 → 2.5    64 → 2.0    96 → 2.0
//  128  → 1.75  256 → 1.5
function strokeForSize(size: number): number {
  const lookup: Array<[number, number]> = [
    [16, 5.0],
    [20, 4.5],
    [24, 3.5],
    [32, 3.0],
    [40, 2.5],
    [48, 2.5],
    [64, 2.0],
    [96, 2.0],
    [128, 1.75],
    [256, 1.5],
  ];
  let best = lookup[0];
  let bestDiff = Math.abs(size - best[0]);
  for (const entry of lookup) {
    const d = Math.abs(size - entry[0]);
    if (d < bestDiff) {
      best = entry;
      bestDiff = d;
    }
  }
  const [refSize, refStroke] = best;
  // Scale from "px at refSize" into 96-unit viewBox units.
  return (refStroke * 96) / refSize;
}

export interface NotiBellProps extends Omit<React.SVGProps<SVGSVGElement>, "stroke"> {
  size?: number;
  /** Override the auto stroke width (in viewBox units, 96-unit grid). */
  strokeWidth?: number;
  /** Fills the bell glyph — useful for the "ringing" header bell. */
  filled?: boolean;
}

/**
 * The Noti page-bell: a document with a folded corner and a centered bell.
 * Defaults to 24px with size-aware stroke correction.
 */
export const NotiBell = React.forwardRef<SVGSVGElement, NotiBellProps>(
  (
    {
      size = 24,
      strokeWidth,
      filled = false,
      className,
      color = "currentColor",
      fill,
      ...rest
    },
    ref,
  ) => {
    const sw = strokeWidth ?? strokeForSize(size);
    const bellFill = filled ? (fill ?? color) : "none";
    return (
      <svg
        ref={ref}
        width={size}
        height={size}
        viewBox="0 0 96 96"
        fill="none"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn(className)}
        aria-hidden="true"
        {...rest}
      >
        {/* Page outline with a folded top-right corner (16-unit fold). */}
        <path d="M20 10H60L76 26V86H20V10Z" />
        {/* The fold itself — the corner peel. */}
        <path d="M60 10V26H76" />
        {/* Bell body centered on the page. */}
        <path
          d="M48 38C48 38 38 41 38 54H36C34 54 34 58 36 58H60C62 58 62 54 60 54H58C58 41 48 38 48 38Z"
          fill={bellFill}
        />
        {/* Antenna nub on top of the bell. */}
        <line x1="48" y1="34" x2="48" y2="38" />
        {/* Clapper hanging below. */}
        <path d="M44 58C44 60.2 45.8 62 48 62C50.2 62 52 60.2 52 58" />
      </svg>
    );
  },
);
NotiBell.displayName = "NotiBell";

export default NotiBell;
