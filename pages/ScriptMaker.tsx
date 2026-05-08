import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Sparkles } from "lucide-react";
import ScriptEditor from "@/components/ScriptEditor";
import NotiMark from "@/components/brand/NotiMark";
import NotiWordmark from "@/components/NotiWordmark";
import PasteShareLink from "@/components/PasteShareLink";

export default function ScriptMaker() {
  // Local-only draft for anonymous visitors. Stored in component state — not persisted.
  const [draft, setDraft] = useState<string>("");

  return (
    <div className="min-h-dvh bg-background">
      {/* Top bar */}
      <header className="hairline border-b sticky top-0 z-10 bg-background/85 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm ink-soft hover:ink transition-smooth"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back</span>
          </Link>
          <Link to="/" className="ml-1 inline-flex items-center gap-2 ink">
            <NotiMark className="h-5 w-5" />
            <NotiWordmark size="sm" />
          </Link>
          <Link
            to="/auth"
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-foreground text-background hover:opacity-90 transition-smooth"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Sign up for AI
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-10 pb-6 text-center">
        <h1 className="font-display text-3xl sm:text-4xl font-semibold ink leading-tight">
          Podcast Script Maker
        </h1>
        <p className="mt-3 max-w-2xl mx-auto ink-soft text-sm sm:text-base leading-relaxed">
          Write your next episode in a clean, monochrome editor. Start from a template
          (Hook · Intro · Body · Outro, Interview, Monologue, Story), edit segment by
          segment, and export to <span className="font-medium ink">PDF</span> or{" "}
          <span className="font-medium ink">.txt</span> when you're done. No account
          required.
        </p>
        <p className="mt-3 text-xs ink-faint">
          Want AI to compose or expand your outline?{" "}
          <Link to="/auth" className="underline hover:ink">
            Create a free account
          </Link>
          .
        </p>
      </section>

      {/* Editor */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 pb-24">
        <div className="mb-4">
          <PasteShareLink />
        </div>

        <div className="rounded-2xl hairline border bg-paper p-3 sm:p-5 shadow-sm">
          <ScriptEditor
            initial={draft}
            onChange={setDraft}
            disableAi
            historyKey="anon-draft"
          />
        </div>

        <p className="mt-4 text-center text-[11px] ink-faint">
          Your draft lives in this browser tab only — it isn't saved.{" "}
          <Link to="/auth" className="underline hover:ink">
            Sign up
          </Link>{" "}
          to sync scripts across devices.
        </p>
      </main>
    </div>
  );
}
