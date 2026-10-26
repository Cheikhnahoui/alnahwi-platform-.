/**
 * The Sheikh's name in calligraphy with a small gold ornament, placed directly on the hero background
 * (no card behind it). Text only, so it works without any image asset.
 * Sizes use `cqw` (1% of the width of the portrait stage that contains it), so the name scales
 * together with the stage on phones; at the desktop stage width (462px) they equal the design's px values.
 */
export function NamePlate({ className = "" }: { className?: string }) {
  return (
    <div className={className}>
      <div className="flex h-full flex-col items-center justify-center px-0 text-center">
        <p className="font-calligraphy text-[4.2cqw] font-bold leading-none text-ink">د. الشيخ</p>
        <p className="mt-[2.2cqw] whitespace-nowrap font-calligraphy text-[5cqw] font-bold leading-none text-ink">
          عبد الرحمن النحوي
        </p>
        <span aria-hidden className="mt-[4cqw] flex items-center gap-[1.3cqw] text-gold">
          <span className="h-px w-[5.19cqw] bg-gold/70" />
          <span className="h-[1.3cqw] w-[1.3cqw] rotate-45 bg-gold" />
          <span className="h-px w-[5.19cqw] bg-gold/70" />
        </span>
      </div>
    </div>
  );
}
