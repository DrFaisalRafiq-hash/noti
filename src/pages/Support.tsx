import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, LifeBuoy, Loader2, Send, Paperclip } from "lucide-react";
import NotiWordmark from "@/components/NotiWordmark";
import SupportTicketForm from "@/components/SupportTicketForm";
import {
  PRIORITY_COLOR,
  PRIORITY_LABEL,
  STATUS_COLOR,
  STATUS_LABEL,
  SupportAttachment,
  SupportComment,
  SupportTicket,
  addComment,
  getTicketByNumber,
  listAttachments,
  listComments,
} from "@/lib/support-store";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function Support() {
  const [params, setParams] = useSearchParams();
  const initial = params.get("t") ?? "";
  const [tab, setTab] = useState<"submit" | "lookup">(initial ? "lookup" : "submit");
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => setAuthed(!!sess));
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-dvh bg-paper text-ink">
      <header className="border-b hairline">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link to="/" className="inline-flex items-center gap-2 ink-soft hover:ink">
            <ArrowLeft size={16} /> Back
          </Link>
          <NotiWordmark size="sm" />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-6 flex items-center gap-3">
          <LifeBuoy size={22} />
          <h1 className="text-3xl font-semibold tracking-tight">Support</h1>
        </div>
        <p className="ink-soft mb-8 text-sm">
          We're a small team — we read every ticket. Average reply time is under a day.
        </p>

        {/* Tabs */}
        <div className="mb-6 inline-flex rounded-full border bg-sunk p-1 hairline">
          <button
            onClick={() => setTab("submit")}
            className={cn(
              "h-9 rounded-full px-4 text-sm font-medium transition-smooth",
              tab === "submit" ? "bg-paper ink shadow-soft" : "ink-soft",
            )}
          >
            Submit a ticket
          </button>
          <button
            onClick={() => setTab("lookup")}
            className={cn(
              "h-9 rounded-full px-4 text-sm font-medium transition-smooth",
              tab === "lookup" ? "bg-paper ink shadow-soft" : "ink-soft",
            )}
          >
            Check ticket status
          </button>
        </div>

        {tab === "submit" ? (
          authed === null ? (
            <Loader2 className="h-5 w-5 animate-spin ink-soft" />
          ) : authed ? (
            <SupportTicketForm />
          ) : (
            <div className="rounded-2xl border bg-sunk p-6 text-center hairline">
              <p className="text-sm ink">Sign in to submit a support ticket.</p>
              <Link
                to="/auth"
                className="mt-3 inline-flex h-10 items-center rounded-full bg-primary px-5 text-sm text-primary-foreground"
              >
                Sign in
              </Link>
            </div>
          )
        ) : (
          <LookupPanel
            initial={initial}
            onLooked={(num) => setParams(num ? { t: num } : {}, { replace: true })}
          />
        )}
      </main>
    </div>
  );
}

function LookupPanel({
  initial,
  onLooked,
}: {
  initial: string;
  onLooked: (num: string) => void;
}) {
  const [number, setNumber] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [comments, setComments] = useState<SupportComment[]>([]);
  const [attachments, setAttachments] = useState<SupportAttachment[]>([]);
  const [reply, setReply] = useState("");
  const [posting, setPosting] = useState(false);

  async function load(n: string) {
    if (!n.trim()) return;
    setLoading(true);
    setTicket(null);
    try {
      const t = await getTicketByNumber(n);
      if (!t) {
        toast.error("Ticket not found, or you don't have access");
        onLooked("");
        return;
      }
      setTicket(t);
      onLooked(t.ticket_number);
      const [c, a] = await Promise.all([listComments(t.id), listAttachments(t.id)]);
      setComments(c.filter((x) => !x.is_internal));
      setAttachments(a);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't load ticket");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initial) load(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function send() {
    if (!ticket || !reply.trim()) return;
    setPosting(true);
    try {
      await addComment(ticket.id, reply);
      setReply("");
      const c = await listComments(ticket.id);
      setComments(c.filter((x) => !x.is_internal));
      toast.success("Reply posted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't post reply");
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          load(number);
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={number}
          onChange={(e) => setNumber(e.target.value.toUpperCase())}
          placeholder="NOTI-000123"
          className="h-11 flex-1 rounded-xl border bg-paper px-3 font-mono text-sm hairline focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <button
          type="submit"
          disabled={loading || !number.trim()}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Look up
        </button>
      </form>

      {ticket && (
        <article className="rounded-2xl border bg-paper p-5 hairline">
          <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-mono text-xs ink-soft">{ticket.ticket_number}</p>
              <h2 className="mt-1 text-lg font-semibold">{ticket.subject}</h2>
              <p className="mt-1 text-[11px] ink-soft">
                Submitted {new Date(ticket.created_at).toLocaleString()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[11px] font-medium",
                  STATUS_COLOR[ticket.status],
                )}
              >
                {STATUS_LABEL[ticket.status]}
              </span>
              <span
                className={cn("text-[11px] font-medium", PRIORITY_COLOR[ticket.priority])}
              >
                {PRIORITY_LABEL[ticket.priority]}
              </span>
            </div>
          </header>

          <p className="whitespace-pre-wrap text-sm ink">{ticket.description}</p>

          {attachments.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {attachments.map((a) => (
                <a
                  key={a.id}
                  href={a.signed_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border bg-sunk px-2.5 py-1 text-xs ink hover:bg-paper"
                >
                  <Paperclip size={12} />
                  <span className="max-w-[180px] truncate">{a.file_name}</span>
                </a>
              ))}
            </div>
          )}

          <div className="my-5 h-px bg-border" />

          <h3 className="mb-3 text-sm font-semibold ink">Conversation</h3>
          <div className="space-y-3">
            {comments.length === 0 ? (
              <p className="text-xs ink-soft">No replies yet.</p>
            ) : (
              comments.map((c) => (
                <div
                  key={c.id}
                  className={cn(
                    "rounded-xl border p-3 text-sm hairline",
                    c.author_role === "admin"
                      ? "bg-primary/5 border-primary/30"
                      : "bg-sunk",
                  )}
                >
                  <div className="mb-1 flex items-center justify-between text-[11px] ink-soft">
                    <span className="font-medium">
                      {c.author_role === "admin" ? "Noti support" : "You"}
                    </span>
                    <span>{new Date(c.created_at).toLocaleString()}</span>
                  </div>
                  <p className="whitespace-pre-wrap ink">{c.body}</p>
                </div>
              ))
            )}
          </div>

          {ticket.status !== "closed" && (
            <div className="mt-4 space-y-2">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                rows={3}
                placeholder="Add a reply…"
                className="w-full rounded-xl border bg-paper px-3 py-2 text-sm hairline focus:outline-none focus:ring-2 focus:ring-primary/40"
                maxLength={4000}
              />
              <button
                onClick={send}
                disabled={posting || !reply.trim()}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send size={14} />}
                Send reply
              </button>
            </div>
          )}
        </article>
      )}
    </div>
  );
}
