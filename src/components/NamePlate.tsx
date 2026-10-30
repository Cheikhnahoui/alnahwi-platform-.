/**
 * The Sheikh's name next to the portrait, in the site's clear Arabic font (bold, upright), placed
 * directly on the hero background with a small gold ornament. Text only, no image asset.
 * Sizes use `cqw` (1% of the width of the portrait stage that contains it), so the name scales
 * together with the stage on phones and desktop.
 */
export function NamePlate({ className = "" }: { className?: string }) {
  return (
    <div className={className}>
      <div className="flex h-full flex-col items-center justify-center text-center">
        <p className="font-sans text-[5cqw] font-bold not-italic leading-[1.3] text-ink">د. الشيخ</p>
        <p className="mt-[0.6cqw] font-sans text-[6cqw] font-bold not-italic leading-[1.3] text-ink">
          عبد الرحمن
          <br />
          النحوي
        </p>
        <span aria-hidden className="mt-[2.4cqw] flex items-center gap-[1.3cqw] text-gold">
          <span className="h-px w-[5.19cqw] bg-gold/70" />
          <span className="h-[1.3cqw] w-[1.3cqw] rotate-45 bg-gold" />
          <span className="h-px w-[5.19cqw] bg-gold/70" />
        </span>
      </div>
    </div>
  );
}
