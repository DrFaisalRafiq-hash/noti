import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

// ── Types ──────────────────────────────────────────────────────────────
export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
export type TicketPriority = "low" | "normal" | "high" | "urgent";

export interface SupportTicket {
  id: string;
  ticket_number: string;
  user_id: string;
  user_email: string | null;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  assigned_to: string | null;
  page_url: string | null;
  user_agent: string | null;
  app_version: string | null;
  diagnostics: Record<string, unknown>;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
}

export interface SupportComment {
  id: string;
  ticket_id: string;
  author_id: string;
  author_role: "user" | "admin";
  body: string;
  is_internal: boolean;
  created_at: string;
}

export interface SupportAttachment {
  id: string;
  ticket_id: string;
  user_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  signed_url?: string;
}

// ── Validation ─────────────────────────────────────────────────────────
export const newTicketSchema = z.object({
  subject: z
    .string()
    .trim()
    .min(3, "Subject must be at least 3 characters")
    .max(140, "Subject must be 140 characters or less"),
  description: z
    .string()
    .trim()
    .min(10, "Please describe the issue (at least 10 characters)")
    .max(4000, "Description is too long (max 4000 characters)"),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
});

export const commentSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Comment can't be empty")
    .max(4000, "Comment too long (max 4000 characters)"),
  is_internal: z.boolean().default(false),
});

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_ATTACHMENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
];

// ── Diagnostics ────────────────────────────────────────────────────────
export function captureDiagnostics(): {
  page_url: string;
  user_agent: string;
  app_version: string;
  diagnostics: Record<string, unknown>;
} {
  const nav = typeof navigator !== "undefined" ? navigator : ({} as Navigator);
  const win = typeof window !== "undefined" ? window : ({} as Window);
  const screen = (win as Window).screen;
  return {
    page_url: typeof window !== "undefined" ? window.location.href : "",
    user_agent: nav.userAgent ?? "",
    app_version: import.meta.env.VITE_APP_VERSION ?? "dev",
    diagnostics: {
      language: nav.language,
      platform: (nav as Navigator).platform,
      viewport: screen ? `${screen.width}x${screen.height}` : null,
      online: nav.onLine,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      pwa_standalone:
        typeof window !== "undefined" &&
        window.matchMedia?.("(display-mode: standalone)").matches,
    },
  };
}

// ── Tickets ────────────────────────────────────────────────────────────
export async function createTicket(input: {
  subject: string;
  description: string;
  priority?: TicketPriority;
}): Promise<SupportTicket> {
  const parsed = newTicketSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { data: sess } = await supabase.auth.getSession();
  const user = sess.session?.user;
  if (!user) throw new Error("You must be signed in to submit a ticket");

  const diag = captureDiagnostics();
  const { data, error } = await supabase
    .from("support_tickets")
    .insert({
      user_id: user.id,
      user_email: user.email ?? null,
      subject: parsed.data.subject,
      description: parsed.data.description,
      priority: parsed.data.priority ?? "normal",
      page_url: diag.page_url,
      user_agent: diag.user_agent,
      app_version: diag.app_version,
      diagnostics: diag.diagnostics as never,
    })
    .select()
    .single();
  if (error) throw error;
  return data as SupportTicket;
}

export async function listMyTickets(): Promise<SupportTicket[]> {
  const { data, error } = await supabase
    .from("support_tickets")
    .select("*")
    .order("last_activity_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SupportTicket[];
}

export async function getTicketByNumber(num: string): Promise<SupportTicket | null> {
  const cleaned = num.trim().toUpperCase();
  const { data, error } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("ticket_number", cleaned)
    .maybeSingle();
  if (error) throw error;
  return (data as SupportTicket) ?? null;
}

export async function getTicketById(id: string): Promise<SupportTicket | null> {
  const { data, error } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as SupportTicket) ?? null;
}

