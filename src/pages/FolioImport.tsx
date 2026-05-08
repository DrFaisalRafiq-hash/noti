import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  FOLIO_SS_KEY,
  FolioImportError,
  decodeFolioPayloadParam,
  folioPayloadSchema,
  folioPayloadToScript,
  formatZodIssues,
  renderPageBody,
  renderPanelText,
  type FolioPayload,
} from "@/lib/folio-import";
import { serializeScript } from "@/lib/podcast-script";
import { useStore } from "@/lib/notes-store";
import NotiWordmark from "@/components/NotiWordmark";
import { NotiMark } from "@/components/brand/NotiMark";
import { toast } from "sonner";
import { Loader2, BookOpen, ArrowRight, Eye, EyeOff, ClipboardPaste } from "lucide-react";

type Mode = "entry" | "confirm";

export default function FolioImport({ mode }: { mode: Mode }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { createFolder, createNote, updateNote, refresh } = useStore();

  const [payload, setPayload] = useState<FolioPayload | null>(null);
  const [error, setError] = useState<{ title: string; message: string; detail?: string } | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [importing, setImporting] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [pasteValue, setPasteValue] = useState("");
  const noParams =
    mode === "entry" && !params.get("source") && !params.get("payload");

  const handlePasteSubmit = () => {
    setError(null);
    const v = pasteValue.trim();
    if (!v) {
      setError({ title: "Nothing to import", message: "Paste a Folio link or JSON payload to continue." });
      return;
    }
    let raw = v;
    // Accept full URLs by extracting ?payload=...
    try {
      if (/^https?:\/\//i.test(v)) {
        const u = new URL(v);
        const p = u.searchParams.get("payload");
        if (!p) {
          setError({
            title: "Link is missing a payload",
            message: "That URL doesn't contain a Folio payload parameter.",
          });
          return;
        }
        raw = p;
      }
    } catch {
      // Fall through and treat as raw payload
    }
    try {
      // If it looks like JSON, parse directly; otherwise let decode handle it.
      const obj = raw.trim().startsWith("{")
        ? JSON.parse(raw)
        : decodeFolioPayloadParam(raw);
      const parsed = folioPayloadSchema.safeParse(obj);
      if (!parsed.success) {
        setError({
          title: "Payload doesn't match Folio's format",
          message: "Some required fields are missing or have the wrong type.",
          detail: formatZodIssues(parsed.error),
        });
        return;
      }
      setPayload(parsed.data);
    } catch (e) {
      if (e instanceof FolioImportError) {
        setError({
          title:
            e.code === "base64"
              ? "Corrupted link"
              : e.code === "json"
              ? "Invalid JSON"
              : "Couldn't read payload",
          message: e.message,
          detail: e.detail,
        });
      } else {
        setError({
          title: "Couldn't read payload",
          message: (e as Error)?.message ?? "Unknown error",
        });
      }
    }
  };


  // Parse / load payload
  useEffect(() => {
    if (mode === "entry") {
      const source = params.get("source");
      const raw = params.get("payload");
      // No params at all → show the manual paste form rather than an error.
      if (!source && !raw) {
        return;
      }
      if (!raw) {
        setError({
          title: "Missing payload",
          message:
            "This import link is incomplete — it didn't include a payload parameter. Try sending it again from Folio.",
        });
        return;
      }
      if (source !== "folio") {
        setError({
          title: "Unrecognized source",
          message: `Expected source="folio" but got ${source ? `"${source}"` : "no source"}.`,
        });
        return;
      }
      try {
        const obj = decodeFolioPayloadParam(raw);
        const parsed = folioPayloadSchema.safeParse(obj);
        if (!parsed.success) {
          setError({
            title: "Payload doesn't match Folio's format",
            message:
              "Some required fields are missing or have the wrong type. Ask Folio to regenerate the link.",
            detail: formatZodIssues(parsed.error),
          });
          return;
        }
        setPayload(parsed.data);
      } catch (e) {
        if (e instanceof FolioImportError) {
          setError({
            title:
              e.code === "base64"
                ? "Corrupted link"
                : e.code === "json"
                ? "Invalid JSON"
                : "Couldn't read payload",
            message: e.message,
            detail: e.detail,
          });
        } else {
          setError({
            title: "Couldn't read payload",
            message: "An unexpected error occurred while reading the Folio payload.",
            detail: (e as Error)?.message,
          });
        }
      }
    } else {
      // confirm mode — read from sessionStorage
      const raw = sessionStorage.getItem(FOLIO_SS_KEY);
      if (!raw) {
        setError({
          title: "No pending import",
          message:
            "We couldn't find a saved Folio import. Open the original link from Folio again to retry.",
        });
        return;
      }
      try {
        const parsed = folioPayloadSchema.safeParse(JSON.parse(raw));
        if (!parsed.success) {
          setError({
            title: "Stored payload is invalid",
            message: "The saved Folio import doesn't match the expected format.",
            detail: formatZodIssues(parsed.error),
          });
          return;
        }
        setPayload(parsed.data);
      } catch (e) {
        setError({
          title: "Couldn't read saved import",
          message: "The saved Folio payload couldn't be parsed as JSON.",
          detail: (e as Error)?.message,
        });
      }
    }
  }, [mode, params]);

  // Auth check
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthed(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthed(!!session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // If logged out on entry → stash & redirect to auth
  useEffect(() => {
    if (mode !== "entry") return;
    if (authed === null || !payload) return;
    if (!authed) {
      sessionStorage.setItem(FOLIO_SS_KEY, JSON.stringify(payload));
      navigate("/auth?next=/import/confirm", { replace: true });
    }
  }, [mode, authed, payload, navigate]);

  const totals = useMemo(() => {
    if (!payload) return { pages: 0, panels: 0 };
    return {
      pages: payload.pages.length,
      panels: payload.pages.reduce((n, p) => n + p.panels.length, 0),
    };
  }, [payload]);

  const handleImport = async () => {
    if (!payload || importing) return;
    setImporting(true);
    try {
      const folder = await createFolder(`📖 ${payload.book.title}`, "amber");
      // Synopsis note
      if (payload.book.synopsis) {
        const n = await createNote({
          title: `${payload.book.title} — Synopsis`,
          text: payload.book.synopsis,
          mode: "note",
          folder_id: folder.id,
        });
        await updateNote(n.id, { tags: ["folio", "imported"], pinned: true });
      }
      // One comic-script note covering the whole book — round-trips cleanly
      // back to Folio because the editor preserves the page/panel structure.
      const script = folioPayloadToScript(payload);
      const scriptNote = await createNote({
        title: payload.book.title,
        text: serializeScript(script),
        mode: "script",
        folder_id: folder.id,
      });
      await updateNote(scriptNote.id, { tags: ["folio", "imported"], pinned: true });

      // Also drop one plain-text page note per page so the user can browse them
      // individually if they prefer the legacy view.
      for (const page of payload.pages) {
        const n = await createNote({
          title: `Page ${page.index + 1}`,
          text: renderPageBody(page),
          mode: "note",
          folder_id: folder.id,
        });
        await updateNote(n.id, { tags: ["folio", "imported"] });
      }
      await refresh();
      sessionStorage.removeItem(FOLIO_SS_KEY);
      toast.success(`Imported "${payload.book.title}" from Folio`);
      if (payload.returnUrl) {
        window.location.href = payload.returnUrl;
      } else {
        navigate(`/app?folder=${folder.id}`, { replace: true });
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Import failed");
      setImporting(false);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col items-center bg-background">
      <header className="w-full max-w-2xl flex items-center gap-2 px-5 py-4">
        <NotiMark className="h-6 w-6 text-foreground" />
        <NotiWordmark className="h-5" />
      </header>

      <main className="w-full max-w-2xl px-5 pb-10 flex-1">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-3">
            <BookOpen className="h-3.5 w-3.5" />
            Import from Folio
          </div>

          {error && (
            <div className="space-y-3">
              <h1 className="text-xl font-semibold text-foreground">{error.title}</h1>
              <p className="text-sm text-muted-foreground">{error.message}</p>
              {error.detail && (
                <pre className="whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground font-mono max-h-48 overflow-auto">
                  {error.detail}
                </pre>
              )}
              <Link
                to="/app"
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                Back to Noti <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}

          {!error && !payload && noParams && (
            <div className="space-y-4">
              <div>
                <h1 className="text-xl font-semibold text-foreground">
                  Import a Folio comic script
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Paste a "Send to Noti" link from{" "}
                  <a
                    href="https://folioart.app"
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline underline-offset-2"
                  >
                    folioart.app
                  </a>
                  , or paste the raw JSON payload. We'll create a folder with one
                  comic-script note and per-page notes you can edit in Noti.
                </p>
              </div>
              <textarea
                value={pasteValue}
                onChange={(e) => setPasteValue(e.target.value)}
                placeholder="https://noti-time.com/import?source=folio&payload=…"
                rows={5}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground font-mono placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                <Link
                  to="/app"
                  className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-accent transition-colors"
                >
                  Cancel
                </Link>
                <button
                  type="button"
                  onClick={handlePasteSubmit}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <ClipboardPaste className="h-4 w-4" />
                  Load payload
                </button>
              </div>
            </div>
          )}

          {!error && !payload && !noParams && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Reading payload…
            </div>
          )}

          {!error && payload && authed && (
            <div className="space-y-5">
              <div>
                <h1 className="text-2xl font-semibold text-foreground">{payload.book.title}</h1>
                {payload.book.synopsis && (
                  <p className="mt-2 text-sm text-muted-foreground line-clamp-4">
                    {payload.book.synopsis}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Stat label="Pages" value={totals.pages} />
                <Stat label="Panels" value={totals.panels} />
              </div>

              <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                A new folder <span className="font-medium text-foreground">📖 {payload.book.title}</span>{" "}
                will be created in Noti with one note per page. Notes will be tagged{" "}
                <span className="font-medium text-foreground">folio</span> so you can tell where they came from.
              </div>

              <div className="rounded-lg border border-border bg-background overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowReview((v) => !v)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium text-foreground hover:bg-accent transition-colors"
                  aria-expanded={showReview}
                >
                  <span className="inline-flex items-center gap-2">
                    {showReview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    {showReview ? "Hide review" : "Review what will be created"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {totals.pages} page{totals.pages === 1 ? "" : "s"} · {totals.panels} panel{totals.panels === 1 ? "" : "s"}
                  </span>
                </button>
                {showReview && (
                  <div className="border-t border-border max-h-[420px] overflow-y-auto divide-y divide-border">
                    {payload.pages.map((page) => (
                      <div key={page.index} className="p-3 space-y-2">
                        <div className="text-xs uppercase tracking-wider text-muted-foreground">
                          Page {page.index + 1}
                          {page.panels.length > 0 && (
                            <span className="ml-2 normal-case tracking-normal text-muted-foreground/80">
                              · {page.panels.length} panel{page.panels.length === 1 ? "" : "s"}
                            </span>
                          )}
                        </div>
                        {page.panels.length === 0 ? (
                          <p className="text-xs text-muted-foreground italic">No panels on this page.</p>
                        ) : (
                          <ol className="space-y-2">
                            {page.panels.map((panel, i) => {
                              const text = renderPanelText(panel).trim();
                              return (
                                <li
                                  key={i}
                                  className="rounded-md border border-border bg-muted/30 px-2.5 py-2 text-xs"
                                >
                                  <div className="font-medium text-foreground mb-1">Panel {i + 1}</div>
                                  {text ? (
                                    <pre className="whitespace-pre-wrap font-sans text-foreground/90 leading-relaxed">
                                      {text}
                                    </pre>
                                  ) : (
                                    <span className="text-muted-foreground italic">Empty panel</span>
                                  )}
                                </li>
                              );
                            })}
                          </ol>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                <Link
                  to="/app"
                  className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-accent transition-colors"
                >
                  Cancel
                </Link>
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={importing}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
                >
                  {importing && <Loader2 className="h-4 w-4 animate-spin" />}
                  {importing ? "Creating…" : "Create Noti project"}
                </button>
              </div>
            </div>
          )}

          {!error && payload && authed === false && mode === "confirm" && (
            <div className="text-sm text-muted-foreground">
              Please <Link to="/auth?next=/import/confirm" className="text-primary underline">sign in</Link> to finish your Folio import.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="text-2xl font-semibold tabular-nums text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
    </div>
  );
}
