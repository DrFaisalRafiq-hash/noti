// Folder colors are a *priority / temperature* scale, not arbitrary hues.
// Read left-to-right (hot → cool): the warmer the swatch, the more urgent.
//
//   rose    → Critical  (hottest red)
//   amber   → High      (orange)
//   teal    → Medium    (warm amber/yellow — kept id="teal" for back-compat)
//   indigo  → Low       (cool blue — kept id="indigo" for back-compat)
//   neutral → None      (gray, no priority)
//
// IDs are preserved so existing folder rows in the database keep their meaning
// even though the visual hue and label have been retuned.
export type FolderColor =
  | "rose"     // Critical
  | "amber"    // High
  | "teal"     // Medium
  | "indigo"   // Low
  | "neutral"; // None

export const FOLDER_COLORS: { id: FolderColor; label: string; hsl: string }[] = [
  { id: "rose",    label: "Critical", hsl: "0 78% 52%" },    // hot red
  { id: "amber",   label: "High",     hsl: "22 88% 52%" },   // orange
  { id: "teal",    label: "Medium",   hsl: "42 92% 50%" },   // warm amber/yellow
  { id: "indigo",  label: "Low",      hsl: "212 70% 52%" },  // cool blue
  { id: "neutral", label: "None",     hsl: "220 8% 55%" },   // neutral gray
];

export function folderHsl(color?: string | null): string {
  return (FOLDER_COLORS.find((c) => c.id === color)?.hsl) || FOLDER_COLORS[0].hsl;
}

export function folderPriorityLabel(color?: string | null): string {
  return FOLDER_COLORS.find((c) => c.id === color)?.label ?? "None";
}

export function folderSwatchStyle(color?: string | null): React.CSSProperties {
  return { backgroundColor: `hsl(${folderHsl(color)})` };
}

export function folderTintStyle(color?: string | null): React.CSSProperties {
  const h = folderHsl(color);
  return {
    backgroundColor: `hsl(${h} / 0.14)`,
    color: `hsl(${h})`,
    borderColor: `hsl(${h} / 0.32)`,
  };
}

export function folderActiveStyle(color?: string | null): React.CSSProperties {
  const h = folderHsl(color);
  return {
    backgroundColor: `hsl(${h})`,
    color: "white",
    borderColor: `hsl(${h})`,
  };
}

/** Returns "critical" for rose, "high" for amber, otherwise null. Used by
 *  components that apply emphasis animations on the most urgent priorities. */
export function priorityEmphasis(color?: string | null): "critical" | "high" | null {
  if (color === "rose") return "critical";
  if (color === "amber") return "high";
  return null;
}

/** Inline CSS variable carrying the priority hue, so the same keyframes can
 *  animate any priority color without per-color classes. */
export function priorityVar(color?: string | null): React.CSSProperties {
  return { ["--prio-h" as any]: folderHsl(color) };
}
