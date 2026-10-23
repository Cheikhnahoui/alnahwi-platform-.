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
function findPortrait(): string | null {
  for (const ext of CANDIDATES) {
    const file = `sheikh-portrait.${ext}`;
    if (existsSync(path.join(process.cwd(), "public", "images", file))) {
      return `/images/${file}`;
    }
  }
  return null;
}
export function HeroPortrait() {
  const src = findPortrait();
  if (!src) return null;
  return (
    <div
      aria-hidden={false}
      className="pointer-events-none absolute inset-0"
    >
      {/* Arched gold frame (decorative) */}
      <svg
        aria-hidden
        className="absolute bottom-0 start-[clamp(8px,20vw,275px)] h-[clamp(180px,22vw,267px)] w-[clamp(190px,24vw,283px)] text-gold"
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
        className="absolute bottom-0 start-[clamp(0px,17.5vw,240px)] h-[clamp(190px,23.5vw,281px)] w-[clamp(190px,26.5vw,318px)] object-contain object-bottom"
      />
      <NamePlate className="absolute start-[clamp(8px,7vw,96px)] top-[clamp(16px,6vw,71px)] h-[clamp(75px,9.2vw,110px)] w-[clamp(95px,11.4vw,136px)]" />
    </div>
  );
}