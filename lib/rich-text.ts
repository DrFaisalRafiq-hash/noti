// Helpers for handling note bodies that can be either plain text (legacy) or
// TipTap-generated HTML (rich editor). Detection is intentionally crude — we
// just look for an opening tag at the very start of the trimmed string. That's
// enough because the editor always wraps content in a block element (<p>,
// <ul>, <ol>, <h1/2>, <ul data-type="taskList">, etc.).

import DOMPurify from "dompurify";

const ALLOWED_TAGS = [
  "p", "br", "strong", "em", "u", "s", "code", "pre",
  "h1", "h2", "h3",
  "ul", "ol", "li",
  "blockquote",
  "a",
  // task list (TipTap)
  "div", "label", "span", "input",
];
const ALLOWED_ATTR = ["href", "target", "rel", "data-type", "data-checked", "type", "checked", "contenteditable"];

export function isHtmlBody(s: string | null | undefined): boolean {
  if (!s) return false;
  const t = s.trimStart();
  return t.startsWith("<") && /<\/?[a-z][\s\S]*>/i.test(t);
}

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: true,
  });
}

/**
 * Convert a note body (plain or HTML) to plain text for previews, copy, share,
 * AI prompts, and search. Preserves line breaks and list bullets so the result
 * still scans well at a glance.
 */
export function bodyToPlainText(s: string | null | undefined): string {
  if (!s) return "";
  if (!isHtmlBody(s)) return s;
  if (typeof window === "undefined") {
    // SSR fallback — strip tags very simply.
    return s.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
  }
  const wrapper = document.createElement("div");
  wrapper.innerHTML = sanitizeHtml(s);
  // Convert lists to bullets / numbers, line-break block elements.
  wrapper.querySelectorAll("li").forEach((li) => {
    const isTask = li.getAttribute("data-type") === "taskItem";
    const checked = li.getAttribute("data-checked") === "true";
    const prefix = isTask ? (checked ? "[x] " : "[ ] ") : "• ";
    li.prepend(document.createTextNode(prefix));
  });
  wrapper.querySelectorAll("p, h1, h2, h3, li, blockquote, pre").forEach((el) => {
    el.append(document.createTextNode("\n"));
  });
  const text = (wrapper.textContent ?? "").replace(/\n{3,}/g, "\n\n").trim();
  return text;
}
