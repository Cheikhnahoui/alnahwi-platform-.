import { Search } from "lucide-react";
import { HeroPortrait, findPortrait } from "./HeroPortrait";

export function HomeHero() {
  const portrait = findPortrait();
  return (
    <section className="hero-surface relative overflow-hidden border-b border-line">
      <div
        aria-hidden
        className="pattern-lattice absolute inset-y-0 end-0 hidden w-[120px] opacity-[.16] [mask-image:linear-gradient(to_right,#000,transparent)] md:block"
      />
      <div className="relative mx-auto h-full max-w-[1280px] min-[1180px]:h-[281px]">
        <div
          className={`px-4 pt-10 ${portrait ? "pb-6" : "pb-10"} min-[1180px]:absolute min-[1180px]:start-[670px] min-[1180px]:top-[34px] min-[1180px]:w-[372px] min-[1180px]:p-0`}
        >
          <div className="flex h-5 w-full max-w-[340px] items-center justify-center gap-2.5 text-gold">
            <span aria-hidden className="flex items-center">
              <span className="h-px w-9 bg-gold/70" />
              <span className="h-1.5 w-1.5 rotate-45 bg-gold" />
            </span>
            <p className="text-[14px] font-semibold">منصة علمية رقمية</p>
            <span aria-hidden className="flex items-center">
              <span className="h-1.5 w-1.5 rotate-45 bg-gold" />
              <span className="h-px w-9 bg-gold/70" />
            </span>
          </div>
          <h1 className="-mt-0.5 text-[30px] font-bold leading-[44px] text-ink min-[1180px]:text-[36px] min-[1180px]:leading-[52px]">
            العلمُ يُحفظ بِالتوثيق،
            <br />
            ويُنتفعُ به بالنشر
          </h1>
          <p className="mt-1.5 max-w-[340px] text-[14px] leading-[22px] text-[#3b4a4a]">
            منصة تجمع المواد العلمية المتاحة للشيخ عبد الرحمن النحوي، وتنظمها لتيسير الوصول إليها مع
            العناية بالمصادر وحقوق النشر.
          </p>
          <form
            action="/library"
            method="get"
            role="search"
            className="mt-3.5 flex h-9 w-full max-w-[371px] items-center"
          >
            <label htmlFor="hero-search" className="sr-only">
              ابحث في جميع المواد العلمية
            </label>
            <div className="flex h-full min-w-0 flex-1 items-center gap-2 rounded-full bg-white ps-4 pe-6 shadow-[0_1px_5px_rgba(60,45,20,0.10)]">
              <Search aria-hidden size={15} className="shrink-0 text-[#4a5a55]" />
              <input
                id="hero-search"
                name="q"
                type="search"
                maxLength={100}
                placeholder="ابحث في جميع المواد العلمية..."
                className="min-w-0 flex-1 bg-transparent text-[11px] outline-none placeholder:text-[#8a8a85]"
              />
            </div>
            <button
              type="submit"
              className="relative z-10 -ms-5 inline-flex h-full w-[82px] shrink-0 items-center justify-center gap-2 rounded-full bg-brand text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
            >
              <Search aria-hidden size={14} />
              بحث
            </button>
          </form>
        </div>
        {portrait && <HeroPortrait src={portrait} />}
      </div>
    </section>
  );
}
