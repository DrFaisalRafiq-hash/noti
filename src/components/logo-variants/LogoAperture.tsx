interface Props {
  className?: string;
  strokeWidth?: number;
}

/**
 * Variant A — "Aperture N"
 * A serif-inspired N inscribed inside a soft-cornered page. Reads
 * editorial / quietly confident. The diagonal doubles as the page's
 * fold line, so the letter and the notebook are one gesture.
 */
export default function LogoAperture({ className, strokeWidth = 1.5 }: Props) {
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
      {/* page with a soft outer frame */}
      <rect x="6" y="5" width="20" height="22" rx="3" />
      {/* the N — left stem, diagonal, right stem */}
      <path d="M11 22 V11" />
      <path d="M11 11 L21 22" />
      <path d="M21 22 V11" />
      {/* tiny serif feet — the editorial whisper */}
      <path d="M9.5 11 H12.5" opacity="0.7" />
      <path d="M19.5 11 H22.5" opacity="0.7" />
    </svg>
  );
}
