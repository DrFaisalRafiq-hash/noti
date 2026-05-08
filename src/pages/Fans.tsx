import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Copy, Download, Check, Heart, Smartphone, Tablet, Laptop, Monitor } from "lucide-react";
import { toast } from "sonner";
import logoPng from "@/assets/brand/noti-icon.png";
import NotiWordmark from "@/components/NotiWordmark";

// ─── Canonical brand tokens (mirrors mem://design/brand-kit.md) ──────────────
const PALETTE = [
  { name: "Charcoal Top", hex: "#4E4E48", role: "Background gradient — start" },
  { name: "Charcoal Bottom", hex: "#2E2E2A", role: "Background gradient — end / solid bg" },
  { name: "Bone", hex: "#9B9B91", role: 'Letterform "n" fill' },
  { name: "Olive", hex: "#565642", role: "Bell — never recolor" },
] as const;

const RULES = [
  'Never substitute another glyph, font, or emoji for the lowercase italic "n".',
  "Never recolor the bell — it is always olive (#565642).",
  "Maintain clear space equal to ~10% of the icon width on all sides.",
  "Do not stretch, skew, or rotate the mark.",
];

type Wallpaper = {
  id: string;
  device: "iPhone" | "iPad" | "Laptop" | "Desktop";
  label: string;
  resolution: string;
  src: string;
  filename: string;
  aspect: string;
  Icon: typeof Smartphone;
};

const WALLPAPERS: Wallpaper[] = [
  {
    id: "iphone-pro-max",
    device: "iPhone",
    label: "iPhone 15/16 Pro Max",
    resolution: "1290 × 2796",
    src: "/wallpapers/noti-wallpaper-iphone-1290x2796.png",
    filename: "noti-wallpaper-iphone-1290x2796.png",
    aspect: "9 / 19.5",
    Icon: Smartphone,
  },
  {
    id: "iphone-pro",
    device: "iPhone",
    label: "iPhone 14/15/16 Pro",
    resolution: "1179 × 2556",
    src: "/wallpapers/noti-wallpaper-iphone-1179x2556.png",
    filename: "noti-wallpaper-iphone-1179x2556.png",
    aspect: "9 / 19.5",
    Icon: Smartphone,
  },
  {
    id: "ipad-portrait",
    device: "iPad",
    label: "iPad Pro 12.9″ — Portrait",
    resolution: "2048 × 2732",
    src: "/wallpapers/noti-wallpaper-ipad-2048x2732.png",
    filename: "noti-wallpaper-ipad-2048x2732.png",
    aspect: "3 / 4",
    Icon: Tablet,
  },
  {
    id: "ipad-landscape",
    device: "iPad",
    label: "iPad Pro 12.9″ — Landscape",
    resolution: "2732 × 2048",
    src: "/wallpapers/noti-wallpaper-ipad-2732x2048.png",
    filename: "noti-wallpaper-ipad-2732x2048.png",
    aspect: "4 / 3",
    Icon: Tablet,
  },
  {
    id: "laptop",
    device: "Laptop",
    label: "MacBook Pro 16″ Retina",
    resolution: "2880 × 1800",
    src: "/wallpapers/noti-wallpaper-laptop-2880x1800.png",
    filename: "noti-wallpaper-laptop-2880x1800.png",
    aspect: "16 / 10",
    Icon: Laptop,
  },
  {
    id: "desktop",
    device: "Desktop",
    label: "Desktop · 4K UHD",
    resolution: "3840 × 2160",
    src: "/wallpapers/noti-wallpaper-desktop-3840x2160.png",
    filename: "noti-wallpaper-desktop-3840x2160.png",
    aspect: "16 / 9",
    Icon: Monitor,
  },
];

