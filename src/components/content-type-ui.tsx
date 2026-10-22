import {
  BookOpen,
  FileText,
  Feather,
  Headphones,
  Mic,
  NotepadText,
  type LucideIcon,
} from "lucide-react";

export type TypeUi = {
  Icon: LucideIcon;
  /** Pastel tile (home type shortcuts, thumbnail fallback). */
  tile: { bg: string; fg: string };
  /** Small label on a material card. */
  badge: { bg: string; fg: string };
  /** Icon of the round action button on a material card. */
  action: "play" | "file" | "feather";
};

const NEUTRAL: TypeUi = {
  Icon: FileText,
  tile: { bg: "#ecebe6", fg: "#5c5c5c" },
  badge: { bg: "#efeee9", fg: "#5c5c5c" },
  action: "file",
};

export const TYPE_UI: Record<string, TypeUi> = {
  lecture: {
    Icon: Mic,
    tile: { bg: "#dbe8f0", fg: "#3f78a8" },
    badge: { bg: "#dcece6", fg: "#1f6a57" },
    action: "play",
  },
  lesson: {
    Icon: BookOpen,
    tile: { bg: "#dfefe4", fg: "#2f6b4a" },
    badge: { bg: "#f4e6d3", fg: "#8a6a3d" },
    action: "play",
  },
  audio: {
    Icon: Headphones,
    tile: { bg: "#f5e8d6", fg: "#8a6a3d" },
    badge: { bg: "#f3e7d5", fg: "#7c6136" },
    action: "play",
  },
  research: {
    Icon: FileText,
    tile: { bg: "#e3e5f3", fg: "#5967a0" },
    badge: { bg: "#e4e7f3", fg: "#4a5a8c" },
    action: "file",
  },
  article: {
    Icon: NotepadText,
    tile: { bg: "#f9e0d9", fg: "#b0603f" },
    badge: { bg: "#f9dede", fg: "#9c4b48" },
    action: "file",
  },
  book: { ...NEUTRAL, badge: { bg: "#e9efe0", fg: "#5b6b3a" } },
  participation: { ...NEUTRAL, badge: { bg: "#e6eef5", fg: "#3f6786" }, action: "play" },
  seminar: { ...NEUTRAL, badge: { bg: "#e6eef5", fg: "#3f6786" }, action: "play" },
  poem: {
    Icon: Feather,
    tile: { bg: "#d8efe6", fg: "#1e6a55" },
    badge: { bg: "#d9efe5", fg: "#1e4c41" },
    action: "feather",
  },
};

export function typeUi(key: string): TypeUi {
  return TYPE_UI[key] ?? NEUTRAL;
}
