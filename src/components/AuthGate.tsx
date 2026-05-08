import { useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import LockScreen from "./LockScreen";

/**
 * Gates the app behind a real Lovable Cloud session. Subscribes to auth state
 * changes BEFORE checking the existing session so token refreshes and
 * sign-outs propagate immediately.
 */
export default function AuthGate({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session);
    });
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (authed === null) {
    return <div className="fixed inset-0 bg-background" aria-hidden />;
  }
  if (!authed) return <LockScreen onUnlock={() => setAuthed(true)} />;
  return <>{children}</>;
}
