import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  History,
  Loader2,
  Search,
  Shield,
  ShieldOff,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface AdminUser {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  banned: boolean;
  banned_until: string | null;
  provider: string;
  roles: string[];
  display_name: string | null;
  avatar_url: string | null;
}

interface ActivityCounts {
  notes: number;
  folders: number;
  voice_memos: number;
}

interface AuditEntry {
  id: string;
  actor_email: string | null;
  action: string;
  target_email: string | null;
  target_user_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export default function Admin() {
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [callerId, setCallerId] = useState<string | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [activity, setActivity] = useState<Record<string, ActivityCounts>>({});
  const [pendingAction, setPendingAction] = useState<
    | { kind: "ban" | "unban" | "delete" | "grant_admin" | "revoke_admin"; user: AdminUser }
    | null
  >(null);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session) {
        navigate("/auth", { replace: true });
        return;
      }
      setCallerId(data.session.user.id);
      const { data: roleData } = await supabase.rpc("has_role", {
        _user_id: data.session.user.id,
        _role: "admin",
      });
      setIsAdmin(!!roleData);
      setAuthChecked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-list-users");
      if (error) throw error;
      const list: AdminUser[] = data?.users ?? [];
      setUsers(list);

      // Fetch per-user activity counts (notes/folders/voice memos by device_id is
      // anonymous — for real per-user counts we need user_id columns, which the
      // current schema doesn't have. We therefore show zeros for now and instead
      // surface auth-level signals: confirmed, last sign-in, provider, banned.)
      // If you ever migrate notes to user_id, this is where the counts go.
      setActivity({});
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLog = async () => {
    setAuditLoading(true);
    try {
      const { data, error } = await supabase
        .from("admin_audit_log")
        .select("id, actor_email, action, target_email, target_user_id, details, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setAuditLog((data ?? []) as AuditEntry[]);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to load audit log");
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    if (authChecked && isAdmin) {
      fetchUsers();
      fetchAuditLog();
    }
  }, [authChecked, isAdmin]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        (u.display_name ?? "").toLowerCase().includes(q),
    );
  }, [users, query]);

  const stats = useMemo(() => {
    const total = users.length;
    const last7 = users.filter(
      (u) => new Date(u.created_at).getTime() > Date.now() - 7 * 86400_000,
    ).length;
    const active = users.filter(
      (u) =>
        u.last_sign_in_at &&
        new Date(u.last_sign_in_at).getTime() > Date.now() - 7 * 86400_000,
    ).length;
    const admins = users.filter((u) => u.roles.includes("admin")).length;
    return { total, last7, active, admins };
  }, [users]);

  const runAction = async () => {
    if (!pendingAction) return;
    const { kind, user } = pendingAction;
    try {
      const { error } = await supabase.functions.invoke("admin-users", {
        body: { action: kind, user_id: user.id },
      });
      if (error) throw error;
      toast.success(
        kind === "ban"
          ? `Banned ${user.email}`
          : kind === "unban"
            ? `Unbanned ${user.email}`
            : kind === "delete"
              ? `Deleted ${user.email}`
              : kind === "grant_admin"
                ? `Granted admin to ${user.email}`
                : `Revoked admin from ${user.email}`,
      );
      setPendingAction(null);
      fetchUsers();
      fetchAuditLog();
    } catch (err: any) {
      toast.error(err?.message ?? "Action failed");
    }
  };

  if (!authChecked) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <ShieldOff className="h-10 w-10 text-muted-foreground" />
        <h1 className="font-display text-2xl">Admins only</h1>
        <p className="text-sm text-muted-foreground">
          Your account doesn't have admin access.
        </p>
        <Link
          to="/app"
          className="mt-2 rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground"
        >
          Back to Noti
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Link
            to="/app"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft size={16} /> Back to app
          </Link>
          <div className="flex items-center gap-3">
            <Link
              to="/admin/brand"
              className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
            >
              🎨 Brand kit
            </Link>
            <Link
              to="/admin/billing"
              className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
            >
              💰 Billing & profit
            </Link>
            <Link
              to="/admin/support"
              className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
            >
              🎫 Support
            </Link>
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
              <Shield size={14} /> Admin
            </div>
          </div>
        </div>

        <h1 className="font-display text-4xl font-semibold tracking-tight">Signups</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Everyone who's joined Noti, with quick actions.
        </p>

        {/* STATS */}
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total signups" value={stats.total} icon={<Users size={16} />} />
          <StatCard label="Last 7 days" value={stats.last7} icon={<Users size={16} />} />
          <StatCard label="Active (7d)" value={stats.active} icon={<UserCheck size={16} />} />
          <StatCard label="Admins" value={stats.admins} icon={<Shield size={16} />} />
        </div>

        {/* SEARCH */}
        <div className="mt-6 flex items-center gap-2 rounded-full border bg-card px-4 py-2.5">
          <Search size={14} className="text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by email or name…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        {/* LIST */}
        <div className="mt-4 overflow-hidden rounded-2xl border">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              {users.length === 0 ? "No signups yet." : "No matches."}
            </div>
          ) : (
            <ul className="divide-y">
              {filtered.map((u) => {
                const isSelf = u.id === callerId;
                const isUserAdmin = u.roles.includes("admin");
                return (
                  <li
                    key={u.id}
                    className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
                        {(u.display_name || u.email)[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium">
                            {u.display_name || u.email.split("@")[0]}
                          </p>
                          {isUserAdmin && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-primary">
                              <Shield size={9} /> Admin
                            </span>
                          )}
                          {u.banned && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-destructive">
                              <Ban size={9} /> Banned
                            </span>
                          )}
                          {!u.email_confirmed_at && (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                              Unconfirmed
                            </span>
                          )}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          Joined {new Date(u.created_at).toLocaleDateString()} ·{" "}
                          {u.provider === "email" ? "Email" : u.provider} ·{" "}
                          {u.last_sign_in_at
                            ? `Last seen ${new Date(u.last_sign_in_at).toLocaleDateString()}`
                            : "Never signed in"}
                        </p>
                      </div>
                    </div>

                    {!isSelf && (
                      <div className="flex flex-wrap items-center gap-2">
                        {isUserAdmin ? (
                          <ActionBtn
                            label="Revoke admin"
                            icon={<ShieldOff size={12} />}
                            onClick={() => setPendingAction({ kind: "revoke_admin", user: u })}
                          />
                        ) : (
                          <ActionBtn
                            label="Make admin"
                            icon={<Shield size={12} />}
                            onClick={() => setPendingAction({ kind: "grant_admin", user: u })}
                          />
                        )}
                        {u.banned ? (
                          <ActionBtn
                            label="Unban"
                            icon={<CheckCircle2 size={12} />}
                            onClick={() => setPendingAction({ kind: "unban", user: u })}
                          />
                        ) : (
                          <ActionBtn
                            label="Ban"
                            icon={<Ban size={12} />}
                            tone="warn"
                            onClick={() => setPendingAction({ kind: "ban", user: u })}
                          />
                        )}
                        <ActionBtn
                          label="Delete"
                          icon={<Trash2 size={12} />}
                          tone="danger"
                          onClick={() => setPendingAction({ kind: "delete", user: u })}
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* AUDIT LOG */}
        <div className="mt-10">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History size={16} className="text-muted-foreground" />
              <h2 className="font-display text-2xl font-semibold tracking-tight">Audit log</h2>
            </div>
            <button
              type="button"
              onClick={fetchAuditLog}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Refresh
            </button>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            Last 50 admin actions, newest first.
          </p>
          <div className="overflow-hidden rounded-2xl border">
            {auditLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : auditLog.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No admin actions recorded yet.
              </div>
            ) : (
              <ul className="divide-y">
                {auditLog.map((entry) => (
                  <li key={entry.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <AuditTag action={entry.action} />
                        <span className="truncate text-sm">
                          <span className="font-medium">{entry.actor_email ?? "unknown admin"}</span>
                          <span className="text-muted-foreground"> → </span>
                          <span className="font-medium">{entry.target_email ?? entry.target_user_id ?? "unknown"}</span>
                        </span>
                      </div>
                    </div>
                    <span className="text-[11px] text-muted-foreground sm:text-xs">
                      {new Date(entry.created_at).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <AlertDialog open={!!pendingAction} onOpenChange={(o) => !o && setPendingAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction?.kind === "delete"
                ? "Delete this user?"
                : pendingAction?.kind === "ban"
                  ? "Ban this user?"
                  : pendingAction?.kind === "unban"
                    ? "Unban this user?"
                    : pendingAction?.kind === "grant_admin"
                      ? "Grant admin role?"
                      : "Revoke admin role?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.kind === "delete"
                ? `Permanently deletes ${pendingAction.user.email} and all their auth data. This cannot be undone.`
                : pendingAction?.kind === "ban"
                  ? `Prevents ${pendingAction?.user.email} from signing in.`
                  : pendingAction?.kind === "unban"
                    ? `Restores sign-in access for ${pendingAction?.user.email}.`
                    : pendingAction?.kind === "grant_admin"
                      ? `${pendingAction?.user.email} will be able to access this admin page and manage all users.`
                      : `${pendingAction?.user.email} will lose admin access.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={runAction}
              className={
                pendingAction?.kind === "delete" || pendingAction?.kind === "ban"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : ""
              }
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-2 font-display text-3xl font-semibold">{value}</div>
    </div>
  );
}

function ActionBtn({
  label,
  icon,
  onClick,
  tone,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  tone?: "warn" | "danger";
}) {
  const cls =
    tone === "danger"
      ? "border-destructive/40 text-destructive hover:bg-destructive/10"
      : tone === "warn"
        ? "border-amber-500/40 text-amber-600 hover:bg-amber-500/10 dark:text-amber-400"
        : "border-border text-foreground hover:bg-accent";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${cls}`}
    >
      {icon}
      {label}
    </button>
  );
}

function AuditTag({ action }: { action: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    ban: { label: "Banned", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
    unban: { label: "Unbanned", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
    delete: { label: "Deleted", cls: "bg-destructive/15 text-destructive" },
    grant_admin: { label: "Made admin", cls: "bg-primary/15 text-primary" },
    revoke_admin: { label: "Revoked admin", cls: "bg-muted text-muted-foreground" },
  };
  const entry = map[action] ?? { label: action, cls: "bg-muted text-muted-foreground" };
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${entry.cls}`}>
      {entry.label}
    </span>
  );
}
