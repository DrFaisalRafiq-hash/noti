import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Copy, Download, Shield, Check } from "lucide-react";
import { toast } from "sonner";
import logoPng from "@/assets/brand/noti-icon.png";
import logoSvg from "@/assets/brand/noti-icon.svg?raw";

// ─── Canonical brand tokens ──────────────────────────────────────────────────
// Mirrors mem://design/brand-kit.md — keep in sync.
const PALETTE = [
  { name: "Charcoal Top", hex: "#4E4E48", role: "Background gradient — start" },
  { name: "Charcoal Bottom", hex: "#2E2E2A", role: "Background gradient — end / solid bg" },
  { name: "Bone", hex: "#9B9B91", role: 'Letterform "n" fill' },
  { name: "Olive", hex: "#565642", role: "Bell — never recolor" },
] as const;

const RULES = [
  'Never substitute another glyph, font, or emoji for the lowercase italic "n".',
  "Never recolor the bell — it is always olive (#565642).",
  "Prefer the charcoal gradient on hero/marketing; solid #2E2E2A is allowed for compact contexts.",
  "Maintain clear space equal to ~10% of the icon width on all sides.",
  "Do not stretch, skew, or rotate the mark.",
];

const PNG_FILENAME = "noti-icon-1024.png";
const SVG_FILENAME = "noti-icon.svg";

