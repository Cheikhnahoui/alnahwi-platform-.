/** Paper name plate of the hero. Text only, so it works without any image asset. */
export function NamePlate({ className = "" }: { className?: string }) {
  return (
    <div className={`relative ${className}`}>
      {/* scalloped top edge */}
      <span
        aria-hidden
        className="absolute inset-x-0 -top-2 mx-auto h-4 w-16 rounded-t-[40px] bg-[#f4f1ea]"
      />
      <div className="relative flex h-full flex-col items-center justify-center bg-[#f4f1ea] px-3 text-center shadow-[0_6px_18px_rgba(60,45,20,0.12)]">
        <p className="font-calligraphy text-[13px] leading-none text-ink">الشيخ</p>
        <p className="mt-2 whitespace-nowrap font-calligraphy text-[16px] font-bold leading-none text-ink">
          عبد الرحمن النحوي
        </p>
        <span aria-hidden className="mt-4 flex items-center gap-1.5 text-gold">
          <span className="h-px w-6 bg-gold/70" />
          <span className="h-1.5 w-1.5 rotate-45 bg-gold" />
          <span className="h-px w-6 bg-gold/70" />
        </span>
      </div>
    </div>
  );
}
