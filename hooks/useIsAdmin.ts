import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

let cached: boolean | null = null;
const listeners = new Set<(v: boolean) => void>();

async function refresh() {
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user.id;
  if (!uid) {
    cached = false;
    listeners.forEach((l) => l(false));
    return;
  }
  const { data } = await supabase.rpc("has_role", { _user_id: uid, _role: "admin" });
  cached = !!data;
  listeners.forEach((l) => l(cached!));
}

supabase.auth.onAuthStateChange(() => {
  cached = null;
  refresh();
});

export function useIsAdmin(): boolean {
  const [isAdmin, setIsAdmin] = useState<boolean>(cached ?? false);
  useEffect(() => {
    listeners.add(setIsAdmin);
    if (cached === null) refresh();
    return () => {
      listeners.delete(setIsAdmin);
    };
  }, []);
  return isAdmin;
}
