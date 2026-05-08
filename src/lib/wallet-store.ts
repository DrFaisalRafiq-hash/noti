import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Wallet {
  balance_credits: number;
  lifetime_purchased_credits: number;
  lifetime_granted_credits: number;
  lifetime_spent_credits: number;
  blocked: boolean;
  blocked_reason: string | null;
}

const ZERO: Wallet = {
  balance_credits: 0,
  lifetime_purchased_credits: 0,
  lifetime_granted_credits: 0,
  lifetime_spent_credits: 0,
  blocked: false,
  blocked_reason: null,
};

let cached: Wallet | null = null;
const listeners = new Set<(w: Wallet) => void>();

function emit(w: Wallet) {
  cached = w;
  listeners.forEach((l) => l(w));
}

export async function fetchWallet(): Promise<Wallet> {
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user.id;
  if (!uid) {
    emit(ZERO);
    return ZERO;
  }
  const { data, error } = await supabase
    .from("user_wallets")
    .select("balance_credits, lifetime_purchased_credits, lifetime_granted_credits, lifetime_spent_credits, blocked, blocked_reason")
    .eq("user_id", uid)
    .maybeSingle();
  if (error || !data) {
    emit(ZERO);
    return ZERO;
  }
  const w: Wallet = {
    balance_credits: Number(data.balance_credits ?? 0),
    lifetime_purchased_credits: Number(data.lifetime_purchased_credits ?? 0),
    lifetime_granted_credits: Number(data.lifetime_granted_credits ?? 0),
    lifetime_spent_credits: Number(data.lifetime_spent_credits ?? 0),
    blocked: !!data.blocked,
    blocked_reason: data.blocked_reason,
  };
  emit(w);
  return w;
}

export function useWallet() {
  const [wallet, setWallet] = useState<Wallet>(cached ?? ZERO);
  useEffect(() => {
    listeners.add(setWallet);
    fetchWallet();
    return () => {
      listeners.delete(setWallet);
    };
  }, []);
  const refresh = useCallback(() => fetchWallet(), []);
  return { wallet, refresh };
}

export const TOPUP_PACKS = [
  { id: "credits_5",  usd: 5,  credits: 500,   bonus: 0,    label: "Starter" },
  { id: "credits_20", usd: 20, credits: 2200,  bonus: 200,  label: "Plus" },
  { id: "credits_50", usd: 50, credits: 6000,  bonus: 1000, label: "Pro" },
] as const;

export async function startTopUp(opts: { pack?: string; customUsd?: number }): Promise<string> {
  const body = opts.pack ? { pack: opts.pack } : { custom_usd: opts.customUsd };
  const { data, error } = await supabase.functions.invoke("create-checkout", { body });
  if (error) throw new Error(error.message);
  if ((data as any)?.error) throw new Error((data as any).error);
  const url = (data as any)?.url as string;
  if (!url) throw new Error("Could not start checkout");
  return url;
}

// Helper: detect 402 paywall errors from any AI invoke.
export function isPaywallError(err: unknown): boolean {
  if (!err) return false;
  const code = (err as any)?.code;
  if (code === "insufficient_credits") return true;
  if ((err as any)?.status === 402) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /insufficient_credits|not enough credits/i.test(msg);
}
export function isBlockedError(err: unknown): boolean {
  if (!err) return false;
  const code = (err as any)?.code;
  if (code === "wallet_blocked") return true;
  if ((err as any)?.status === 403) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /wallet_blocked|disabled for this account/i.test(msg);
}

// Dispatch a global event to open the top-up sheet from anywhere.
export type PaywallReason = "insufficient" | "blocked" | "manual";
export function openTopUpSheet(reason: PaywallReason = "manual", message?: string) {
  window.dispatchEvent(
    new CustomEvent("noti:open-topup", { detail: { reason, message } })
  );
}

// If err is a paywall, open the top-up sheet and return true.
export function handleAiError(err: unknown): boolean {
  if (isBlockedError(err)) {
    openTopUpSheet("blocked", err instanceof Error ? err.message : undefined);
    return true;
  }
  if (isPaywallError(err)) {
    openTopUpSheet("insufficient", err instanceof Error ? err.message : undefined);
    return true;
  }
  return false;
}
