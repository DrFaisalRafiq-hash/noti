interface Props {
  className?: string;
  strokeWidth?: number;
}

/**
 * Variant B — "Folded Crease"
 * A single sheet of paper folded into the silhouette of an N. No
 * letterform, no ornament — just one continuous geometric gesture.
 * Reads as: a thought, captured in one fold.
 */
export default function LogoFold({ className, strokeWidth = 1.5 }: Props) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Outer N silhouette — left bar, diagonal, right bar */}
      <path d="M7 26 V6 L25 26 V6" />
      {/* Inner crease — a faint mirror of the fold */}
      <path d="M9 22 V10 L23 22" opacity="0.35" />
      {/* Single dot at the corner — the moment of capture */}
      <circle cx="25" cy="6" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}
