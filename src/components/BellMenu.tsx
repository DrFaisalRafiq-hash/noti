import * as React from "react";
import { format, addMinutes, addHours, startOfTomorrow, set as setTime } from "date-fns";
import { Check, Clock, CalendarClock, ExternalLink, X, MoreHorizontal } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Bell, Shield, Settings as SettingsIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { haptic, relativeTime, type Note } from "@/lib/notes-store";
import { bodyToPlainText } from "@/lib/rich-text";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { toast } from "sonner";

type BellMenuProps = {
  notes: Note[];
  reminderCount: number;
  /** Open the note in the viewer. */
  onOpenNote: (note: Note) => void;
  /** Patch a note (used for snooze/reschedule/done). */
  onUpdateNote: (id: string, patch: Partial<Note>) => Promise<unknown> | void;
  /** Soft-delete (dismiss = remove from reminder feed). */
  onDeleteNote: (id: string) => Promise<unknown> | void;
  /** Jump to the full Reminders filter view. */
  onSeeAll: () => void;
};

/** A single row in the notification center with quick actions. */
function NotificationRow({
  note,
  onOpen,
  onUpdate,
  onDismiss,
  onReschedule,
}: {
  note: Note;
  onOpen: () => void;
  onUpdate: (patch: Partial<Note>) => void;
  onDismiss: () => void;
  onReschedule: () => void;
}) {
  const due = note.remind_at ? new Date(note.remind_at) : null;
  const now = Date.now();
  const overdue = due ? due.getTime() < now : false;
  const dueSoon = due ? due.getTime() - now < 30 * 60 * 1000 && !overdue : false;

  const snooze = (minutes: number, label: string) => {
    const base = due && due.getTime() > now ? due : new Date();
    const next = addMinutes(base, minutes);
    onUpdate({ remind_at: next.toISOString(), fired: false });
    toast(`Snoozed ${label}`);
    haptic.light();
  };

  const snoozeUntilTomorrow = () => {
    const t = setTime(startOfTomorrow(), { hours: 9, minutes: 0, seconds: 0, milliseconds: 0 });
    onUpdate({ remind_at: t.toISOString(), fired: false });
    toast("Snoozed until tomorrow 9 AM");
    haptic.light();
  };

  return (
    <li className="group px-3 py-2.5 rounded-xl hover:bg-sunk transition-smooth">
      <button
        type="button"
        onClick={onOpen}
        className="w-full text-left flex items-start gap-2.5"
      >
        <span
          className={cn(
            "mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0",
            overdue
              ? "bg-[hsl(75_25%_38%)]"
              : dueSoon
                ? "bg-[hsl(75_25%_38%)]/60"
                : "bg-foreground/30",
          )}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[13px] font-medium ink truncate">
              {note.title || bodyToPlainText(note.text).split("\n")[0] || "Untitled"}
            </p>
            <span className="text-[10px] uppercase tracking-[0.14em] ink-faint flex-shrink-0">
              {due
                ? overdue
                  ? `${relativeTime(due.toISOString())} late`
                  : format(due, "MMM d · h:mm a")
                : "—"}
            </span>
          </div>
          {note.text && note.title && (
            <p className="text-[12px] ink-soft truncate mt-0.5">
              {bodyToPlainText(note.text).split("\n")[0]}
            </p>
          )}
        </div>
      </button>

      {/* Quick action row */}
      <div className="mt-2 flex items-center gap-1 pl-4">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onUpdate({ done: true });
            toast("Marked done");
            haptic.medium();
          }}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium ink-soft hover:bg-paper hover:ink transition-smooth"
          title="Mark done"
        >
          <Check className="h-3 w-3" /> Done
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium ink-soft hover:bg-paper hover:ink transition-smooth"
              title="Snooze"
            >
              <Clock className="h-3 w-3" /> Snooze
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="bg-paper">
            <DropdownMenuLabel className="text-[11px] uppercase tracking-[0.14em] ink-faint">
              Snooze for
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={() => snooze(10, "10 minutes")}>10 minutes</DropdownMenuItem>
            <DropdownMenuItem onClick={() => snooze(30, "30 minutes")}>30 minutes</DropdownMenuItem>
            <DropdownMenuItem onClick={() => snooze(60, "1 hour")}>1 hour</DropdownMenuItem>
            <DropdownMenuItem onClick={() => snooze(60 * 3, "3 hours")}>3 hours</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={snoozeUntilTomorrow}>
              Tomorrow morning
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onReschedule();
          }}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium ink-soft hover:bg-paper hover:ink transition-smooth"
          title="Reschedule"
        >
          <CalendarClock className="h-3 w-3" /> Reschedule
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium ink-soft hover:bg-paper hover:ink transition-smooth"
          title="Open note"
        >
          <ExternalLink className="h-3 w-3" /> Open
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          className="ml-auto inline-flex items-center justify-center h-6 w-6 rounded-lg ink-faint hover:bg-paper hover:ink transition-smooth"
          aria-label="Dismiss"
          title="Dismiss"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </li>
  );
}

