import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  LifeBuoy,
  Loader2,
  Paperclip,
  Search,
  Send,
  Shield,
  ShieldOff,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  PRIORITY_COLOR,
  PRIORITY_LABEL,
  STATUS_COLOR,
  STATUS_LABEL,
  SupportAttachment,
  SupportComment,
  SupportTicket,
  TicketPriority,
  TicketStatus,
  addComment,
  adminListTickets,
  listAttachments,
  listComments,
  updateTicket,
} from "@/lib/support-store";

export default function AdminSupport() {
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "all">("open");
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<SupportTicket | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session) {
        navigate("/auth");
        return;
      }
      const { data: roleData } = await supabase.rpc("has_role", {
        _user_id: data.session.user.id,
        _role: "admin",
      });
      if (cancelled) return;
      setIsAdmin(!!roleData);
      setAuthChecked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  async function load() {
    setLoading(true);
    try {
      const list = await adminListTickets({ status: statusFilter, search });
      setTickets(list);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't load tickets");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isAdmin) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, statusFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: tickets.length, open: 0, in_progress: 0, resolved: 0, closed: 0 };
    tickets.forEach((t) => (c[t.status] = (c[t.status] ?? 0) + 1));
    return c;
  }, [tickets]);

  if (!authChecked) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <ShieldOff className="h-10 w-10 text-muted-foreground" />
        <h1 className="font-display text-2xl">Admins only</h1>
        <Link to="/app" className="rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground">
          Back to Noti
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Link
            to="/admin"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={16} /> Admin home
          </Link>
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <Shield size={14} /> Admin
          </div>
        </div>

        <div className="mb-6 flex items-center gap-3">
          <LifeBuoy size={22} />
          <h1 className="font-display text-3xl font-semibold">Support tickets</h1>
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {(["all", "open", "in_progress", "resolved", "closed"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "h-9 rounded-full border px-3 text-xs font-medium transition-smooth",
                statusFilter === s
                  ? "bg-primary/10 border-primary text-foreground"
                  : "bg-card text-muted-foreground hover:bg-accent",
              )}
            >
              {s === "all" ? "All" : STATUS_LABEL[s as TicketStatus]}
              <span className="ml-1.5 opacity-60">{counts[s] ?? 0}</span>
            </button>
          ))}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              load();
            }}
            className="ml-auto flex h-9 items-center gap-2 rounded-full border bg-card px-3"
          >
            <Search size={14} className="text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ticket #, subject, email"
              className="w-56 bg-transparent text-xs outline-none"
            />
          </form>
        </div>

        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : tickets.length === 0 ? (
          <div className="rounded-2xl border bg-card p-10 text-center text-sm text-muted-foreground">
            No tickets here.
          </div>
        ) : (
          <ul className="divide-y rounded-2xl border bg-card">
            {tickets.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => setActive(t)}
                  className="flex w-full items-start justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-accent"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{t.ticket_number}</span>
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                          STATUS_COLOR[t.status],
                        )}
                      >
                        {STATUS_LABEL[t.status]}
                      </span>
                      <span className={cn("text-[10px] font-medium", PRIORITY_COLOR[t.priority])}>
                        {PRIORITY_LABEL[t.priority]}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-sm font-medium">{t.subject}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {t.user_email ?? t.user_id.slice(0, 8)} · last activity{" "}
                      {new Date(t.last_activity_at).toLocaleString()}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {active && (
        <TicketDrawer
          ticket={active}
          onClose={() => setActive(null)}
          onChanged={() => {
            load();
          }}
        />
      )}
    </div>
  );
}

