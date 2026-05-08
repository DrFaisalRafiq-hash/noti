import { useEffect, useState } from "react";
import {
  getLongPressPrefs,
  subscribeLongPressPrefs,
  type LongPressPrefs,
} from "@/lib/long-press-prefs";

/**
 * React subscription to the global long-press preferences. Components
 * re-render when the user adjusts duration / slop (e.g. from Settings).
 */
export function useLongPressPrefs(): LongPressPrefs {
  const [prefs, setPrefs] = useState<LongPressPrefs>(() => getLongPressPrefs());
  useEffect(() => subscribeLongPressPrefs(setPrefs), []);
  return prefs;
}
