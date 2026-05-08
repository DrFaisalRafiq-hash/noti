// ============================================================================
// CompileDiffModal
// ----------------------------------------------------------------------------
// Side-by-side panel that shows, for each outline beat from the most recent
// "Compile outline" run, the expanded dialogue/direction cues the AI produced
// for that beat. Read-only — purely a transparency/inspection tool.
// ============================================================================

import { useEffect, useMemo, useState } from "react";
import { GitCompare, X, ArrowRight, ChevronDown, ChevronRight } from "lucide-react";
import {
  diffOutlineToCompiled,
  summarizeDiff,
  type DiffPair,
} from "@/lib/outline-diff";
import type { ScriptSegment } from "@/lib/podcast-script";
import { useSwipeDismiss } from "@/hooks/useSwipeDismiss";
import SheetGrabber from "@/components/SheetGrabber";

interface Props {
  outline: ScriptSegment[];
  expanded: ScriptSegment[];
  onClose: () => void;
}

export default function CompileDiffModal({ outline, expanded, onClose }: Props) {
  const pairs = useMemo(() => diffOutlineToCompiled(outline, expanded), [outline, expanded]);
  const stats = useMemo(() => summarizeDiff(pairs), [pairs]);

  // All beats expanded by default; user can collapse individuals.
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const toggle = (idx: number) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const swipe = useSwipeDismiss({ onClose });

  return (
    <div
      className="fixed inset-0 safe-overlay z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
      onClick={onClose}
      style={swipe.backdropStyle}
    >
      <div
        className="w-full sm:max-w-5xl max-h-[94dvh] bg-paper rounded-t-2xl sm:rounded-2xl shadow-2xl border hairline flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={swipe.sheetProps.style}
      >
        <SheetGrabber {...swipe.handleProps} />
        {/* Header */}
        <div
          className="flex items-center gap-2 px-4 py-3 border-b hairline"
          {...swipe.handleProps}
        >
          <GitCompare className="h-4 w-4 ink-soft" />
          <h2 className="font-display text-sm font-semibold ink">
            Compile diff
          </h2>
          <span className="text-[11px] ink-faint hidden sm:inline">
            How each outline beat was expanded into cues
          </span>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto h-7 w-7 inline-flex items-center justify-center rounded-md ink-soft hover:bg-sunk"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Stats strip */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 border-b hairline bg-sunk text-[11px] ink-soft">
          <span>
            <strong className="ink tabular-nums">{stats.beatsExpanded}</strong>
            <span className="ink-faint"> / {stats.beatsTotal}</span> beats expanded
          </span>
          <span>·</span>
          <span>
            <strong className="ink tabular-nums">{stats.expandedTotal}</strong> output cues
          </span>
          <span>·</span>
          <span>
            <strong className="ink tabular-nums">{stats.dialogueAdded}</strong> dialogue
          </span>
          <span>·</span>
          <span>
            <strong className="ink tabular-nums">{stats.directionAdded}</strong> direction
          </span>
          {stats.unmatched > 0 && (
            <>
              <span>·</span>
              <span className="text-amber-600 dark:text-amber-400">
                {stats.unmatched} unmatched
              </span>
            </>
          )}
        </div>

        {/* Pairs */}
        <div className="flex-1 overflow-y-auto px-2 sm:px-4 py-3 space-y-2">
          {pairs.length === 0 && (
            <div className="text-center text-[12px] ink-faint py-8">
              No diff to display.
            </div>
          )}
          {pairs.map((pair, idx) => (
            <PairRow
              key={idx}
              index={idx}
              pair={pair}
              collapsed={collapsed.has(idx)}
              onToggle={() => toggle(idx)}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-4 py-3 border-t hairline bg-paper">
          <span className="text-[11px] ink-faint">
            Beat → cue mapping is inferred from section headings and order — small
            mismatches can occur if the AI re-titled a section.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-[12px] font-semibold hairline border bg-paper ink hover:bg-sunk transition-smooth"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function PairRow({
  index,
  pair,
  collapsed,
  onToggle,
}: {
  index: number;
  pair: DiffPair;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const isOrphan = pair.outline === null;
  const Chevron = collapsed ? ChevronRight : ChevronDown;

  return (
    <div
      className={
        "rounded-lg border hairline " +
        (isOrphan ? "bg-amber-50/40 dark:bg-amber-950/10" : "bg-sunk")
      }
    >
      {/* Header strip */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-paper/40 transition-smooth rounded-t-lg"
      >
        <Chevron className="h-3.5 w-3.5 ink-faint shrink-0" />
        <span className="text-[10px] tabular-nums ink-faint shrink-0">
          #{index + 1}
        </span>
        <span className="text-[11px] ink truncate flex-1">
          {isOrphan
            ? "Cues with no clear parent beat"
            : pair.outline?.label || pair.outline?.text || "(empty beat)"}
        </span>
        <span className="text-[10px] ink-faint shrink-0">
          {pair.expanded.length} cue{pair.expanded.length === 1 ? "" : "s"}
        </span>
      </button>

      {!collapsed && (
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-2 p-2 pt-0">
          {/* LEFT: outline beat */}
          <div className="rounded-md bg-paper border hairline p-2 min-h-[60px]">
            {isOrphan ? (
              <p className="text-[11px] ink-faint italic">
                These cues didn't align to any outline beat — usually intro /
                outro lines the AI added.
              </p>
            ) : (
              <SegmentCard seg={pair.outline!} variant="outline" />
            )}
          </div>

          {/* Arrow */}
          <div className="hidden md:flex items-center justify-center">
            <ArrowRight className="h-4 w-4 ink-faint" />
          </div>

          {/* RIGHT: expanded cues */}
          <div className="rounded-md bg-paper border hairline p-2 min-h-[60px] space-y-1.5">
            {pair.expanded.length === 0 ? (
              <p className="text-[11px] ink-faint italic">
                Not expanded — the compiler skipped this beat.
              </p>
            ) : (
              pair.expanded.map((s) => (
                <SegmentCard key={s.id} seg={s} variant="expanded" />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SegmentCard({
  seg,
  variant,
}: {
  seg: ScriptSegment;
  variant: "outline" | "expanded";
}) {
  return (
    <div className="text-[11px] leading-snug">
      <div className="flex items-center gap-1.5 mb-0.5">
        <span
          className={
            "px-1 py-0.5 rounded text-[9px] uppercase tracking-wide font-semibold " +
            kindBadgeClass(seg.kind, variant)
          }
        >
          {seg.kind.replace("_", " ")}
        </span>
        {seg.label && (
          <span className="ink font-medium truncate">{seg.label}</span>
        )}
      </div>
      {seg.text && (
        <p className="ink-soft whitespace-pre-wrap break-words">{seg.text}</p>
      )}
    </div>
  );
}

function kindBadgeClass(
  kind: ScriptSegment["kind"],
  variant: "outline" | "expanded"
): string {
  // Subtler tone for outline side, slightly stronger for expanded side.
  const dim = variant === "outline";
  switch (kind) {
    case "dialogue":
      return dim
        ? "bg-foreground/5 ink-soft"
        : "bg-foreground/10 ink";
    case "direction":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
    case "scene_heading":
      return "bg-foreground/10 ink";
    case "transition":
      return "bg-foreground/10 ink-soft";
    case "section":
      return "bg-foreground text-background";
    case "action":
    default:
      return "bg-foreground/5 ink-soft";
  }
}