function TicketDrawer({
  ticket,
  onClose,
  onChanged,
}: {
  ticket: SupportTicket;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [comments, setComments] = useState<SupportComment[]>([]);
  const [attachments, setAttachments] = useState<SupportAttachment[]>([]);
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<TicketStatus>(ticket.status);
  const [priority, setPriority] = useState<TicketPriority>(ticket.priority);

  useEffect(() => {
    setStatus(ticket.status);
    setPriority(ticket.priority);
    (async () => {
      setLoading(true);
      try {
        const [c, a] = await Promise.all([listComments(ticket.id), listAttachments(ticket.id)]);
        setComments(c);
        setAttachments(a);
      } finally {
        setLoading(false);
      }
    })();
  }, [ticket.id]);

  async function patch(p: Partial<{ status: TicketStatus; priority: TicketPriority }>) {
    try {
      await updateTicket(ticket.id, p);
      toast.success("Ticket updated");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function send() {
    if (!reply.trim()) return;
    setSaving(true);
    try {
      await addComment(ticket.id, reply, { isInternal: internal, asAdmin: true });
      setReply("");
      const c = await listComments(ticket.id);
      setComments(c);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't post");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 safe-overlay z-50 flex justify-end bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside className="flex h-full w-full max-w-xl flex-col overflow-y-auto bg-background shadow-xl">
        <div className="sticky top-0 z-10 border-b bg-background px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-xs text-muted-foreground">{ticket.ticket_number}</p>
              <h2 className="mt-1 text-lg font-semibold">{ticket.subject}</h2>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {ticket.user_email ?? ticket.user_id} · created{" "}
                {new Date(ticket.created_at).toLocaleString()}
              </p>
            </div>
            <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">
              Close
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <select
              value={status}
              onChange={(e) => {
                const v = e.target.value as TicketStatus;
                setStatus(v);
                patch({ status: v });
              }}
              className="h-9 rounded-lg border bg-card px-2 text-xs"
            >
              {(["open", "in_progress", "resolved", "closed"] as TicketStatus[]).map((s) => (
                <option key={s} value={s}>
                  Status: {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
            <select
              value={priority}
              onChange={(e) => {
                const v = e.target.value as TicketPriority;
                setPriority(v);
                patch({ priority: v });
              }}
              className="h-9 rounded-lg border bg-card px-2 text-xs"
            >
              {(["low", "normal", "high", "urgent"] as TicketPriority[]).map((p) => (
                <option key={p} value={p}>
                  Priority: {PRIORITY_LABEL[p]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <p className="whitespace-pre-wrap text-sm">{ticket.description}</p>

          {Object.keys(ticket.diagnostics ?? {}).length > 0 && (
            <details className="mt-4 rounded-xl border bg-card p-3 text-xs">
              <summary className="cursor-pointer font-medium">Diagnostics</summary>
              <pre className="mt-2 overflow-auto whitespace-pre-wrap text-[11px] text-muted-foreground">
{JSON.stringify(
  { page_url: ticket.page_url, user_agent: ticket.user_agent, app_version: ticket.app_version, ...ticket.diagnostics },
  null,
  2,
)}
              </pre>
            </details>
          )}

          {attachments.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {attachments.map((a) => (
                <a
                  key={a.id}
                  href={a.signed_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs hover:bg-accent"
                >
                  <Paperclip size={12} />
                  <span className="max-w-[180px] truncate">{a.file_name}</span>
                </a>
              ))}
            </div>
          )}

          <div className="my-5 h-px bg-border" />

          <h3 className="mb-3 text-sm font-semibold">Conversation</h3>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <div className="space-y-3">
              {comments.length === 0 && (
                <p className="text-xs text-muted-foreground">No comments yet.</p>
              )}
              {comments.map((c) => (
                <div
                  key={c.id}
                  className={cn(
                    "rounded-xl border p-3 text-sm",
                    c.is_internal
                      ? "bg-amber-500/10 border-amber-500/30"
                      : c.author_role === "admin"
                        ? "bg-primary/5 border-primary/30"
                        : "bg-card",
                  )}
                >
                  <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="font-medium">
                      {c.author_role === "admin" ? "Admin" : "User"}
                      {c.is_internal && " · internal note"}
                    </span>
                    <span>{new Date(c.created_at).toLocaleString()}</span>
                  </div>
                  <p className="whitespace-pre-wrap">{c.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 border-t bg-background p-4">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={3}
            placeholder={internal ? "Internal note (not visible to user)…" : "Reply to user…"}
            maxLength={4000}
            className="w-full rounded-xl border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <div className="mt-2 flex items-center justify-between">
            <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={internal}
                onChange={(e) => setInternal(e.target.checked)}
              />
              Internal note
            </label>
            <button
              onClick={send}
              disabled={saving || !reply.trim()}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send size={14} />}
              Send
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
