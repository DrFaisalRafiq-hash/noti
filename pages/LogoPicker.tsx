import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import NotiLogo from "@/components/NotiLogo";
import LogoAperture from "@/components/logo-variants/LogoAperture";
import LogoFold from "@/components/logo-variants/LogoFold";
import LogoSpark from "@/components/logo-variants/LogoSpark";
import NotiWordmark from "@/components/NotiWordmark";

const VARIANTS = [
  {
    id: "current",
    name: "Current",
    tag: "Page · Constellation",
    blurb: "Folded page with a tiny ai constellation.",
    Comp: NotiLogo,
  },
  {
    id: "aperture",
    name: "Aperture N",
    tag: "Editorial · Quiet",
    blurb: "Serif-leaning N inscribed in a soft page frame.",
    Comp: LogoAperture,
  },
  {
    id: "fold",
    name: "Folded Crease",
    tag: "Geometric · Singular",
    blurb: "One sheet folded into the silhouette of an N.",
    Comp: LogoFold,
  },
  {
    id: "spark",
    name: "Spark Margin",
    tag: "Optimistic · Distinct",
    blurb: "Margin rule with an ink dot blooming into a trail.",
    Comp: LogoSpark,
  },
] as const;

export default function LogoPicker() {
  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto max-w-5xl px-5 sm:px-8 py-10 sm:py-16">
        <header className="mb-10 sm:mb-14 flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] ink-faint font-medium">
              Pick a mark
            </p>
            <h1 className="font-display text-3xl sm:text-4xl font-medium ink tracking-tight mt-1">
              Logo variants
            </h1>
            <p className="ink-soft text-[14px] mt-2 max-w-md">
              Three new directions alongside the current logo. Each is monochrome
              and adapts to light and dark themes — tell me which one and I'll
              wire it in everywhere.
            </p>
          </div>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-[12px] ink-soft hover:ink transition-smooth"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Link>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {VARIANTS.map(({ id, name, tag, blurb, Comp }) => (
            <article
              key={id}
              className="bg-paper hairline border rounded-2xl p-6 shadow-soft"
            >
              {/* Hero — large render on a paper card */}
              <div className="aspect-[5/3] rounded-xl bg-sunk hairline border flex items-center justify-center mb-5">
                <Comp className="h-20 w-20 ink" strokeWidth={1.4} />
              </div>

              {/* Size ladder — proves the mark holds up at app-bar and favicon scale */}
              <div className="flex items-end gap-5 mb-5 px-1">
                <div className="flex flex-col items-center gap-1.5">
                  <Comp className="h-12 w-12 ink" strokeWidth={1.5} />
                  <span className="text-[10px] ink-faint uppercase tracking-[0.14em]">48</span>
                </div>
                <div className="flex flex-col items-center gap-1.5">
                  <Comp className="h-8 w-8 ink" strokeWidth={1.6} />
                  <span className="text-[10px] ink-faint uppercase tracking-[0.14em]">32</span>
                </div>
                <div className="flex flex-col items-center gap-1.5">
                  <Comp className="h-5 w-5 ink" strokeWidth={1.75} />
                  <span className="text-[10px] ink-faint uppercase tracking-[0.14em]">20</span>
                </div>
                {/* Inverted chip — verifies it works on dark surfaces */}
                <div className="ml-auto flex flex-col items-center gap-1.5">
                  <div className="h-12 w-12 rounded-xl bg-foreground flex items-center justify-center">
                    <Comp className="h-7 w-7 text-background" strokeWidth={1.6} />
                  </div>
                  <span className="text-[10px] ink-faint uppercase tracking-[0.14em]">inv.</span>
                </div>
              </div>

              {/* Header lockup — how the mark pairs with the wordmark */}
              <div className="flex items-center gap-2.5 mb-4">
                <Comp className="h-9 w-9 ink" strokeWidth={1.5} />
                <NotiWordmark size="lg" className="ink" />
              </div>

              <div className="border-t hairline pt-4">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="font-display text-xl ink">{name}</h2>
                  <span className="text-[10px] uppercase tracking-[0.18em] ink-faint">
                    {tag}
                  </span>
                </div>
                <p className="text-[13px] ink-soft mt-1.5">{blurb}</p>
              </div>
            </article>
          ))}
        </div>

        <p className="text-[12px] ink-faint mt-10 text-center">
          Reply with <span className="ink">Aperture</span>,{" "}
          <span className="ink">Fold</span>, <span className="ink">Spark</span>,
          or keep the <span className="ink">Current</span> mark.
        </p>
      </div>
    </div>
  );
}
