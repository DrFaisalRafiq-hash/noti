import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft, ShieldOff, DollarSign, TrendingUp, Wallet, Activity, Loader2,
  Users, Search, Ban, CheckCircle2, Plus, Minus, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

interface ProfitRow { date: string; revenue: number; cost: number; profit: number; calls: number }
interface UsageRow {
  id: string; created_at: string; user_id: string; feature: string; model: string;
  input_tokens: number; output_tokens: number;
  provider_cost_usd: number; charged_credits: number; charged_usd: number; profit_usd: number;
}
interface WalletRow {
  user_id: string; balance_credits: number; lifetime_purchased_credits: number;
  lifetime_granted_credits: number; lifetime_spent_credits: number;
  blocked: boolean; blocked_reason: string | null;
  email?: string; display_name?: string | null;
}

export default function AdminBilling() {
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const [overview, setOverview] = useState<{
    revenue: number; cost: number; profit: number; margin: number; calls: number;
    revenue7: number; cost7: number; profit7: number;
  } | null>(null);
  const [series, setSeries] = useState<ProfitRow[]>([]);
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [wallets, setWallets] = useState<WalletRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState<{ user: WalletRow; action: "grant" | "deduct" | "block" | "unblock" } | null>(null);
  const [pendingValue, setPendingValue] = useState("");
  const [pendingReason, setPendingReason] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session) return navigate("/auth", { replace: true });
      const { data: roleData } = await supabase.rpc("has_role", {
        _user_id: data.session.user.id, _role: "admin",
      });
      setIsAdmin(!!roleData);
      setAuthChecked(true);
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  const load = async () => {
    setLoading(true);
    try {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const [usageRes, walletRes, usersRes] = await Promise.all([
        supabase.from("ai_usage_log")
          .select("id, created_at, user_id, feature, model, input_tokens, output_tokens, provider_cost_usd, charged_credits, charged_usd, profit_usd")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(1000),
        supabase.from("user_wallets")
          .select("user_id, balance_credits, lifetime_purchased_credits, lifetime_granted_credits, lifetime_spent_credits, blocked, blocked_reason")
          .order("balance_credits", { ascending: false }),
        supabase.functions.invoke("admin-list-users"),
      ]);
      if (usageRes.error) throw usageRes.error;
      if (walletRes.error) throw walletRes.error;

      const allUsage = (usageRes.data ?? []) as UsageRow[];
      setUsage(allUsage.slice(0, 200));

      // Aggregate
      let rev = 0, cost = 0, calls = 0, rev7 = 0, cost7 = 0;
      const dayMap = new Map<string, ProfitRow>();
      for (const r of allUsage) {
        const cu = Number(r.charged_usd), pc = Number(r.provider_cost_usd);
        rev += cu; cost += pc; calls += 1;
        if (r.created_at >= since7) { rev7 += cu; cost7 += pc; }
        const d = r.created_at.slice(0, 10);
        const row = dayMap.get(d) ?? { date: d, revenue: 0, cost: 0, profit: 0, calls: 0 };
        row.revenue += cu; row.cost += pc; row.profit += (cu - pc); row.calls += 1;
        dayMap.set(d, row);
      }
      const sortedSeries = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));
      setSeries(sortedSeries);
      setOverview({
        revenue: rev, cost, profit: rev - cost,
        margin: rev > 0 ? ((rev - cost) / rev) * 100 : 0,
        calls,
        revenue7: rev7, cost7, profit7: rev7 - cost7,
      });

      // Merge wallets with user emails
      const userMap = new Map<string, { email: string; display_name: string | null }>();
      const usersData = (usersRes.data as any)?.users ?? [];
      for (const u of usersData) userMap.set(u.id, { email: u.email, display_name: u.display_name });
      const merged: WalletRow[] = (walletRes.data ?? []).map((w: any) => ({
        ...w,
        balance_credits: Number(w.balance_credits),
        lifetime_purchased_credits: Number(w.lifetime_purchased_credits),
        lifetime_granted_credits: Number(w.lifetime_granted_credits),
        lifetime_spent_credits: Number(w.lifetime_spent_credits),
        email: userMap.get(w.user_id)?.email ?? w.user_id.slice(0, 8),
        display_name: userMap.get(w.user_id)?.display_name ?? null,
      }));
      setWallets(merged);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load billing data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  const filteredWallets = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return wallets.slice(0, 100);
    return wallets.filter((w) =>
      (w.email ?? "").toLowerCase().includes(q) || (w.display_name ?? "").toLowerCase().includes(q)
    ).slice(0, 100);
  }, [wallets, query]);

  const runAction = async () => {
    if (!pending) return;
    const { user, action } = pending;
    try {
      const body: any = { action, target_user_id: user.user_id, reason: pendingReason || undefined };
      if (action === "grant" || action === "deduct") {
        const n = Number(pendingValue);
        if (!Number.isFinite(n) || n <= 0) { toast.error("Enter a valid number of credits"); return; }
        body.credits = n;
      }
      const { data, error } = await supabase.functions.invoke("admin-wallet", { body });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Done");
      setPending(null); setPendingValue(""); setPendingReason("");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Action failed");
    }
  };

  if (!authChecked) {
    return <div className="flex min-h-dvh items-center justify-center bg-background">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>;
  }
  if (!isAdmin) {
    return <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background text-center px-6">
      <ShieldOff className="h-10 w-10 text-muted-foreground" />
      <h1 className="font-display text-2xl">Admins only</h1>
      <Link to="/app" className="rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground">Back</Link>
    </div>;
  }

  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        <div className="mb-6 flex items-center justify-between">
          <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft size={16} /> Back to admin
          </Link>
          <button onClick={load} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>

        <h1 className="font-display text-4xl font-semibold tracking-tight">Billing & profit</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Revenue, provider cost, and gross profit from AI usage. Last 30 days.
        </p>

        {/* PROFIT OVERVIEW */}
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Revenue (30d)" value={`$${overview?.revenue.toFixed(2) ?? "0.00"}`} icon={<DollarSign size={14} />} />
          <Stat label="Provider cost (30d)" value={`$${overview?.cost.toFixed(2) ?? "0.00"}`} icon={<Activity size={14} />} tone="muted" />
          <Stat label="Gross profit (30d)" value={`$${overview?.profit.toFixed(2) ?? "0.00"}`} icon={<TrendingUp size={14} />} tone="good" />
          <Stat label="Margin" value={`${overview?.margin.toFixed(1) ?? "0.0"}%`} icon={<TrendingUp size={14} />} />
          <Stat label="Revenue (7d)" value={`$${overview?.revenue7.toFixed(2) ?? "0.00"}`} icon={<DollarSign size={14} />} />
          <Stat label="Cost (7d)" value={`$${overview?.cost7.toFixed(2) ?? "0.00"}`} icon={<Activity size={14} />} tone="muted" />
          <Stat label="Profit (7d)" value={`$${overview?.profit7.toFixed(2) ?? "0.00"}`} icon={<TrendingUp size={14} />} tone="good" />
          <Stat label="AI calls (30d)" value={overview?.calls.toLocaleString() ?? "0"} icon={<Activity size={14} />} />
        </div>

        {/* SPARKLINE */}
        {series.length > 0 && (
          <div className="mt-6 rounded-2xl border bg-card p-5">
            <h3 className="text-sm font-medium">Daily profit (30d)</h3>
            <Sparkline data={series} />
          </div>
        )}

        {/* WALLETS */}
        <div className="mt-10">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet size={16} className="text-muted-foreground" />
              <h2 className="font-display text-2xl font-semibold tracking-tight">User wallets</h2>
            </div>
            <span className="text-xs text-muted-foreground">{wallets.length} total</span>
          </div>
          <div className="mb-3 flex items-center gap-2 rounded-full border bg-card px-4 py-2.5">
            <Search size={14} className="text-muted-foreground" />
            <input
              value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by email or name…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          <div className="overflow-hidden rounded-2xl border">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : filteredWallets.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">No wallets yet.</div>
            ) : (
              <ul className="divide-y">
                {filteredWallets.map((w) => (
                  <li key={w.user_id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">
                          {w.display_name || w.email}
                        </p>
                        {w.blocked && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-destructive">
                            <Ban size={9} /> Blocked
                          </span>
                        )}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{w.email}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
                        Balance <strong className="text-foreground">{w.balance_credits.toLocaleString()}</strong> ·
                        Bought {w.lifetime_purchased_credits.toLocaleString()} ·
                        Granted {w.lifetime_granted_credits.toLocaleString()} ·
                        Spent {w.lifetime_spent_credits.toLocaleString()}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Btn icon={<Plus size={11} />} label="Grant" onClick={() => { setPending({ user: w, action: "grant" }); setPendingValue("100"); }} />
                      <Btn icon={<Minus size={11} />} label="Deduct" onClick={() => { setPending({ user: w, action: "deduct" }); setPendingValue("100"); }} />
                      {w.blocked
                        ? <Btn icon={<CheckCircle2 size={11} />} label="Unblock" onClick={() => setPending({ user: w, action: "unblock" })} />
                        : <Btn icon={<Ban size={11} />} label="Block" tone="warn" onClick={() => setPending({ user: w, action: "block" })} />}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* USAGE LEDGER */}
        <div className="mt-10">
          <div className="mb-3 flex items-center gap-2">
            <Activity size={16} className="text-muted-foreground" />
            <h2 className="font-display text-2xl font-semibold tracking-tight">Usage ledger</h2>
          </div>
          <p className="mb-3 text-sm text-muted-foreground">Last 200 AI calls with cost & profit.</p>
          <div className="overflow-hidden rounded-2xl border">
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-muted/40 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">When</th>
                    <th className="px-3 py-2">Feature</th>
                    <th className="px-3 py-2">Model</th>
                    <th className="px-3 py-2 text-right">Tokens</th>
                    <th className="px-3 py-2 text-right">Cost</th>
                    <th className="px-3 py-2 text-right">Charged</th>
                    <th className="px-3 py-2 text-right">Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {usage.map((u) => (
                    <tr key={u.id} className="tabular-nums">
                      <td className="px-3 py-2 whitespace-nowrap">{new Date(u.created_at).toLocaleString()}</td>
                      <td className="px-3 py-2">{u.feature}</td>
                      <td className="px-3 py-2 text-muted-foreground">{u.model}</td>
                      <td className="px-3 py-2 text-right">{u.input_tokens + u.output_tokens}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">${Number(u.provider_cost_usd).toFixed(4)}</td>
                      <td className="px-3 py-2 text-right">${Number(u.charged_usd).toFixed(4)}</td>
                      <td className="px-3 py-2 text-right text-emerald-600 dark:text-emerald-400">${Number(u.profit_usd).toFixed(4)}</td>
                    </tr>
                  ))}
                  {usage.length === 0 && !loading && (
                    <tr><td colSpan={7} className="py-10 text-center text-sm text-muted-foreground">No AI usage yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ACTION DIALOG */}
      {pending && (
        <div className="fixed inset-0 safe-overlay z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm" onClick={() => setPending(null)}>
          <div className="w-full max-w-sm rounded-2xl border bg-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg font-semibold">
              {pending.action === "grant" ? "Grant credits" :
               pending.action === "deduct" ? "Deduct credits" :
               pending.action === "block" ? "Block AI access" : "Unblock AI access"}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">{pending.user.email}</p>

            {(pending.action === "grant" || pending.action === "deduct") && (
              <div className="mt-3">
                <label className="text-xs font-medium text-muted-foreground">Credits</label>
                <input
                  type="number" min={1} value={pendingValue}
                  onChange={(e) => setPendingValue(e.target.value)}
                  className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none"
                />
              </div>
            )}
            <div className="mt-3">
              <label className="text-xs font-medium text-muted-foreground">Reason (optional)</label>
              <input
                value={pendingReason} onChange={(e) => setPendingReason(e.target.value)}
                placeholder="e.g. Refund for failed call"
                className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none"
              />
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setPending(null)} className="rounded-full px-4 py-2 text-sm text-muted-foreground hover:bg-accent">Cancel</button>
              <button
                onClick={runAction}
                className={`rounded-full px-4 py-2 text-sm font-medium ${
                  pending.action === "block" || pending.action === "deduct"
                    ? "bg-destructive text-destructive-foreground"
                    : "bg-primary text-primary-foreground"
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, icon, tone }: { label: string; value: string; icon: React.ReactNode; tone?: "good" | "muted" }) {
  const cls = tone === "good"
    ? "text-emerald-600 dark:text-emerald-400"
    : tone === "muted" ? "text-muted-foreground" : "text-foreground";
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        {icon}{label}
      </div>
      <div className={`mt-1.5 font-display text-2xl font-semibold tabular-nums ${cls}`}>{value}</div>
    </div>
  );
}

function Btn({ icon, label, onClick, tone }: { icon: React.ReactNode; label: string; onClick: () => void; tone?: "warn" }) {
  const cls = tone === "warn"
    ? "border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
    : "border-border text-foreground hover:bg-accent";
  return (
    <button type="button" onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${cls}`}>
      {icon}{label}
    </button>
  );
}

function Sparkline({ data }: { data: ProfitRow[] }) {
  const w = 600, h = 80, pad = 4;
  const max = Math.max(0.001, ...data.map((d) => Math.max(d.revenue, d.cost)));
  const xStep = (w - pad * 2) / Math.max(1, data.length - 1);
  const y = (v: number) => h - pad - (v / max) * (h - pad * 2);
  const path = (key: keyof ProfitRow) =>
    data.map((d, i) => `${i === 0 ? "M" : "L"} ${pad + i * xStep} ${y(Number(d[key]))}`).join(" ");
  return (
    <div className="mt-3 overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none">
        <path d={path("revenue")} fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" />
        <path d={path("cost")} fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="1.5" strokeDasharray="3 3" />
        <path d={path("profit")} fill="none" stroke="hsl(142 71% 45%)" strokeWidth="2" />
      </svg>
      <div className="mt-2 flex gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-3 bg-primary" /> Revenue</span>
        <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-3 bg-muted-foreground" /> Cost</span>
        <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-3 bg-emerald-500" /> Profit</span>
      </div>
    </div>
  );
}
