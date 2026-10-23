/**
 * Paper name plate of the hero. Text only, so it works without any image asset.
 * Sizes use `cqw` (1% of the width of the portrait stage that contains it), so the plate scales
 * together with the stage on phones; at the desktop stage width (462px) they equal the design's px values.
 */
export function NamePlate({ className = "" }: { className?: string }) {
  return (
    <div className={className}>
      <div className="relative h-full">
        {/* scalloped top edge */}
        <span
          aria-hidden
          className="absolute inset-x-0 -top-[1.73cqw] mx-auto h-[3.46cqw] w-[13.85cqw] rounded-t-full bg-[#f4f1ea]"
        />
        <div className="relative flex h-full flex-col items-center justify-center bg-[#f4f1ea] px-[2.6cqw] text-center shadow-[0_6px_18px_rgba(60,45,20,0.12)]">
          <p className="font-calligraphy text-[2.81cqw] leading-none text-ink">الشيخ</p>
          <p className="mt-[1.73cqw] whitespace-nowrap font-calligraphy text-[3.46cqw] font-bold leading-none text-ink">
            عبد الرحمن النحوي
          </p>
          <span aria-hidden className="mt-[3.46cqw] flex items-center gap-[1.3cqw] text-gold">
            <span className="h-px w-[5.19cqw] bg-gold/70" />
            <span className="h-[1.3cqw] w-[1.3cqw] rotate-45 bg-gold" />
            <span className="h-px w-[5.19cqw] bg-gold/70" />
          </span>
        </div>
      </div>
    </div>
  );
}
