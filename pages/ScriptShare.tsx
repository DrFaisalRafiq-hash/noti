import { useEffect, useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Eye, FileText, Copy, AlertCircle, Presentation, Clock, TimerOff, Lock, Unlock, Loader2, Eye as EyeOpen, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { readShareFromHash, decryptBody, resolvePendingBody } from "@/lib/script-share";
import PasteShareLink from "@/components/PasteShareLink";
import { parseScript, scriptToPlainText, type PodcastScript, type ScriptSegment } from "@/lib/podcast-script";
import { estimateScriptSeconds, formatDuration } from "@/lib/script-timing";
import ScriptReader from "@/components/ScriptReader";
import { cn } from "@/lib/utils";

function formatAt(ms: number): string {
  try {
    return new Date(ms).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return new Date(ms).toISOString();
  }
}

function formatRelative(diffMs: number): string {
  const abs = Math.abs(diffMs);
  const sec = Math.round(abs / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.round(hr / 24);
  return `${day}d`;
}

/**
 * Public read-only view for a shared script.
 *
 * The full script is encoded in the URL hash, so this page works without
 * authentication and without any backend call. It shows a clean reading
 * layout plus a one-click "Reader" (teleprompter) launcher and a copy
 * button. Editing is intentionally not available here.
 */
export default function ScriptShare() {
  const [hash, setHash] = useState<string>(() => window.location.hash);
  const [readerOpen, setReaderOpen] = useState(false);
  // Tick once a minute so the "expires in N" copy stays roughly fresh and the
  // page transitions to the expired state without a manual refresh.
  const [now, setNow] = useState<number>(() => Date.now());
  // For password-protected links, the decrypted script is held in memory
  // only — never persisted, never sent anywhere.
  const [unlockedScript, setUnlockedScript] = useState<PodcastScript | null>(null);

  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  const decoded = useMemo(() => readShareFromHash(hash), [hash]);
  // v2 gzip-plaintext payloads need an async inflate step before the body
  // becomes a parsed script. Resolve once per decode and stash the result.
  const [inflatedScript, setInflatedScript] = useState<PodcastScript | null>(null);
  useEffect(() => {
    setInflatedScript(null);
    if (!decoded || decoded.script || decoded.encrypted) return;
    if (!(decoded.payload as any)._pendingBody) return;
    let cancelled = false;
    resolvePendingBody(decoded).then((res) => {
      if (!cancelled) setInflatedScript(res.script);
    }).catch(() => { /* leave as null — handled below */ });
    return () => { cancelled = true; };
  }, [decoded]);

  if (!decoded) {
    // Distinguish "no link pasted yet" from "link is broken" so the empty
    // state reads as an importer rather than an error message.
    const hasToken = /(?:^|[#&])s=/.test(hash);
    return (
      <div className="min-h-dvh bg-background ink flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-paper hairline border rounded-2xl p-6 text-center">
          <div className="mx-auto h-12 w-12 inline-flex items-center justify-center rounded-full bg-sunk mb-3">
            <AlertCircle className="h-6 w-6 ink-soft" />
          </div>
          <div className="text-base font-semibold mb-1">
            {hasToken ? "This link is empty or broken" : "Open a shared script"}
          </div>
          <div className="text-sm ink-faint mb-4">
            {hasToken
              ? "The script payload couldn't be decoded from this URL. Ask the sender to copy a fresh link, or paste a different one below."
              : "Paste a Noti share link to view the script in read-only mode. The script lives in the link itself — nothing is uploaded."}
          </div>
          <PasteShareLink />
          <div className="mt-4">
            <RouterLink
              to="/"
              className="text-xs ink-faint underline hover:ink"
            >
              Back to home
            </RouterLink>
          </div>
        </div>
      </div>
    );
  }

  const { payload, encrypted } = decoded;
  const exp = typeof payload.exp === "number" ? payload.exp : null;
  const expired = exp !== null && now >= exp;

  if (expired) {
    return (
      <div className="min-h-dvh bg-background ink flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-paper hairline border rounded-2xl p-6 text-center">
          <div className="mx-auto h-12 w-12 inline-flex items-center justify-center rounded-full bg-sunk mb-3">
            <TimerOff className="h-6 w-6 ink-soft" />
          </div>
          <div className="text-base font-semibold mb-1">This shared link has expired</div>
          <div className="text-sm ink-faint mb-1">
            It expired {formatRelative(now - (exp as number))} ago
            {" "}({formatAt(exp as number)}).
          </div>
          <div className="text-sm ink-faint mb-4">
            Ask the sender to generate a fresh link.
          </div>
          <RouterLink
            to="/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-foreground text-background hover:opacity-90"
          >
            Back to home
          </RouterLink>
        </div>
      </div>
    );
  }

  // Encrypted link — gate behind the unlock screen until the viewer enters
  // the right passphrase. Once unlocked we keep the parsed script in memory.
  const script: PodcastScript | null = encrypted
    ? unlockedScript
    : (decoded.script ?? inflatedScript);
  if (encrypted && !script) {
    return (
      <UnlockGate
        title={(payload.title || "Untitled script").trim()}
        hint={payload.enc?.hint}
        exp={exp}
        now={now}
        onUnlock={async (pass) => {
          if (!payload.enc) return false;
          const plain = await decryptBody(payload.enc, pass);
          if (!plain) return false;
          const parsed = parseScript(plain);
          if (!parsed) return false;
          setUnlockedScript(parsed);
          return true;
        }}
      />
    );
  }
  if (!script) {
    // v2 gzip-plaintext link: body is still inflating. Show a tiny spinner so
    // the viewer doesn't see a blank page during the (sub-second) decode.
    return (
      <div className="min-h-dvh bg-background ink flex items-center justify-center p-6">
        <div className="inline-flex items-center gap-2 text-sm ink-faint">
          <Loader2 className="h-4 w-4 animate-spin" /> Decoding shared script…
        </div>
      </div>
    );
  }

  const title = (payload.title || script.brief.topic || "Untitled script").trim();
  const totalSec = estimateScriptSeconds(script.segments);
  const wordCount = script.segments.reduce(
    (n, s) => n + (s.text || "").trim().split(/\s+/).filter(Boolean).length,
    0,
  );

  const copyPlain = async () => {
    try {
      await navigator.clipboard.writeText(scriptToPlainText(script));
      toast.success("Script copied as plain text");
    } catch {
      toast.error("Couldn't copy");
    }
  };

  return (
    <div className="min-h-dvh bg-background ink">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b border-border/60">
        <div className="max-w-3xl mx-auto px-4 py-3 flex flex-wrap items-center gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider ink-faint font-medium">
              <Eye className="h-3 w-3" /> Read-only · shared script
              {encrypted && (
                <span className="inline-flex items-center gap-1 normal-case tracking-normal text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                  <Unlock className="h-2.5 w-2.5" /> Unlocked
                </span>
              )}
            </div>
            <h1 className="text-lg font-semibold truncate">{title}</h1>
            <div className="text-[11px] ink-faint">
              {script.segments.length} segment{script.segments.length === 1 ? "" : "s"}
              {wordCount > 0 && <> · {wordCount.toLocaleString()} words</>}
              {totalSec > 0 && <> · ~{formatDuration(totalSec)}</>}
            </div>
            {exp !== null && (
              <div className="mt-1 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400">
                <Clock className="h-2.5 w-2.5" />
                Expires in {formatRelative(exp - now)} · {formatAt(exp)}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setReaderOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-foreground text-background hover:opacity-90"
              title="Open teleprompter view"
            >
              <Presentation className="h-3.5 w-3.5" /> Reader
            </button>
            <button
              onClick={copyPlain}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium hairline border bg-paper ink-soft hover:bg-sunk"
              title="Copy as plain text"
            >
              <Copy className="h-3.5 w-3.5" /> Copy
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {script.segments.length === 0 ? (
          <div className="text-center ink-faint py-20">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-60" />
            This script has no content yet.
          </div>
        ) : (
          <article className="space-y-5">
            {script.segments.map((seg) => (
              <ReadOnlySegment key={seg.id} seg={seg} />
            ))}
          </article>
        )}

        <footer className="mt-12 pt-6 border-t border-border/60 text-center text-[11px] ink-faint">
          Shared via Noti · this view is read-only
        </footer>
      </main>

      {readerOpen && <ScriptReader script={script} onClose={() => setReaderOpen(false)} />}
    </div>
  );
}

function ReadOnlySegment({ seg }: { seg: ScriptSegment }) {
  if (seg.kind === "section" || seg.kind === "scene_heading") {
    return (
      <div className="pt-4">
        <div className="text-[10px] uppercase tracking-[0.18em] ink-faint font-semibold">
          {seg.kind === "scene_heading" ? "Scene" : "Section"}
        </div>
        <h2 className="text-base font-semibold mt-1">{seg.label || "Untitled"}</h2>
        {seg.text && <p className="mt-2 whitespace-pre-wrap leading-relaxed">{seg.text}</p>}
      </div>
    );
  }
  if (seg.kind === "dialogue") {
    return (
      <div>
        <div className="text-[11px] uppercase tracking-wider font-semibold ink-soft">
          {seg.label || "Speaker"}
        </div>
        <p className="mt-1 whitespace-pre-wrap leading-relaxed">{seg.text}</p>
      </div>
    );
  }
  if (seg.kind === "direction" || seg.kind === "transition") {
    return (
      <p
        className={cn(
          "italic ink-faint whitespace-pre-wrap leading-relaxed",
          seg.kind === "transition" && "uppercase tracking-wider text-right not-italic",
        )}
      >
        {seg.text}
      </p>
    );
  }
  // action
  return <p className="whitespace-pre-wrap leading-relaxed">{seg.text}</p>;
}

function UnlockGate({
  title,
  hint,
  exp,
  now,
  onUnlock,
}: {
  title: string;
  hint?: string;
  exp: number | null;
  now: number;
  onUnlock: (passphrase: string) => Promise<boolean>;
}) {
  const [pass, setPass] = useState("");
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pass || busy) return;
    setBusy(true);
    setError(null);
    try {
      const ok = await onUnlock(pass);
      if (!ok) {
        setAttempts((n) => n + 1);
        setError("That passphrase didn't work. Double-check with the sender.");
      }
    } catch {
      setError("Couldn't decrypt the link. It may be corrupt — ask for a fresh one.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh bg-background ink flex items-center justify-center p-6">
      <form onSubmit={submit} className="max-w-md w-full bg-paper hairline border rounded-2xl p-6">
        <div className="mx-auto h-12 w-12 inline-flex items-center justify-center rounded-full bg-sunk mb-3">
          <Lock className="h-6 w-6 ink-soft" />
        </div>
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-wider ink-faint font-medium">Password-protected</div>
          <h1 className="text-base font-semibold mt-0.5 truncate">{title}</h1>
          <p className="text-sm ink-faint mt-2">
            Enter the passphrase the sender shared with you to view this read-only script.
          </p>
          {exp !== null && (
            <div className="mt-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400">
              <Clock className="h-2.5 w-2.5" />
              Link expires in {formatRelative(exp - now)}
            </div>
          )}
        </div>

        <div className="mt-4">
          <label className="text-[10px] uppercase tracking-wider ink-faint font-medium">Passphrase</label>
          <div className="mt-1 flex items-center gap-1 rounded-md hairline border bg-paper px-2 py-1.5 focus-within:ring-1 focus-within:ring-foreground/40">
            <input
              type={reveal ? "text" : "password"}
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              autoFocus
              autoComplete="current-password"
              spellCheck={false}
              maxLength={256}
              className="flex-1 min-w-0 bg-transparent text-sm ink outline-none"
              placeholder="Enter passphrase"
            />
            <button
              type="button"
              onClick={() => setReveal((v) => !v)}
              title={reveal ? "Hide passphrase" : "Show passphrase"}
              className="h-6 w-6 inline-flex items-center justify-center rounded ink-soft hover:bg-sunk"
            >
              {reveal ? <EyeOff className="h-3.5 w-3.5" /> : <EyeOpen className="h-3.5 w-3.5" />}
            </button>
          </div>
          {hint && (
            <div className="mt-1.5 text-[11px] ink-faint">
              <span className="font-medium ink-soft">Hint:</span> {hint}
            </div>
          )}
          {error && (
            <div className="mt-2 text-[12px] inline-flex items-center gap-1 text-amber-700 dark:text-amber-500">
              <AlertCircle className="h-3 w-3" /> {error}
              {attempts >= 3 && <span className="ink-faint"> ({attempts} tries)</span>}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={busy || !pass}
          className="mt-4 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium bg-foreground text-background hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlock className="h-4 w-4" />}
          {busy ? "Unlocking…" : "Unlock script"}
        </button>

        <div className="mt-4 text-[10px] ink-faint leading-relaxed text-center">
          Decryption happens entirely in your browser — the passphrase is never sent anywhere.
        </div>
      </form>
    </div>
  );
}
