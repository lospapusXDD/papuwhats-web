import { useEffect, useState } from "react";
import { AuthScreen } from "@/components/papu/auth-screen";
import { Messenger } from "@/components/papu/messenger";
import { usePapu } from "@/lib/papu/store";

export function PapuRoot() {
  const sessionUserId = usePapu((s) => s.sessionUserId);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const finish = () => setHydrated(true);
    const unsub = usePapu.persist.onFinishHydration(finish);
    void usePapu.persist.rehydrate();
    return unsub;
  }, []);

  if (!hydrated || !sessionUserId) return <AuthScreen />;
  return <Messenger />;
}