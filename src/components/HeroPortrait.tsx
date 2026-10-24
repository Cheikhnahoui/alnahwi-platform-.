import { existsSync } from "node:fs";
import path from "node:path";
import { NamePlate } from "./NamePlate";

/**
 * Official portrait slot. The picture is only shown when a file named
 * public/images/sheikh-portrait.(webp|png|jpg) exists, i.e. once an official,
 * permitted photograph is supplied (a cut-out with transparent background
 * gives the intended look). Nothing is shown otherwise.
 */
const CANDIDATES = ["webp", "png", "jpg"] as const;

export function findPortrait(): string | null {
  for (const ext of CANDIDATES) {
    const file = `sheikh-portrait.${ext}`;
    if (existsSync(path.join(process.cwd(), "public", "images", file))) return `/images/${file}`;
  }
  return null;
}

/**
 * Arch frame + portrait + name plate as ONE composition (462 x 281 in the design). Everything inside
 * is placed in percentages, so the same composition sits at its exact desktop position (right of the
 * hero text, from 1180px up) and simply scales down to fit phones and tablets, below the text.
 * The parts use physical left/top on purpose: the composition itself does not mirror.
 */
export function HeroPortrait({ src }: { src: string }) {
  return (
    <div className="relative mx-auto mt-6 aspect-[462/281] w-[calc(100%-2rem)] max-w-[462px] [container-type:inline-size] min-[1180px]:absolute min-[1180px]:bottom-0 min-[1180px]:start-[96px] min-[1180px]:mx-0 min-[1180px]:mt-0 min-[1180px]:w-[462px]">
      {/* Arched gold frame (decorative) */}
      <svg
        aria-hidden
        className="absolute bottom-0 left-0 h-[95%] w-[61.26%] text-gold"
        viewBox="0 0 283 267"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      >
        <path d="M1 267V101H24C60 92 110 60 141 0C172 60 222 92 259 101H282V267" />
      </svg>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="صورة الشيخ عبد الرحمن النحوي"
        className="absolute bottom-0 left-0 h-full w-[68.83%] object-cover object-top"
      />
      <NamePlate className="absolute left-[70.56%] top-[25.27%] h-[39.15%] w-[29.44%]" />
    </div>
  );
}
