import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  PageOrientation,
  Paragraph,
  TextRun,
} from "docx";
import { type PodcastScript, scriptToPlainText } from "@/lib/podcast-script";

function safeFilename(s: string, fallback = "script"): string {
  const cleaned = (s || "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 60);
  return cleaned || fallback;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportScriptAsText(script: PodcastScript) {
  const text = scriptToPlainText(script);
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const name = safeFilename(script.brief.topic || script.brief.logline || "script");
  triggerDownload(blob, `${name}.txt`);
}


// (HTML-to-print export was replaced by direct jsPDF rendering below.)

/**
 * One-tap PDF export — renders the script directly to a downloadable .pdf
 * file using jsPDF. No print dialog, no popup window. Layout mirrors the
 * .docx export: Letter page, 1" margins, screenplay = Courier with
 * indented character cues + dialogue, podcast = serif body.
 */
export async function exportScriptAsPdf(script: PodcastScript) {
  const { jsPDF } = await import("jspdf");
  const isScreenplay = script.kind === "screenplay";

  // Letter page in points (72pt = 1in).
  const PAGE_W = 612;
  const PAGE_H = 792;
  const MARGIN = 72;
  const CONTENT_W = PAGE_W - MARGIN * 2;

  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const bodyFont = isScreenplay ? "courier" : "times";

  let y = MARGIN;

  const ensureSpace = (lineHeight: number) => {
    if (y + lineHeight > PAGE_H - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  };

  const drawWrapped = (
    text: string,
    opts: {
      size?: number;
      bold?: boolean;
      italic?: boolean;
      align?: "left" | "center" | "right";
      indentLeft?: number;
      indentRight?: number;
      spaceBefore?: number;
      spaceAfter?: number;
      uppercase?: boolean;
    } = {},
  ) => {
    const size = opts.size ?? 11;
    const indentL = opts.indentLeft ?? 0;
    const indentR = opts.indentRight ?? 0;
    const align = opts.align ?? "left";
    const lineH = size * 1.35;
    const wrapW = CONTENT_W - indentL - indentR;
    const raw = (opts.uppercase ? text.toUpperCase() : text) || "";

    const style = opts.bold && opts.italic
      ? "bolditalic"
      : opts.bold
      ? "bold"
      : opts.italic
      ? "italic"
      : "normal";
    doc.setFont(bodyFont, style);
    doc.setFontSize(size);

    if (opts.spaceBefore) y += opts.spaceBefore;

    const lines: string[] = doc.splitTextToSize(raw, wrapW);
    for (const line of lines) {
      ensureSpace(lineH);
      let x = MARGIN + indentL;
      if (align === "center") x = PAGE_W / 2;
      else if (align === "right") x = PAGE_W - MARGIN - indentR;
      doc.text(line, x, y + size, { align, baseline: "alphabetic" });
      y += lineH;
    }

    if (opts.spaceAfter) y += opts.spaceAfter;
  };

  const drawRule = () => {
    ensureSpace(8);
    doc.setDrawColor(180);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 8;
  };

  // Title
  const title = (script.brief.topic || script.brief.logline || "Script").trim();
  drawWrapped(title, {
    size: 20,
    bold: true,
    align: "center",
    uppercase: isScreenplay,
    spaceAfter: 6,
  });

  // Meta line
  const metaBits: string[] = [];
  if (script.brief.logline) metaBits.push(script.brief.logline);
  if (script.brief.tone) metaBits.push(`Tone: ${script.brief.tone}`);
  if (script.brief.genre) metaBits.push(`Genre: ${script.brief.genre}`);
  if (metaBits.length) {
    drawWrapped(metaBits.join("  ·  "), {
      size: 10,
      italic: true,
      align: "center",
      spaceAfter: 18,
    });
  } else {
    y += 10;
  }

  // Screenplay indents (in points). Tuned to roughly match industry layout
  // within a 1" margin Letter page.
  const CHAR_INDENT = isScreenplay ? 144 : 0;     // ~2"
  const DIALOGUE_INDENT = isScreenplay ? 72 : 0;  // ~1"
  const PAREN_INDENT = isScreenplay ? 108 : 0;    // ~1.5"

  for (const s of script.segments) {
    switch (s.kind) {
      case "section":
        drawWrapped(s.label || "Section", {
          size: 13,
          bold: true,
          uppercase: true,
          spaceBefore: 14,
          spaceAfter: 4,
        });
        drawRule();
        if (s.text) {
          drawWrapped(s.text, { size: 11, spaceAfter: 8 });
        }
        break;

      case "scene_heading":
        drawWrapped(s.label || s.text || "SCENE", {
          size: 12,
          bold: true,
          uppercase: true,
          spaceBefore: 14,
          spaceAfter: 8,
        });
        break;

      case "action":
        drawWrapped(s.text, { size: 11, spaceAfter: 10 });
        break;

      case "transition":
        drawWrapped(s.text || "CUT TO:", {
          size: 11,
          bold: true,
          uppercase: true,
          align: "right",
          spaceBefore: 8,
          spaceAfter: 10,
        });
        break;

      case "direction":
        drawWrapped(`(${s.text})`, {
          size: 11,
          italic: true,
          indentLeft: PAREN_INDENT,
          indentRight: isScreenplay ? PAREN_INDENT : 0,
          spaceAfter: isScreenplay ? 4 : 8,
        });
        break;

      case "dialogue": {
        if (s.label) {
          drawWrapped(s.label, {
            size: 11,
            bold: true,
            uppercase: true,
            indentLeft: CHAR_INDENT,
            spaceBefore: 10,
            spaceAfter: 0,
          });
        }
        drawWrapped(s.text, {
          size: 11,
          indentLeft: DIALOGUE_INDENT,
          indentRight: DIALOGUE_INDENT,
          spaceAfter: 10,
        });
        break;
      }
    }
  }

  // Page numbers (footer) — applied after layout so total count is known.
  const pageCount = doc.getNumberOfPages();
  doc.setFont(bodyFont, "normal");
  doc.setFontSize(9);
  doc.setTextColor(120);
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.text(
      `${i} / ${pageCount}`,
      PAGE_W / 2,
      PAGE_H - MARGIN / 2,
      { align: "center" },
    );
  }
  doc.setTextColor(0);

  const blob = doc.output("blob");
  const name = safeFilename(script.brief.topic || script.brief.logline || "script");
  triggerDownload(blob, `${name}.pdf`);
}

// ============================================================================
// DOCX export
// ----------------------------------------------------------------------------
// Generate a Word document with screenplay/podcast formatting. Screenplay uses
// Courier New (industry standard); podcast uses a more readable serif/sans
// blend. Produced client-side with docx-js — no server round-trip.
// ============================================================================

export async function exportScriptAsDocx(script: PodcastScript) {
  const isScreenplay = script.kind === "screenplay";
  const bodyFont = isScreenplay ? "Courier New" : "Calibri";

  const title = script.brief.topic || script.brief.logline || "Script";

  const children: Paragraph[] = [];

  // Title
  children.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [new TextRun({ text: title, bold: true, size: 36, font: bodyFont })],
    })
  );

  // Meta line
  const metaBits: string[] = [];
  if (script.brief.logline) metaBits.push(script.brief.logline);
  if (script.brief.tone) metaBits.push(`Tone: ${script.brief.tone}`);
  if (script.brief.genre) metaBits.push(`Genre: ${script.brief.genre}`);
  if (metaBits.length) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 360 },
        children: [
          new TextRun({ text: metaBits.join("  ·  "), italics: true, size: 22, font: bodyFont }),
        ],
      })
    );
  }

  // Segments
  for (const s of script.segments) {
    switch (s.kind) {
      case "section":
        children.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 320, after: 120 },
            children: [
              new TextRun({
                text: (s.label || "Section").toUpperCase(),
                bold: true,
                size: 26,
                font: bodyFont,
              }),
            ],
          })
        );
        if (s.text) {
          children.push(
            new Paragraph({
              spacing: { after: 160 },
              children: [new TextRun({ text: s.text, size: 22, font: bodyFont })],
            })
          );
        }
        break;
      case "scene_heading":
        children.push(
          new Paragraph({
            spacing: { before: 320, after: 200 },
            children: [
              new TextRun({
                text: (s.label || s.text || "SCENE").toUpperCase(),
                bold: true,
                size: 24,
                font: bodyFont,
              }),
            ],
          })
        );
        break;
      case "action":
        children.push(
          new Paragraph({
            spacing: { after: 200 },
            children: [new TextRun({ text: s.text, size: 24, font: bodyFont })],
          })
        );
        break;
      case "transition":
        children.push(
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { before: 200, after: 200 },
            children: [
              new TextRun({
                text: (s.text || "CUT TO:").toUpperCase(),
                bold: true,
                size: 24,
                font: bodyFont,
              }),
            ],
          })
        );
        break;
      case "direction":
        if (isScreenplay) {
          // Parenthetical, indented
          children.push(
            new Paragraph({
              indent: { left: 2160 }, // ~1.5"
              spacing: { after: 80 },
              children: [
                new TextRun({ text: `(${s.text})`, italics: true, size: 24, font: bodyFont }),
              ],
            })
          );
        } else {
          children.push(
            new Paragraph({
              spacing: { after: 160 },
              children: [
                new TextRun({ text: `(${s.text})`, italics: true, size: 22, font: bodyFont }),
              ],
            })
          );
        }
        break;
      case "dialogue": {
        if (isScreenplay) {
          // Character cue centered-ish (indented), dialogue indented
          if (s.label) {
            children.push(
              new Paragraph({
                indent: { left: 2880 }, // ~2"
                spacing: { before: 160, after: 0 },
                children: [
                  new TextRun({
                    text: s.label.toUpperCase(),
                    bold: true,
                    size: 24,
                    font: bodyFont,
                  }),
                ],
              })
            );
          }
          children.push(
            new Paragraph({
              indent: { left: 1440, right: 1440 }, // ~1" each side
              spacing: { after: 200 },
              children: [new TextRun({ text: s.text, size: 24, font: bodyFont })],
            })
          );
        } else {
          if (s.label) {
            children.push(
              new Paragraph({
                spacing: { before: 160, after: 0 },
                children: [
                  new TextRun({
                    text: s.label.toUpperCase(),
                    bold: true,
                    size: 22,
                    font: bodyFont,
                  }),
                ],
              })
            );
          }
          children.push(
            new Paragraph({
              spacing: { after: 200 },
              children: [new TextRun({ text: s.text, size: 24, font: bodyFont })],
            })
          );
        }
        break;
      }
      default:
        break;
    }
  }

  const doc = new Document({
    creator: "Noti",
    title,
    styles: {
      default: { document: { run: { font: bodyFont, size: 24 } } },
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: 12240,
              height: 15840,
              orientation: PageOrientation.PORTRAIT,
            },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const name = safeFilename(script.brief.topic || script.brief.logline || "script");
  triggerDownload(blob, `${name}.docx`);
}
