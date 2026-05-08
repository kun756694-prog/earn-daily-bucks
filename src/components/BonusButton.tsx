import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Gift, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { claimBonusReward } from "@/lib/points.functions";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

let sdkLoaded = false;
function loadMonetag(): Promise<void> {
  if (sdkLoaded) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://quge5.com/88/tag.min.js";
    s.async = true;
    s.setAttribute("data-zone", "237352");
    s.setAttribute("data-cfasync", "false");
    s.onload = () => { sdkLoaded = true; resolve(); };
    s.onerror = () => reject(new Error("Ad SDK failed to load"));
    document.body.appendChild(s);
  });
}

export function BonusButton({ onClaimed }: { onClaimed?: () => Promise<void> }) {
  const { user, refreshProfile } = useAuth();
  const fn = useServerFn(claimBonusReward);
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  const click = async () => {
    setBusy(true);
    try {
      await loadMonetag();
      // Show ad if SDK exposes a global show function for this zone
      const w = window as any;
      if (typeof w.show_237352 === "function") {
        try { await w.show_237352(); } catch {}
      }
      const res = await fn();
      if (!res.ok) toast.error("Wait a few seconds before clicking again");
      else {
        toast.success("Bonus claimed +10 points");
        await (onClaimed ? onClaimed() : refreshProfile());
      }
    } catch (e: any) {
      const msg =
        e instanceof Response
          ? `Failed (${e.status})`
          : (e?.message ?? "Failed");
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button onClick={click} disabled={busy} size="lg" className="neon-glow">
      {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Gift className="h-4 w-4 mr-2" />}
      {busy ? "Loading…" : "Bonus +10"}
    </Button>
  );
}