export async function adminListTickets(filters?: {
  status?: TicketStatus | "all";
  search?: string;
}): Promise<SupportTicket[]> {
  let q = supabase.from("support_tickets").select("*").order("last_activity_at", { ascending: false });
  if (filters?.status && filters.status !== "all") q = q.eq("status", filters.status);
  if (filters?.search) {
    const s = filters.search.trim();
    if (s) q = q.or(`ticket_number.ilike.%${s}%,subject.ilike.%${s}%,user_email.ilike.%${s}%`);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as SupportTicket[];
}

export async function updateTicket(
  id: string,
  patch: Partial<Pick<SupportTicket, "status" | "priority" | "assigned_to">>,
): Promise<void> {
  const { error } = await supabase.from("support_tickets").update(patch).eq("id", id);
  if (error) throw error;
}

// ── Comments ───────────────────────────────────────────────────────────
export async function listComments(ticketId: string): Promise<SupportComment[]> {
  const { data, error } = await supabase
    .from("support_ticket_comments")
    .select("*")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as SupportComment[];
}

export async function addComment(
  ticketId: string,
  body: string,
  opts?: { isInternal?: boolean; asAdmin?: boolean },
): Promise<SupportComment> {
  const parsed = commentSchema.safeParse({ body, is_internal: !!opts?.isInternal });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid comment");
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user.id;
  if (!uid) throw new Error("Sign in required");
  const { data, error } = await supabase
    .from("support_ticket_comments")
    .insert({
      ticket_id: ticketId,
      author_id: uid,
      author_role: opts?.asAdmin ? "admin" : "user",
      body: parsed.data.body,
      is_internal: parsed.data.is_internal,
    })
    .select()
    .single();
  if (error) throw error;
  return data as SupportComment;
}

// ── Attachments ────────────────────────────────────────────────────────
const BUCKET = "support-attachments";

export async function listAttachments(ticketId: string): Promise<SupportAttachment[]> {
  const { data, error } = await supabase
    .from("support_ticket_attachments")
    .select("*")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const items = (data ?? []) as SupportAttachment[];
  // Sign each url for viewing
  await Promise.all(
    items.map(async (a) => {
      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(a.storage_path, 60 * 10);
      a.signed_url = signed?.signedUrl;
    }),
  );
  return items;
}

export async function uploadAttachment(ticketId: string, file: File): Promise<SupportAttachment> {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error(`Files must be 5 MB or smaller (yours is ${(file.size / 1024 / 1024).toFixed(1)} MB)`);
  }
  if (!ALLOWED_ATTACHMENT_TYPES.includes(file.type)) {
    throw new Error("Unsupported file type — please upload an image, PDF, or text file");
  }
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user.id;
  if (!uid) throw new Error("Sign in required");

  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-120);
  const path = `${uid}/${ticketId}/${Date.now()}-${safeName}`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) throw upErr;

  const { data, error } = await supabase
    .from("support_ticket_attachments")
    .insert({
      ticket_id: ticketId,
      user_id: uid,
      storage_path: path,
      file_name: file.name.slice(0, 200),
      mime_type: file.type,
      size_bytes: file.size,
    })
    .select()
    .single();
  if (error) throw error;
  return data as SupportAttachment;
}

// ── Labels ─────────────────────────────────────────────────────────────
export const STATUS_LABEL: Record<TicketStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  closed: "Closed",
};

export const STATUS_COLOR: Record<TicketStatus, string> = {
  open: "text-blue-600 bg-blue-500/10 border-blue-500/30",
  in_progress: "text-amber-600 bg-amber-500/10 border-amber-500/30",
  resolved: "text-emerald-600 bg-emerald-500/10 border-emerald-500/30",
  closed: "text-zinc-600 bg-zinc-500/10 border-zinc-500/30",
};

export const PRIORITY_LABEL: Record<TicketPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

export const PRIORITY_COLOR: Record<TicketPriority, string> = {
  low: "text-zinc-600",
  normal: "text-foreground",
  high: "text-amber-600",
  urgent: "text-rose-600",
};
