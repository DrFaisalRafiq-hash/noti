import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const VARIANTS = [
  { id: "medium", name: "Medium", blurb: "Refined weight — closest to the reference." },
  { id: "fat",    name: "Fat",    blurb: "Chunky strokes, confidently heavy." },
  { id: "black",  name: "Black",  blurb: "Display-weight, dramatic thick/thin contrast." },
] as const;

export default function IconPicker() {
  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto max-w-5xl px-5 sm:px-8 py-10 sm:py-16">
        <header className="mb-10 flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] ink-faint font-medium">Pick an icon</p>
            <h1 className="font-display text-3xl sm:text-4xl font-medium ink tracking-tight mt-1">
              "n" weight variants
            </h1>
            <p className="ink-soft text-[14px] mt-2 max-w-md">
              Three takes on the script-serif "n" — different stroke weights. Tell me which one
              and I'll wire it through every icon size (favicon, PWA, Apple touch).
            </p>
          </div>
          <Link to="/" className="inline-flex items-center gap-1.5 text-[12px] ink-soft hover:ink transition-smooth">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Link>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {VARIANTS.map(({ id, name, blurb }) => (
            <article key={id} className="bg-paper hairline border rounded-2xl p-5 shadow-soft">
              <div className="aspect-square rounded-xl bg-sunk hairline border flex items-center justify-center mb-4 overflow-hidden">
                <img src={`/icon-variants/${id}.png`} alt={`${name} variant`} className="w-full h-full object-contain" />
              </div>

              {/* size ladder — proves it holds up small */}
              <div className="flex items-end gap-4 mb-4 px-1">
                {[80, 56, 32].map((s) => (
                  <div key={s} className="flex flex-col items-center gap-1.5">
                    <img src={`/icon-variants/${id}.png`} alt="" style={{ width: s, height: s }} className="rounded-[18%]" />
                    <span className="text-[10px] ink-faint uppercase tracking-[0.14em]">{s}</span>
                  </div>
                ))}
              </div>

              <div className="border-t hairline pt-3">
                <h2 className="font-display text-xl ink">{name}</h2>
                <p className="text-[13px] ink-soft mt-1">{blurb}</p>
              </div>
            </article>
          ))}
        </div>

        <p className="text-[12px] ink-faint mt-10 text-center">
          Reply with <span className="ink">Medium</span>, <span className="ink">Fat</span>, or <span className="ink">Black</span>.
        </p>
      </div>
    </div>
  );
}
