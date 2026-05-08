/**
 * Note PIN lock helpers.
 *
 * One global PIN per user. The PIN itself is never stored; we keep a
 * SHA-256 hash (with a per-user salt = the user id) on `profiles`.
 * Locked notes are persisted via the `notes.locked` column.
 *
 * Unlocked notes are tracked in-memory only for the current session
 * (a Set keyed by note id). Refreshing the page re-locks them.
 */

import { supabase } from "@/integrations/supabase/client";

export type PinLength = 4 | 6;

// ─── In-memory unlock cache (session-only) ──────────────────────────────────
const unlocked = new Set<string>();
const listeners = new Set<() => void>();

function notify() {
  for (const fn of listeners) fn();
}

export function isUnlocked(noteId: string): boolean {
  return unlocked.has(noteId);
}

export function markUnlocked(noteId: string) {
  if (unlocked.has(noteId)) return;
  unlocked.add(noteId);
  notify();
}

export function relock(noteId: string) {
  if (!unlocked.delete(noteId)) return;
  notify();
}

export function relockAll() {
  if (unlocked.size === 0) return;
  unlocked.clear();
  notify();
}

export function subscribeUnlocks(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ─── PIN hashing ────────────────────────────────────────────────────────────
async function sha256(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashPin(pin: string, userId: string): Promise<string> {
  return sha256(`noti-pin:${userId}:${pin}`);
}

export function isValidPin(pin: string): pin is string {
  return /^\d+$/.test(pin) && (pin.length === 4 || pin.length === 6);
}

// ─── Profile PIN storage ────────────────────────────────────────────────────
export interface PinProfile {
  hasPin: boolean;
  pinLength: PinLength | null;
  userId: string;
}

export async function loadPinProfile(): Promise<PinProfile | null> {
  const { data: u } = await supabase.auth.getUser();
  const userId = u.user?.id;
  if (!userId) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("pin_hash, pin_length")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return {
    hasPin: !!data?.pin_hash,
    pinLength: (data?.pin_length as PinLength | null) ?? null,
    userId,
  };
}

/** Set or replace the user's note PIN. */
export async function savePin(pin: string): Promise<void> {
  if (!isValidPin(pin)) throw new Error("PIN must be 4 or 6 digits");
  const { data: u } = await supabase.auth.getUser();
  const userId = u.user?.id;
  if (!userId) throw new Error("Not signed in");
  const hash = await hashPin(pin, userId);
  const { error } = await supabase
    .from("profiles")
    .update({ pin_hash: hash, pin_length: pin.length })
    .eq("user_id", userId);
  if (error) throw error;
}

/** Remove the user's PIN. Caller should also unlock all notes first. */
export async function clearPin(): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  const userId = u.user?.id;
  if (!userId) throw new Error("Not signed in");
  const { error } = await supabase
    .from("profiles")
    .update({ pin_hash: null, pin_length: null })
    .eq("user_id", userId);
  if (error) throw error;
}

/** Verify a PIN attempt against the stored hash. */
export async function verifyPin(pin: string): Promise<boolean> {
  if (!isValidPin(pin)) return false;
  const { data: u } = await supabase.auth.getUser();
  const userId = u.user?.id;
  if (!userId) return false;
  const { data } = await supabase
    .from("profiles")
    .select("pin_hash")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data?.pin_hash) return false;
  const candidate = await hashPin(pin, userId);
  // constant-time-ish compare
  if (candidate.length !== data.pin_hash.length) return false;
  let mismatch = 0;
  for (let i = 0; i < candidate.length; i++) {
    mismatch |= candidate.charCodeAt(i) ^ data.pin_hash.charCodeAt(i);
  }
  return mismatch === 0;
}
