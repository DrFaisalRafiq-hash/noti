// ============================================================================
// useCast — single source of cast/personas state for the editor.
// ----------------------------------------------------------------------------
// Loaded once at the editor level so SegmentRow + CastPanel share state and
// auto-refresh together when assignments change.
// ============================================================================

import { useCallback, useEffect, useState } from "react";
import {
  buildCastIndex,
  listCast,
  listPersonas,
  type CastPersona,
  type ScriptCastRow,
} from "@/lib/cast";
import { supabase } from "@/integrations/supabase/client";

export interface CastState {
  personas: CastPersona[];
  cast: ScriptCastRow[];
  index: Map<string, CastPersona>;
  /** True until the first load completes. */
  loading: boolean;
  /** True when there is no signed-in user (RLS blocks reads). */
  signedOut: boolean;
  refresh: () => Promise<void>;
}

export function useCast(): CastState {
  const [personas, setPersonas] = useState<CastPersona[]>([]);
  const [cast, setCast] = useState<ScriptCastRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [signedOut, setSignedOut] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        setSignedOut(true);
        setPersonas([]);
        setCast([]);
        return;
      }
      setSignedOut(false);
      const [p, c] = await Promise.all([listPersonas(), listCast()]);
      setPersonas(p);
      setCast(c);
    } catch (e) {
      console.error("[useCast]", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    personas,
    cast,
    index: buildCastIndex(cast, personas),
    loading,
    signedOut,
    refresh,
  };
}