export default function AdminBrand() {
  const [copied, setCopied] = useState<string | null>(null);

  // Build the three preview tiles from the same SVG source. The SVG already
  // includes its own gradient background; the "Mono" / "Light" tiles render
  // just the n + bell vector composited on a clean panel for marketing use.
  const monoSvg = useMemo(
    () =>
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <rect width="1024" height="1024" fill="#2E2E2A"/>
  <path d="M194 263Q272 378 315.0 420.0Q358 462 417 462Q452 462 471.0 442.5Q490 423 490 387Q490 352 464 272L428 163Q403 88 403 76Q403 59 417 59Q430 59 443.5 74.0Q457 89 487 135L509 122Q466 49 430.0 20.0Q394 -9 350 -9Q319 -9 300.5 7.0Q282 23 282 51Q282 98 310 182L365 348Q370 365 370 369Q370 377 362.0 383.5Q354 390 345 390Q331 390 311.0 375.5Q291 361 276 341Q230 281 198.5 206.0Q167 131 131 0H10L66 204Q112 366 112 382Q112 396 101.0 401.0Q90 406 58 407V434Q150 437 258 461Z"
    transform="translate(283.6, 711.3) scale(0.88, -0.88)"
    fill="rgba(155,155,145,0.32)"/>
  <g clip-path="url(#nClipMono)">
    <ellipse cx="610" cy="295.4" rx="58.8" ry="46.2" fill="#565642"/>
    <polygon points="551.2,308.0 517.6,383.6 702.4,383.6 668.8,308.0" fill="#565642"/>
    <rect x="509.2" y="383.6" width="201.6" height="25.2" rx="12.6" fill="#565642"/>
    <ellipse cx="610" cy="429.8" rx="25.2" ry="21.0" fill="#565642"/>
    <ellipse cx="610" cy="245.0" rx="14.7" ry="12.6" fill="#565642"/>
  </g>
  <defs>
    <clipPath id="nClipMono">
      <path d="M194 263Q272 378 315.0 420.0Q358 462 417 462Q452 462 471.0 442.5Q490 423 490 387Q490 352 464 272L428 163Q403 88 403 76Q403 59 417 59Q430 59 443.5 74.0Q457 89 487 135L509 122Q466 49 430.0 20.0Q394 -9 350 -9Q319 -9 300.5 7.0Q282 23 282 51Q282 98 310 182L365 348Q370 365 370 369Q370 377 362.0 383.5Q354 390 345 390Q331 390 311.0 375.5Q291 361 276 341Q230 281 198.5 206.0Q167 131 131 0H10L66 204Q112 366 112 382Q112 396 101.0 401.0Q90 406 58 407V434Q150 437 258 461Z" transform="translate(283.6, 711.3) scale(0.88, -0.88)"/>
    </clipPath>
  </defs>
</svg>`,
    []
  );

  const lightSvg = useMemo(
    () =>
      monoSvg
        .split("#2E2E2A").join("#F4F2EC")
        .split("rgba(155,155,145,0.32)").join("rgba(46,46,42,0.85)"),
    [monoSvg]
  );

  // White glyph mark — the "n" with the bell silhouette knocked out, on a
  // charcoal panel for preview. The SVG itself is a transparent mark that
  // inherits color, ideal for in-app headers next to the wordmark.
  const whiteGlyphSvg = useMemo(
    () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <rect width="1024" height="1024" fill="#2E2E2A"/>
  <defs>
    <mask id="bellMaskW">
      <rect width="1024" height="1024" fill="white"/>
      <g>
        <ellipse cx="610" cy="295.4" rx="58.8" ry="46.2" fill="black"/>
        <polygon points="551.2,308.0 517.6,383.6 702.4,383.6 668.8,308.0" fill="black"/>
        <rect x="509.2" y="383.6" width="201.6" height="25.2" rx="12.6" fill="black"/>
        <ellipse cx="610" cy="429.8" rx="25.2" ry="21.0" fill="black"/>
        <ellipse cx="610" cy="245.0" rx="14.7" ry="12.6" fill="black"/>
      </g>
    </mask>
  </defs>
  <path d="M194 263Q272 378 315.0 420.0Q358 462 417 462Q452 462 471.0 442.5Q490 423 490 387Q490 352 464 272L428 163Q403 88 403 76Q403 59 417 59Q430 59 443.5 74.0Q457 89 487 135L509 122Q466 49 430.0 20.0Q394 -9 350 -9Q319 -9 300.5 7.0Q282 23 282 51Q282 98 310 182L365 348Q370 365 370 369Q370 377 362.0 383.5Q354 390 345 390Q331 390 311.0 375.5Q291 361 276 341Q230 281 198.5 206.0Q167 131 131 0H10L66 204Q112 366 112 382Q112 396 101.0 401.0Q90 406 58 407V434Q150 437 258 461Z"
    transform="translate(283.6, 711.3) scale(0.88, -0.88)"
    fill="#ffffff"
    mask="url(#bellMaskW)"/>
</svg>`,
    []
  );

  const variants = [
    { id: "official", label: "Official", desc: "Charcoal gradient", svg: logoSvg, filename: "noti-icon-official.svg" },
    { id: "mono", label: "Mono", desc: "Solid charcoal", svg: monoSvg, filename: "noti-icon-mono.svg" },
    { id: "light", label: "Light", desc: "Bone surface", svg: lightSvg, filename: "noti-icon-light.svg" },
    { id: "white", label: "White glyph", desc: "In-app mark · inherits color", svg: whiteGlyphSvg, filename: "noti-icon-white.svg" },
  ];

  const downloadBlob = (data: BlobPart, filename: string, type: string) => {
    const blob = new Blob([data], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadSvg = (svg: string, filename: string) => {
    downloadBlob(svg, filename, "image/svg+xml");
    toast.success(`Downloaded ${filename}`);
  };

  const downloadPng = async (svg: string, filename: string, size = 1024) => {
    try {
      const blob = new Blob([svg], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to load SVG"));
        img.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);
      const pngBlob: Blob = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b!), "image/png")
      );
      downloadBlob(pngBlob, filename, "image/png");
      toast.success(`Downloaded ${filename}`);
    } catch (e: any) {
      toast.error(e?.message ?? "PNG export failed");
    }
  };

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1200);
    } catch {
      toast.error("Copy failed");
    }
  };

  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Link
            to="/admin"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft size={16} /> Back to admin
          </Link>
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <Shield size={14} /> Brand kit
          </div>
        </div>

        <h1 className="font-display text-4xl font-semibold tracking-tight">Brand kit</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Canonical Noti mark, color tokens, and downloadable assets for marketing. The
          official logo is a lowercase italic serif <span className="italic">n</span> with an
          olive bell embedded in its right shoulder — never substitute another glyph.
        </p>

        <section className="mt-10">
          <h2 className="font-display text-lg font-semibold">Logo variants</h2>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            SVG &amp; PNG · 1024 × 1024
          </p>

          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {variants.map((v) => (
              <div
                key={v.id}
                className="overflow-hidden rounded-2xl border bg-card shadow-sm"
              >
                <div
                  className="aspect-square w-full"
                  dangerouslySetInnerHTML={{ __html: v.svg.replace(/width="1024"\s+height="1024"/, 'width="100%" height="100%"') }}
                />
                <div className="flex items-center justify-between gap-2 border-t px-4 py-3">
                  <div>
                    <div className="text-sm font-medium text-foreground">{v.label}</div>
                    <div className="text-xs text-muted-foreground">{v.desc}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => downloadSvg(v.svg, v.filename)}
                      className="inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-1 text-[11px] font-medium hover:bg-accent"
                      title="Download SVG"
                    >
                      <Download size={12} /> SVG
                    </button>
                    <button
                      onClick={() => downloadPng(v.svg, v.filename.replace(/\.svg$/, "-1024.png"))}
                      className="inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-1 text-[11px] font-medium hover:bg-accent"
                      title="Download PNG (1024)"
                    >
                      <Download size={12} /> PNG
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 flex items-center gap-4 rounded-2xl border bg-card p-4">
            <img src={logoPng} alt="Noti app icon" className="h-16 w-16 rounded-xl" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">App icon (raster)</div>
              <div className="text-xs text-muted-foreground truncate">
                Source PNG committed at <code className="rounded bg-muted px-1 py-0.5">src/assets/brand/noti-icon.png</code>
              </div>
            </div>
            <a
              href={logoPng}
              download="noti-icon.png"
              className="inline-flex items-center gap-1 rounded-full border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
            >
              <Download size={12} /> Download
            </a>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="font-display text-lg font-semibold">Color palette</h2>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Tap a swatch to copy its hex
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {PALETTE.map((c) => {
              const isCopied = copied === c.hex;
              return (
                <button
                  key={c.hex}
                  onClick={() => copy(c.hex, c.hex)}
                  className="group overflow-hidden rounded-2xl border bg-card text-left shadow-sm transition-all hover:shadow-md"
                >
                  <div
                    className="h-24 w-full"
                    style={{ backgroundColor: c.hex }}
                    aria-hidden
                  />
                  <div className="flex items-center justify-between gap-2 px-4 py-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground">{c.name}</div>
                      <div className="truncate text-xs text-muted-foreground">{c.role}</div>
                    </div>
                    <div className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-1 font-mono text-[11px]">
                      {isCopied ? <Check size={11} /> : <Copy size={11} />}
                      {c.hex}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-12 mb-16">
          <h2 className="font-display text-lg font-semibold">Usage rules</h2>
          <ul className="mt-4 space-y-2 rounded-2xl border bg-card p-5 text-sm text-foreground">
            {RULES.map((r) => (
              <li key={r} className="flex gap-2">
                <span className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-foreground/60" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
