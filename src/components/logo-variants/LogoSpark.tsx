interface Props {
  className?: string;
  strokeWidth?: number;
}

/**
 * Variant C — "Spark Margin"
 * A notebook margin rule (the red line in a school pad) with a single
 * filled dot blooming into a faint trail of smaller marks — an idea
 * arriving on the page. Light, optimistic, distinctly "Noti".
 */
export default function LogoSpark({ className, strokeWidth = 1.5 }: Props) {
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
      {/* page edge — left margin rule */}
      <path d="M10 5 V27" />
      {/* three ruled lines, descending in length, of decreasing weight */}
      <path d="M14 11 H24" />
      <path d="M14 16 H22" opacity="0.7" />
      <path d="M14 21 H19" opacity="0.45" />
      {/* the spark — one ink dot blooming from the margin */}
      <circle cx="10" cy="11" r="1.4" fill="currentColor" stroke="none" />
      {/* trailing micro-dots */}
      <circle cx="10" cy="16" r="0.7" fill="currentColor" stroke="none" opacity="0.65" />
      <circle cx="10" cy="21" r="0.45" fill="currentColor" stroke="none" opacity="0.4" />
    </svg>
  );
}
