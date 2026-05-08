import { z } from "zod";
import { newId, type PodcastScript, type ScriptSegment } from "./podcast-script";

export const folioPayloadSchema = z.object({
  source: z.literal("folio"),
  version: z.literal(1),
  book: z.object({
    id: z.string().min(1),
    title: z.string().min(1).max(200),
    synopsis: z.string().max(5000).optional(),
  }),
  pages: z
    .array(
      z.object({
        index: z.number().int().nonnegative(),
        summary: z.string().max(2000).optional(),
        panels: z.array(
          z.object({
            index: z.number().int().nonnegative(),
            action: z.string().max(2000).optional(),
            dialog: z
              .array(
                z.object({
                  character: z.string().min(1).max(80),
                  line: z.string().min(1).max(2000),
                }),
              )
              .optional(),
            sfx: z.array(z.string().max(120)).optional(),
          }),
        ),
      }),
    )
    .max(500),
  returnUrl: z.string().url().optional(),
});

export type FolioPayload = z.infer<typeof folioPayloadSchema>;

export const FOLIO_SS_KEY = "noti.folio.pendingImport";

export class FolioImportError extends Error {
  code: "missing" | "base64" | "json" | "schema";
  detail?: string;
  constructor(code: FolioImportError["code"], message: string, detail?: string) {
    super(message);
    this.code = code;
    this.detail = detail;
  }
}

/** Parse `payload` query param. Supports raw URL-encoded JSON or base64 JSON. */
export function decodeFolioPayloadParam(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new FolioImportError("missing", "The import link didn't include a payload.");
  }
  let jsonText = trimmed;
  if (!trimmed.startsWith("{")) {
    // Looks like base64 — try to decode.
    try {
      jsonText = atob(trimmed.replace(/-/g, "+").replace(/_/g, "/"));
    } catch {
      throw new FolioImportError(
        "base64",
        "The Folio link looks corrupted — its payload couldn't be decoded.",
      );
    }
  }
  try {
    return JSON.parse(jsonText);
  } catch (e: any) {
    throw new FolioImportError(
      "json",
      "The Folio payload wasn't valid JSON.",
      e?.message,
    );
  }
}

/** Convert a Zod error into a short, human-readable list. */
export function formatZodIssues(err: z.ZodError): string {
  const issues = err.issues.slice(0, 4).map((i) => {
    const path = i.path.length ? i.path.join(".") : "payload";
    return `• ${path}: ${i.message}`;
  });
  if (err.issues.length > 4) issues.push(`…and ${err.issues.length - 4} more`);
  return issues.join("\n");
}


export function renderPanelText(panel: FolioPayload["pages"][number]["panels"][number]): string {
  const parts: string[] = [];
  parts.push(`Panel ${panel.index + 1}`);
  if (panel.action) parts.push(`Action: ${panel.action}`);
  if (panel.dialog?.length) {
    parts.push(
      "Dialog:\n" + panel.dialog.map((d) => `  ${d.character}: ${d.line}`).join("\n"),
    );
  }
  if (panel.sfx?.length) parts.push(`SFX: ${panel.sfx.join(", ")}`);
  return parts.join("\n");
}

export function renderPageBody(page: FolioPayload["pages"][number]): string {
  const head = page.summary ? `${page.summary}\n\n` : "";
  return head + page.panels.map(renderPanelText).join("\n\n");
}

/**
 * Build the "Send to Folio" deep link.
 *
 * The exported payload matches Folio's own import schema exactly
 * (`source: "folio"`, same `book` + `pages` shape) so a Noti → Folio →
 * Noti round-trip reproduces the original structure cleanly. Folio
 * accepts the payload at `/folio?source=folio&payload=...`.
 */
export function buildFolioReturnUrl(payload: {
  bookId?: string;
  title: string;
  synopsis?: string;
  pages: FolioPayload["pages"];
  /** Where Folio should send the user back to after editing. */
  returnUrl?: string;
}): string {
  const data: FolioPayload = {
    source: "folio",
    version: 1,
    book: {
      id: payload.bookId || crypto.randomUUID(),
      title: payload.title || "Untitled",
      ...(payload.synopsis ? { synopsis: payload.synopsis } : {}),
    },
    // Re-index defensively so `index` is always 0..n-1 and matches Folio's expectations.
    pages: payload.pages.map((p, i) => ({
      index: i,
      ...(p.summary ? { summary: p.summary } : {}),
      panels: p.panels.map((panel, j) => ({
        index: j,
        ...(panel.action ? { action: panel.action } : {}),
        ...(panel.dialog?.length ? { dialog: panel.dialog } : {}),
        ...(panel.sfx?.length ? { sfx: panel.sfx } : {}),
      })),
    })),
    ...(payload.returnUrl ? { returnUrl: payload.returnUrl } : {}),
  };
  // Validate before sending — better to throw locally than to ship a broken link.
  folioPayloadSchema.parse(data);
  const encoded = encodeURIComponent(JSON.stringify(data));
  return `https://folioart.app/folio?source=folio&payload=${encoded}`;
}


/**
 * Convert a Folio payload into a Noti comic-book script. Round-trips cleanly
 * with `scriptToFolioPages` in ScriptEditor: page → page segment, panel →
 * panel + caption/dialogue/sfx segments.
 */
export function folioPayloadToScript(payload: FolioPayload): PodcastScript {
  const segments: ScriptSegment[] = [];
  for (const page of payload.pages) {
    segments.push({
      id: newId(),
      kind: "page",
      label: `Page ${page.index + 1}`,
      text: page.summary ?? "",
    });
    for (const panel of page.panels) {
      // Split out CAPTION: prefixed lines from the panel's action so they
      // come back as proper caption segments.
      let action = panel.action ?? "";
      const captions: string[] = [];
      action = action
        .split("\n")
        .filter((line) => {
          const m = line.match(/^\s*CAPTION\s*:\s*(.+)$/i);
          if (m) {
            captions.push(m[1].trim());
            return false;
          }
          return true;
        })
        .join("\n")
        .trim();

      segments.push({
        id: newId(),
        kind: "panel",
        label: `Panel ${panel.index + 1}`,
        text: action,
      });
      for (const c of captions) {
        segments.push({ id: newId(), kind: "caption", text: c });
      }
      for (const d of panel.dialog ?? []) {
        segments.push({
          id: newId(),
          kind: "dialogue",
          label: d.character,
          text: d.line,
        });
      }
      for (const s of panel.sfx ?? []) {
        segments.push({ id: newId(), kind: "sfx", text: s });
      }
    }
  }

  return {
    v: 1,
    kind: "comic",
    format: "comic",
    brief: {
      topic: payload.book.title,
      lengthMin: payload.pages.length || 1,
      tone: "superhero",
      speakers: [],
      talkingPoints: [],
      notes: "",
      logline: payload.book.synopsis ?? "",
    },
    segments,
  };
}
