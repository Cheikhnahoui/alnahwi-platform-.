import { describe, expect, it } from "vitest";
import { buildSearchText, normalizeArabic } from "@/lib/search/arabic";

describe("normalizeArabic", () => {
  it("unifies hamza forms of alef", () => {
    expect(normalizeArabic("أحمد إبراهيم آمن")).toBe("احمد ابراهيم امن");
  });
  it("removes diacritics and tatweel", () => {
    expect(normalizeArabic("الْعِلْمُ")).toBe("العلم");
    expect(normalizeArabic("عـــلم")).toBe("علم");
  });
  it("unifies ya/alef-maqsura and ta marbuta/ha", () => {
    expect(normalizeArabic("مدرسة")).toBe(normalizeArabic("مدرسه"));
    expect(normalizeArabic("هدى")).toBe("هدي");
  });
  it("converts Arabic-Indic digits and keeps Latin text lowercased", () => {
    expect(normalizeArabic("درس ١٢ Fiqh")).toBe("درس 12 fiqh");
  });
  it("collapses whitespace", () => {
    expect(normalizeArabic("  علم   وعمل ")).toBe("علم وعمل");
  });
  it("does not mutate its input", () => {
    const original = "أَصْل";
    normalizeArabic(original);
    expect(original).toBe("أَصْل");
  });
});

describe("buildSearchText", () => {
  it("joins non-empty parts and skips null/undefined", () => {
    expect(buildSearchText("عنوان", null, undefined, "وصف")).toBe("عنوان وصف");
  });
});