export function BellMenu({
  notes,
  reminderCount,
  onOpenNote,
  onUpdateNote,
  onDeleteNote,
  onSeeAll,
}: BellMenuProps) {
  const [open, setOpen] = React.useState(false);
  const isAdmin = useIsAdmin();
  const [reschedulingId, setReschedulingId] = React.useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = React.useState<Date | undefined>();
  const [rescheduleTime, setRescheduleTime] = React.useState("09:00");

  // Build the feed: any active reminder/meeting that isn't done/archived/deleted.
  const items = React.useMemo(() => {
    return notes
      .filter(
        (n) =>
          !n.deleted_at &&
          !n.archived &&
          !n.done &&
          (n.mode === "reminder" || n.mode === "meeting") &&
          !!n.remind_at,
      )
      .sort((a, b) => {
        const ta = new Date(a.remind_at!).getTime();
        const tb = new Date(b.remind_at!).getTime();
        return ta - tb;
      });
  }, [notes]);

  const overdueCount = items.filter(
    (n) => n.remind_at && new Date(n.remind_at).getTime() < Date.now(),
  ).length;

  const beginReschedule = (note: Note) => {
    const base = note.remind_at ? new Date(note.remind_at) : new Date();
    setReschedulingId(note.id);
    setRescheduleDate(base);
    setRescheduleTime(format(base, "HH:mm"));
  };

  const commitReschedule = () => {
    if (!reschedulingId || !rescheduleDate) return;
    const [h, m] = rescheduleTime.split(":").map(Number);
    const next = setTime(rescheduleDate, {
      hours: h || 0,
      minutes: m || 0,
      seconds: 0,
      milliseconds: 0,
    });
    onUpdateNote(reschedulingId, { remind_at: next.toISOString(), fired: false });
    toast(`Rescheduled to ${format(next, "MMM d · h:mm a")}`);
    haptic.medium();
    setReschedulingId(null);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={() => haptic.light()}
          aria-label={`Notifications${reminderCount ? ` (${reminderCount})` : ""}`}
          title="Notifications"
          className="relative h-12 w-12 sm:h-10 sm:w-10 rounded-full bg-paper hairline border flex items-center justify-center transition-smooth hover:bg-sunk shadow-soft motion-reduce:animate-none animate-bell-glow"
        >
          <Bell
            size={20}
            strokeWidth={2}
            className="origin-top motion-reduce:animate-none animate-bell-ring"
            fill="hsl(75 25% 38%)"
            color="hsl(75 25% 38%)"
          />
          {reminderCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-medium text-background flex items-center justify-center"
              style={{ backgroundColor: "hsl(75 25% 38%)" }}
            >
              {reminderCount > 9 ? "9+" : reminderCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="center"
        side="bottom"
        sideOffset={12}
        collisionPadding={16}
        className="w-[min(360px,calc(100vw-2rem))] p-0 bg-paper border hairline shadow-soft"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b hairline">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] ink-faint font-medium">
              Notifications
            </p>
            <p className="text-[13px] ink mt-0.5">
              {items.length === 0
                ? "All clear"
                : overdueCount > 0
                  ? `${overdueCount} overdue · ${items.length} total`
                  : `${items.length} upcoming`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onSeeAll();
            }}
            className="text-[11px] uppercase tracking-[0.14em] ink-soft hover:ink transition-smooth"
          >
            See all
          </button>
        </div>

        {/* Reschedule inline panel */}
        {reschedulingId ? (
          <div className="p-4 space-y-3">
            <p className="text-[12px] ink-soft">Pick a new time</p>
            <Calendar
              mode="single"
              selected={rescheduleDate}
              onSelect={setRescheduleDate}
              initialFocus
              className={cn("p-3 pointer-events-auto rounded-xl bg-sunk")}
            />
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={rescheduleTime}
                onChange={(e) => setRescheduleTime(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl bg-sunk hairline border text-[13px] ink"
              />
              <button
                type="button"
                onClick={() => setReschedulingId(null)}
                className="px-3 py-2 rounded-xl text-[12px] font-medium ink-soft hover:bg-sunk transition-smooth"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={commitReschedule}
                className="px-3 py-2 rounded-xl text-[12px] font-medium text-background"
                style={{ backgroundColor: "hsl(75 25% 38%)" }}
              >
                Save
              </button>
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <Bell size={32} strokeWidth={1.5} className="mx-auto ink-faint" />
            <p className="text-[13px] ink-soft mt-3">No reminders due</p>
            <p className="text-[11px] ink-faint mt-1">
              You're all caught up.
            </p>
          </div>
        ) : (
          <ul className="max-h-[60dvh] overflow-y-auto p-1.5">
            {items.slice(0, 12).map((note) => (
              <NotificationRow
                key={note.id}
                note={note}
                onOpen={() => {
                  setOpen(false);
                  onOpenNote(note);
                }}
                onUpdate={(patch) => onUpdateNote(note.id, patch)}
                onDismiss={() => {
                  onDeleteNote(note.id);
                  toast("Dismissed");
                  haptic.light();
                }}
                onReschedule={() => beginReschedule(note)}
              />
            ))}
          </ul>
        )}

        {!reschedulingId && (
          <div className="border-t hairline p-1.5 space-y-0.5">
            {/* Settings is surfaced here on mobile because the gear button
                is hidden in the header to save space. Visible everywhere
                so it's discoverable. */}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                // Allow popover close animation a tick before opening sheet
                setTimeout(
                  () => window.dispatchEvent(new Event("noti:open-settings")),
                  60,
                );
              }}
              className="sm:hidden w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-[13px] font-medium ink-soft hover:bg-sunk hover:ink transition-smooth"
            >
              <SettingsIcon className="h-4 w-4" strokeWidth={1.75} />
              Settings
            </button>
            {isAdmin && (
              <Link
                to="/admin"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-[13px] font-medium ink-soft hover:bg-sunk hover:ink transition-smooth"
              >
                <Shield className="h-4 w-4" strokeWidth={1.75} />
                Admin portal
              </Link>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default BellMenu;
