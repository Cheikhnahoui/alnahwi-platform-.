import { describe, expect, it } from "vitest";
import { resolvePlayer } from "@/lib/media";
import { unplayableSourceErrors } from "@/lib/admin/content-input";

const yt = (id: string, qs = "") => ({
  type: "iframe",
  provider: "youtube",
  src: `https://www.youtube-nocookie.com/embed/${id}${qs}`,
});

describe("resolvePlayer: what can play inside the page", () => {
  it("understands every common YouTube URL shape", () => {
    const id = "dQw4w9WgXcQ";
    for (const url of [
      `https://www.youtube.com/watch?v=${id}`,
      `https://youtube.com/watch?v=${id}&list=PL1`,
      `https://m.youtube.com/watch?v=${id}`,
      `https://youtu.be/${id}`,
      `https://www.youtube.com/embed/${id}`,
      `https://www.youtube.com/shorts/${id}`,
      `https://www.youtube.com/live/${id}`,
      `https://www.youtube-nocookie.com/embed/${id}`,
    ]) {
      expect(resolvePlayer(url, "video"), url).toEqual(yt(id));
    }
  });
  it("keeps a start time, in seconds", () => {
    const id = "dQw4w9WgXcQ";
    expect(resolvePlayer(`https://youtu.be/${id}?t=90`)).toEqual(yt(id, "?start=90"));
    expect(resolvePlayer(`https://www.youtube.com/watch?v=${id}&t=1m30s`)).toEqual(
      yt(id, "?start=90"),
    );
    expect(resolvePlayer(`https://youtu.be/${id}?t=garbage`)).toEqual(yt(id));
  });
  it("understands Vimeo, including unlisted videos with a hash", () => {
    const base = { type: "iframe", provider: "vimeo" };
    expect(resolvePlayer("https://vimeo.com/123456789")).toEqual({
      ...base,
      src: "https://player.vimeo.com/video/123456789",
    });
    expect(resolvePlayer("https://vimeo.com/123456789/abcdef1234")).toEqual({
      ...base,
      src: "https://player.vimeo.com/video/123456789?h=abcdef1234",
    });
    expect(resolvePlayer("https://player.vimeo.com/video/123456789?h=abcdef1234")).toEqual({
      ...base,
      src: "https://player.vimeo.com/video/123456789?h=abcdef1234",
    });
  });
  it("plays direct video and audio files over HTTPS", () => {
    expect(resolvePlayer("https://cdn.example.org/a/lesson.mp4?token=1", "video")).toEqual({
      type: "video",
      src: "https://cdn.example.org/a/lesson.mp4?token=1",
    });
    expect(resolvePlayer("https://cdn.example.org/lesson.WEBM")?.type).toBe("video");
    expect(resolvePlayer("https://cdn.example.org/lesson.mp3", "audio")?.type).toBe("audio");
    expect(resolvePlayer("https://cdn.example.org/lesson.m4a")?.type).toBe("audio");
  });
  it("never embeds anything outside the allow-list", () => {
    for (const url of [
      "http://cdn.example.org/lesson.mp4", // plain HTTP: blocked by browsers on an HTTPS page
      "https://example.org/some-page", // arbitrary page: must stay a link
      "https://www.youtube.com.evil.example/watch?v=dQw4w9WgXcQ", // look-alike host
      "https://evil.example/https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://www.youtube.com/watch?v=short", // not an 11-character id
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ%22onload%3D", // injection attempt
      "https://vimeo.com.evil.example/123456789",
      "javascript:alert(1)",
      "data:text/html,<script>1</script>",
      "not a url",
      "",
    ]) {
      expect(resolvePlayer(url, "video"), url).toBeNull();
    }
    expect(resolvePlayer(null)).toBeNull();
  });
  it("never plays a downloadable file source", () => {
    expect(resolvePlayer("https://cdn.example.org/lesson.mp4", "file")).toBeNull();
  });
});

describe("a source marked video/audio must really play (new or changed links)", () => {
  const src = (kind: "video" | "audio" | "external_link" | "file", url: string) => ({
    kind,
    url,
    sourceName: null,
    isPrimary: true,
    isDownloadable: false,
  });
  it("accepts playable video and audio sources", () => {
    expect(unplayableSourceErrors([src("video", "https://youtu.be/dQw4w9WgXcQ")])).toEqual({});
    expect(unplayableSourceErrors([src("video", "https://cdn.example.org/a.mp4")])).toEqual({});
    expect(unplayableSourceErrors([src("audio", "https://cdn.example.org/a.mp3")])).toEqual({});
  });
  it("rejects video/audio links that cannot be played, naming the field", () => {
    const errs = unplayableSourceErrors([
      src("video", "https://example.org/watch/123"),
      src("video", "https://youtu.be/dQw4w9WgXcQ"),
      src("audio", "http://cdn.example.org/a.mp3"),
    ]);
    expect(Object.keys(errs)).toEqual(["sources.0.url", "sources.2.url"]);
    expect(errs["sources.0.url"]).toMatch(/لا يمكن تشغيله/);
  });
  it("still allows any https page as a plain link or a file", () => {
    expect(unplayableSourceErrors([src("external_link", "https://example.org/watch/123")])).toEqual(
      {},
    );
    expect(unplayableSourceErrors([src("file", "https://example.org/book.pdf")])).toEqual({});
  });
  it("keeps items saved before this rule editable (same kind and URL already stored)", () => {
    const old = [{ kind: "video", url: "https://example.org/old-video-page" }];
    expect(
      unplayableSourceErrors([src("video", "https://example.org/old-video-page")], old),
    ).toEqual({});
    // ...but a NEW unplayable link on the same item is still refused
    expect(
      Object.keys(unplayableSourceErrors([src("video", "https://example.org/other")], old)),
    ).toEqual(["sources.0.url"]);
  });
});
