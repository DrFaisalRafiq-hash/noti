/**
 * AttachmentLightbox — full-screen image viewer with zoom + prev/next.
 *
 * Self-contained overlay used by NoteViewer and Composer to let users tap
 * an image attachment and inspect it. Supports:
 *   - keyboard nav (Esc / ← → / + -)
 *   - wheel + double-click zoom (1× ↔ 2.5×)
 *   - pinch-to-zoom on touch
 *   - drag to pan when zoomed; horizontal swipe to navigate when not zoomed
 *   - download current image
 *
 * Intentionally dependency-free (no react-image-lightbox / swiper) — the
 * surface is small and the project favours lightweight custom UI.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/notes-store";

export interface LightboxImage {
  id: string;
  url: string;
  file_name?: string | null;
  prompt?: string | null;
  source?: string | null;
}

interface Props {
  images: LightboxImage[];
  startId: string;
  onClose: () => void;
}

const MAX_ZOOM = 4;
const MIN_ZOOM = 1;
const DBL_TAP_ZOOM = 2.5;

export default function AttachmentLightbox({ images, startId, onClose }: Props) {
  const startIdx = useMemo(
    () => Math.max(0, images.findIndex((i) => i.id === startId)),
    [images, startId]
  );
  const [index, setIndex] = useState(startIdx);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const current = images[index];
  const hasMany = images.length > 1;

  const reset = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const goTo = useCallback(
    (next: number) => {
      const wrapped = ((next % images.length) + images.length) % images.length;
      setIndex(wrapped);
      reset();
      haptic.light();
    },
    [images.length, reset]
  );
  const next = useCallback(() => goTo(index + 1), [goTo, index]);
  const prev = useCallback(() => goTo(index - 1), [goTo, index]);

  // Body scroll lock + key handlers
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" && hasMany) next();
      else if (e.key === "ArrowLeft" && hasMany) prev();
      else if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(MAX_ZOOM, z + 0.5));
      else if (e.key === "-" || e.key === "_") setZoom((z) => Math.max(MIN_ZOOM, z - 0.5));
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [next, prev, onClose, hasMany]);

  // Pointer / touch handling for pan + pinch + swipe.
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    mode: "none" | "pan" | "swipe" | "pinch";
    startX: number;
    startY: number;
    panStart: { x: number; y: number };
    pinchStartDist: number;
    pinchStartZoom: number;
    pointers: Map<number, { x: number; y: number }>;
  }>({
    mode: "none",
    startX: 0,
    startY: 0,
    panStart: { x: 0, y: 0 },
    pinchStartDist: 0,
    pinchStartZoom: 1,
    pointers: new Map(),
  });

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const d = dragRef.current;
    d.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (d.pointers.size === 2) {
      const [a, b] = Array.from(d.pointers.values());
      d.mode = "pinch";
      d.pinchStartDist = Math.hypot(a.x - b.x, a.y - b.y);
      d.pinchStartZoom = zoom;
      return;
    }
    d.startX = e.clientX;
    d.startY = e.clientY;
    d.panStart = { ...pan };
    d.mode = zoom > 1 ? "pan" : "swipe";
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d.pointers.has(e.pointerId)) return;
    d.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (d.mode === "pinch" && d.pointers.size === 2) {
      const [a, b] = Array.from(d.pointers.values());
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const ratio = dist / Math.max(1, d.pinchStartDist);
      const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, d.pinchStartZoom * ratio));
      setZoom(z);
      if (z === 1) setPan({ x: 0, y: 0 });
      return;
    }
    if (d.mode === "pan") {
      setPan({
        x: d.panStart.x + (e.clientX - d.startX),
        y: d.panStart.y + (e.clientY - d.startY),
      });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = dragRef.current;
    const startX = d.startX;
    const startY = d.startY;
    const mode = d.mode;
    d.pointers.delete(e.pointerId);
    if (d.pointers.size < 2 && mode === "pinch") {
      d.mode = zoom > 1 ? "pan" : "none";
      return;
    }
    if (mode === "swipe" && hasMany && zoom === 1) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) next();
        else prev();
      }
    }
    if (d.pointers.size === 0) d.mode = "none";
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.0025;
    setZoom((z) => {
      const nz = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z + delta));
      if (nz === 1) setPan({ x: 0, y: 0 });
      return nz;
    });
  };

  const onDoubleClick = () => {
    if (zoom > 1) reset();
    else setZoom(DBL_TAP_ZOOM);
  };

  if (!current) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
      className="fixed inset-0 safe-overlay z-[100] bg-black/95 animate-fade-in select-none"
      onClick={(e) => {
        // Backdrop click closes; clicks bubbling from the image / chrome do not.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between gap-3 px-4 py-3 bg-gradient-to-b from-black/70 to-transparent text-white">
        <div className="text-xs font-medium tabular-nums opacity-80">
          {hasMany ? `${index + 1} / ${images.length}` : ""}
          {current.file_name && (
            <span className="ml-3 opacity-70 truncate inline-block max-w-[40vw] align-bottom">
              {current.file_name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <a
            href={current.url}
            download={current.file_name || undefined}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-smooth"
            title="Download"
            aria-label="Download image"
          >
            <Download className="h-4 w-4" />
          </a>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-smooth"
            title="Close (Esc)"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Stage — clicking the empty area around the image closes the
          lightbox. Pointer-down position is captured so a drag/swipe doesn't
          register as a backdrop tap on release. */}
      <div
        ref={stageRef}
        className={cn(
          "absolute inset-0 flex items-center justify-center overflow-hidden touch-none",
          zoom > 1 ? "cursor-grab" : "cursor-zoom-out"
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        onDoubleClick={onDoubleClick}
        onClick={(e) => {
          // Only treat as a backdrop click when the click hit the stage itself
          // (not the image), the user isn't zoomed in, and they didn't just
          // finish a swipe/drag gesture.
          if (e.target !== e.currentTarget) return;
          if (zoom > 1) return;
          const d = dragRef.current;
          const moved = Math.abs(e.clientX - d.startX) + Math.abs(e.clientY - d.startY);
          if (moved > 6) return;
          onClose();
        }}
      >
        <img
          key={current.id}
          src={current.url}
          alt={current.prompt || current.file_name || ""}
          draggable={false}
          className="max-w-[92vw] max-h-[88dvh] object-contain animate-fade-in"
          style={{
            transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
            transition: dragRef.current.mode === "none" ? "transform 180ms ease" : "none",
            willChange: "transform",
          }}
        />
      </div>

      {/* Prev / next arrows */}
      {hasMany && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); prev(); }}
            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-smooth"
            title="Previous (←)"
            aria-label="Previous image"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); next(); }}
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-smooth"
            title="Next (→)"
            aria-label="Next image"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}
    </div>,
    document.body
  );
}
