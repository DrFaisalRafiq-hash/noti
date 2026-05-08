import { cn } from "@/lib/utils";
import { haptic } from "@/lib/notes-store";
import { Archive } from "lucide-react";

export type ArchiveScope = "active" | "archived" | "all";

const OPTIONS: { value: ArchiveScope; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
  { value: "all", label: "All" },
];

interface Props {
  value: ArchiveScope;
  onChange: (v: ArchiveScope) => void;
  archivedCount?: number;
  className?: string;
  /** Hide the leading "Show" label (useful in tight rows). */
  compact?: boolean;
}

/**
 * Small segmented chip group to switch between Active / Archived / All
 * items. Used by the Notes feed, Tasks feed, Scripts feed and Documents
 * view so users can surface previously archived items without leaving
 * the current screen.
 */
export default function ArchiveScopeChips({
  value,
  onChange,
  archivedCount,
  className,
  compact,
}: Props) {
  return (
    <div
      className={cn(
        "flex gap-1.5 items-center overflow-x-auto -mx-1 px-1 pb-1",
        className,
      )}
    >
      {!compact && (
        <span className="text-[10px] uppercase tracking-[0.18em] ink-faint font-medium pr-1 flex-shrink-0 inline-flex items-center gap-1">
          <Archive className="h-3 w-3" strokeWidth={1.75} />
          Show
        </span>
      )}
      {OPTIONS.map((opt) => {
        const active = value === opt.value;
        const showCount = opt.value === "archived" && typeof archivedCount === "number";
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => {
              if (active) return;
              haptic.light();
              onChange(opt.value);
            }}
            className={cn(
              "h-8 sm:h-7 px-3 rounded-full text-[12px] sm:text-[11px] font-medium border transition-smooth flex-shrink-0 inline-flex items-center gap-1.5",
              active
                ? "bg-foreground text-background border-foreground"
                : "bg-paper hairline ink-soft hover:bg-sunk",
            )}
            aria-pressed={active}
          >
            {opt.label}
            {showCount && archivedCount! > 0 && (
              <span
                className={cn(
                  "min-w-[16px] h-[16px] px-1 rounded-full text-[10px] font-semibold tabular-nums inline-flex items-center justify-center border",
                  active
                    ? "bg-background text-foreground border-foreground"
                    : "bg-foreground text-background border-paper",
                )}
              >
                {archivedCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
