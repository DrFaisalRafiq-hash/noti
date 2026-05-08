import * as React from "react";
import { cn } from "@/lib/utils";

export interface BellGlyphProps extends Omit<React.SVGProps<SVGSVGElement>, "stroke"> {
  size?: number;
  strokeWidth?: number;
  filled?: boolean;
}

/**
 * Standalone Noti bell glyph — same bell as the brand mark, but without
 * the surrounding page/folded-corner. Used on the lock screen and anywhere
 * we want just the bell ringing.
 *
 * The bell sits inside the original 96-unit grid centered around (48, 48)
 * but has been re-centered to the full viewBox so it scales cleanly at
 * any size.
 */
export const BellGlyph = React.forwardRef<SVGSVGElement, BellGlyphProps>(
  (
    {
      size = 56,
      strokeWidth = 5,
      filled = true,
      className,
      color = "currentColor",
      fill,
      ...rest
    },
    ref,
  ) => {
    const bellFill = filled ? (fill ?? color) : "none";
    return (
      <svg
        ref={ref}
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn(className)}
        aria-hidden="true"
        {...rest}
      >
        {/* Antenna nub on top of the bell. */}
        <line x1="32" y1="9" x2="32" y2="14" />
        {/* Bell body. */}
        <path
          d="M32 14C32 14 18 18 18 38H15C12 38 12 44 15 44H49C52 44 52 38 49 38H46C46 18 32 14 32 14Z"
          fill={bellFill}
        />
        {/* Clapper hanging below. */}
        <path d="M27 44C27 47.3 29.2 50 32 50C34.8 50 37 47.3 37 44" />
      </svg>
    );
  },
);
BellGlyph.displayName = "BellGlyph";

export default BellGlyph;
