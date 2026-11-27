import { useEffect, useState } from "react";
import type { Session, SupabaseClient } from "./index";

export function useAccount(db?: SupabaseClient) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!db) return;
    const { data } = db.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, [db]);
  return { session, ready };
}
