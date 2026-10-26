/**
 * The official logo of the platform (arch, open book and portrait, with the name and the verse),
 * as supplied by the owner: public/images/logo.webp, background removed so it sits on any light surface.
 * Decorative here: the name is always written beside it as text, so the image has an empty alt.
 * Give it a height (for example h-[54px]); the width follows the picture.
 */
export function BrandLogo({ className = "" }: { className?: string }) {
  return (
    // A fixed local file with known proportions, so a plain <img> is enough (no optimiser needed).
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/images/logo.webp"
      alt=""
      width={400}
      height={376}
      decoding="async"
      className={`w-auto ${className}`}
    />
  );
}