export default function Fans() {
  const [copied, setCopied] = useState<string | null>(null);

  // Build the canonical mark SVG (n + olive bell) inline so logo downloads work
  // without going through admin. Mirrors AdminBrand.tsx "mono" variant.
  const monoSvg = useMemo(
    () =>
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <rect width="1024" height="1024" fill="#2E2E2A"/>
  <path d="M194 263Q272 378 315.0 420.0Q358 462 417 462Q452 462 471.0 442.5Q490 423 490 387Q490 352 464 272L428 163Q403 88 403 76Q403 59 417 59Q430 59 443.5 74.0Q457 89 487 135L509 122Q466 49 430.0 20.0Q394 -9 350 -9Q319 -9 300.5 7.0Q282 23 282 51Q282 98 310 182L365 348Q370 365 370 369Q370 377 362.0 383.5Q354 390 345 390Q331 390 311.0 375.5Q291 361 276 341Q230 281 198.5 206.0Q167 131 131 0H10L66 204Q112 366 112 382Q112 396 101.0 401.0Q90 406 58 407V434Q150 437 258 461Z"
    transform="translate(283.6, 711.3) scale(0.88, -0.88)"
    fill="rgba(155,155,145,0.32)"/>
  <g clip-path="url(#nClipMonoFan)">
    <ellipse cx="610" cy="295.4" rx="58.8" ry="46.2" fill="#565642"/>
    <polygon points="551.2,308.0 517.6,383.6 702.4,383.6 668.8,308.0" fill="#565642"/>
    <rect x="509.2" y="383.6" width="201.6" height="25.2" rx="12.6" fill="#565642"/>
    <ellipse cx="610" cy="429.8" rx="25.2" ry="21.0" fill="#565642"/>
    <ellipse cx="610" cy="245.0" rx="14.7" ry="12.6" fill="#565642"/>
  </g>
  <defs>
    <clipPath id="nClipMonoFan">
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

  const whiteGlyphSvg = useMemo(
    () =>
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <rect width="1024" height="1024" fill="#2E2E2A"/>
  <defs>
    <mask id="bellMaskFan" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024">
      <rect width="1024" height="1024" fill="white"/>
      <ellipse cx="610" cy="295.4" rx="58.8" ry="46.2" fill="black"/>
      <polygon points="551.2,308.0 517.6,383.6 702.4,383.6 668.8,308.0" fill="black"/>
      <rect x="509.2" y="383.6" width="201.6" height="25.2" rx="12.6" fill="black"/>
      <ellipse cx="610" cy="429.8" rx="25.2" ry="21.0" fill="black"/>
      <ellipse cx="610" cy="245.0" rx="14.7" ry="12.6" fill="black"/>
    </mask>
  </defs>
  <g mask="url(#bellMaskFan)">
    <path d="M194 263Q272 378 315.0 420.0Q358 462 417 462Q452 462 471.0 442.5Q490 423 490 387Q490 352 464 272L428 163Q403 88 403 76Q403 59 417 59Q430 59 443.5 74.0Q457 89 487 135L509 122Q466 49 430.0 20.0Q394 -9 350 -9Q319 -9 300.5 7.0Q282 23 282 51Q282 98 310 182L365 348Q370 365 370 369Q370 377 362.0 383.5Q354 390 345 390Q331 390 311.0 375.5Q291 361 276 341Q230 281 198.5 206.0Q167 131 131 0H10L66 204Q112 366 112 382Q112 396 101.0 401.0Q90 406 58 407V434Q150 437 258 461Z"
      transform="translate(283.6, 711.3) scale(0.88, -0.88)"
      fill="#ffffff"/>
  </g>
</svg>`,
    []
  );

  const officialSvg = useMemo(
    () =>
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <linearGradient id="bgFan" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#4E4E48"/>
      <stop offset="1" stop-color="#2E2E2A"/>
    </linearGradient>
    <clipPath id="nClipOffFan">
      <path d="M194 263Q272 378 315.0 420.0Q358 462 417 462Q452 462 471.0 442.5Q490 423 490 387Q490 352 464 272L428 163Q403 88 403 76Q403 59 417 59Q430 59 443.5 74.0Q457 89 487 135L509 122Q466 49 430.0 20.0Q394 -9 350 -9Q319 -9 300.5 7.0Q282 23 282 51Q282 98 310 182L365 348Q370 365 370 369Q370 377 362.0 383.5Q354 390 345 390Q331 390 311.0 375.5Q291 361 276 341Q230 281 198.5 206.0Q167 131 131 0H10L66 204Q112 366 112 382Q112 396 101.0 401.0Q90 406 58 407V434Q150 437 258 461Z" transform="translate(283.6, 711.3) scale(0.88, -0.88)"/>
    </clipPath>
  </defs>
  <rect width="1024" height="1024" fill="url(#bgFan)"/>
  <path d="M194 263Q272 378 315.0 420.0Q358 462 417 462Q452 462 471.0 442.5Q490 423 490 387Q490 352 464 272L428 163Q403 88 403 76Q403 59 417 59Q430 59 443.5 74.0Q457 89 487 135L509 122Q466 49 430.0 20.0Q394 -9 350 -9Q319 -9 300.5 7.0Q282 23 282 51Q282 98 310 182L365 348Q370 365 370 369Q370 377 362.0 383.5Q354 390 345 390Q331 390 311.0 375.5Q291 361 276 341Q230 281 198.5 206.0Q167 131 131 0H10L66 204Q112 366 112 382Q112 396 101.0 401.0Q90 406 58 407V434Q150 437 258 461Z"
    transform="translate(283.6, 711.3) scale(0.88, -0.88)"
    fill="rgba(155,155,145,0.32)"/>
  <g clip-path="url(#nClipOffFan)">
    <ellipse cx="610" cy="295.4" rx="58.8" ry="46.2" fill="#565642"/>
    <polygon points="551.2,308.0 517.6,383.6 702.4,383.6 668.8,308.0" fill="#565642"/>
    <rect x="509.2" y="383.6" width="201.6" height="25.2" rx="12.6" fill="#565642"/>
    <ellipse cx="610" cy="429.8" rx="25.2" ry="21.0" fill="#565642"/>
    <ellipse cx="610" cy="245.0" rx="14.7" ry="12.6" fill="#565642"/>
  </g>
</svg>`,
    []
  );

  const variants = [
    { id: "official", label: "Official", desc: "Charcoal gradient", svg: officialSvg, filename: "noti-icon-official.svg" },
    { id: "mono", label: "Mono", desc: "Solid charcoal", svg: monoSvg, filename: "noti-icon-mono.svg" },
    { id: "light", label: "Light", desc: "Bone surface", svg: lightSvg, filename: "noti-icon-light.svg" },
    { id: "white", label: "White glyph", desc: "Inherits color", svg: whiteGlyphSvg, filename: "noti-icon-white.svg" },
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
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "PNG export failed";
      toast.error(msg);
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
    <div className="min-h-dvh bg-[#1d1d1a] text-[#EDEAE0]">
      {/* ─── Hero ───────────────────────────────────────────────────────── */}
      <header className="relative overflow-hidden border-b border-white/5">
        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            background:
              "radial-gradient(120% 80% at 30% 20%, rgba(255,255,255,0.06), transparent 60%), radial-gradient(100% 70% at 75% 85%, rgba(0,0,0,0.45), transparent 65%), linear-gradient(180deg, #4E4E48 0%, #2E2E2A 100%)",
          }}
          aria-hidden
        />
        <div className="relative mx-auto max-w-6xl px-5 py-6 sm:px-8">
          <div className="flex items-center justify-between">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm text-white/70 transition-colors hover:text-white"
            >
              <ArrowLeft size={16} /> Home
            </Link>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/70">
              <Heart size={12} className="fill-current" /> Fan page
            </div>
          </div>

          <div className="mt-12 flex flex-col items-center text-center sm:mt-16">
            <img
              src={logoPng}
              alt="Noti app icon"
              className="h-28 w-28 rounded-3xl shadow-[0_30px_80px_rgba(0,0,0,0.55)] ring-1 ring-white/10 sm:h-32 sm:w-32"
              width={128}
              height={128}
            />
            <div className="mt-7">
              <NotiWordmark size="xl" color="#ffffff" className="text-white" />
            </div>
            <h1 className="mt-5 max-w-2xl font-display text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl">
              Wear it. Set it. Share it.
            </h1>
            <p className="mt-3 max-w-xl text-sm text-white/60 sm:text-base">
              Wallpapers, logos, and brand tokens for the people who love Noti
              as much as we do. Set the bell on your home screen.
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
        {/* ─── Wallpapers ────────────────────────────────────────────── */}
        <section>
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-semibold text-white sm:text-3xl">
                Wallpapers
              </h2>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/40">
                iPhone · iPad · Laptop · Desktop
              </p>
            </div>
          </div>

          <div className="mt-7 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {WALLPAPERS.map((w) => {
              const Icon = w.Icon;
              return (
                <div
                  key={w.id}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-white/8 bg-white/[0.03] shadow-[0_10px_40px_rgba(0,0,0,0.35)] backdrop-blur-sm"
                >
                  <div
                    className="relative w-full overflow-hidden bg-[#2E2E2A]"
                    style={{ aspectRatio: "4 / 5" }}
                  >
                    <img
                      src={w.src}
                      alt={`${w.label} Noti wallpaper`}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                    />
                  </div>
                  <div className="flex flex-col gap-3 border-t border-white/5 px-4 py-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-medium text-white">
                        <Icon size={14} className="text-white/50" />
                        <span className="truncate">{w.label}</span>
                      </div>
                      <div className="mt-0.5 font-mono text-[11px] text-white/40">
                        {w.resolution}
                      </div>
                    </div>
                    <a
                      href={w.src}
                      download={w.filename}
                      onClick={() => toast.success(`Downloading ${w.device} wallpaper`)}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-[#2E2E2A] transition-transform hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <Download size={14} /> Download for {w.device}
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ─── Brand kit ─────────────────────────────────────────────── */}
        <section className="mt-20">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-semibold text-white sm:text-3xl">
                Brand kit
              </h2>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/40">
                Canonical mark · color tokens · usage rules
              </p>
            </div>
          </div>
          <p className="mt-3 max-w-2xl text-sm text-white/60">
            The official Noti mark is a lowercase italic serif{" "}
            <span className="italic">n</span> with an olive bell embedded in
            its right shoulder. Never substitute another glyph.
          </p>

          {/* Logo variants */}
          <div className="mt-7">
            <h3 className="text-xs uppercase tracking-[0.18em] text-white/40">
              Logo variants — SVG &amp; PNG · 1024 × 1024
            </h3>
            <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {variants.map((v) => (
                <div
                  key={v.id}
                  className="overflow-hidden rounded-2xl border border-white/8 bg-white/[0.03]"
                >
                  <div
                    className="aspect-square w-full"
                    dangerouslySetInnerHTML={{
                      __html: v.svg.replace(
                        /width="1024"\s+height="1024"/,
                        'width="100%" height="100%"'
                      ),
                    }}
                  />
                  <div className="border-t border-white/5 px-3 py-3">
                    <div className="text-sm font-medium text-white">
                      {v.label}
                    </div>
                    <div className="text-[11px] text-white/50">{v.desc}</div>
                    <div className="mt-2 flex items-center gap-1.5">
                      <button
                        onClick={() => downloadSvg(v.svg, v.filename)}
                        className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-white/10"
                      >
                        <Download size={11} /> SVG
                      </button>
                      <button
                        onClick={() =>
                          downloadPng(
                            v.svg,
                            v.filename.replace(/\.svg$/, "-1024.png")
                          )
                        }
                        className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-white/10"
                      >
                        <Download size={11} /> PNG
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Palette */}
          <div className="mt-10">
            <h3 className="text-xs uppercase tracking-[0.18em] text-white/40">
              Color palette — tap to copy
            </h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {PALETTE.map((c) => {
                const isCopied = copied === c.hex;
                return (
                  <button
                    key={c.hex}
                    onClick={() => copy(c.hex, c.hex)}
                    className="group overflow-hidden rounded-2xl border border-white/8 bg-white/[0.03] text-left transition-all hover:border-white/20"
                  >
                    <div
                      className="h-24 w-full"
                      style={{ backgroundColor: c.hex }}
                      aria-hidden
                    />
                    <div className="flex items-center justify-between gap-2 px-3 py-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-white">
                          {c.name}
                        </div>
                        <div className="truncate text-[11px] text-white/50">
                          {c.role}
                        </div>
                      </div>
                      <div className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2 py-1 font-mono text-[10px] text-white">
                        {isCopied ? <Check size={10} /> : <Copy size={10} />}
                        {c.hex}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Rules */}
          <div className="mt-10">
            <h3 className="text-xs uppercase tracking-[0.18em] text-white/40">
              Usage rules
            </h3>
            <ul className="mt-4 space-y-2 rounded-2xl border border-white/8 bg-white/[0.03] p-5 text-sm text-white/85">
              {RULES.map((r) => (
                <li key={r} className="flex gap-2">
                  <span className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-white/50" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <footer className="mt-20 border-t border-white/5 pt-8 text-center text-xs text-white/40">
          Made with <Heart size={11} className="inline fill-current text-white/60" /> for the Noti community.
        </footer>
      </main>
    </div>
  );
}
