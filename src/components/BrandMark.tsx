/**
 * Provisional emblem (eight-point interlaced star). It is a placeholder for the
 * official identity and must be replaced once the Sheikh's team approves a logo.
 */
export function BrandMark({ size = 36, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="9" y="9" width="30" height="30" />
      <rect x="9" y="9" width="30" height="30" transform="rotate(45 24 24)" />
      <path d="M24 4v10M24 34v10M4 24h10M34 24h10" />
      <rect x="16" y="16" width="16" height="16" transform="rotate(45 24 24)" strokeWidth="2.2" />
      <circle cx="24" cy="24" r="3.2" />
    </svg>
  );
}
