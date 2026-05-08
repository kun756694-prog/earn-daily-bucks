import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Coins } from "lucide-react";

export const Route = createFileRoute("/earn")({
  component: EarnPage,
  head: () => ({ meta: [{ title: "Offer Wall — CryptoRewards" }] }),
});

function EarnPage() {
  const { user, profile, loading } = useAuth();
  const nav = useNavigate();
  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [loading, user, nav]);
  if (!user) return null;

  // CPAGrip user id is configured server-side via env var; placeholder for now.
  const cpagripUserId = "PLACEHOLDER";
  const offerWallUrl = `https://www.cpagrip.com/offer_wall.php?user_id=${cpagripUserId}&pubid=PLACEHOLDER`;

  return (
    <div className="container mx-auto px-4 py-10 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold neon-text">Offer Wall</h1>
          <p className="text-muted-foreground text-sm mt-1">Complete offers to earn big point rewards.</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-full glass">
          <Coins className="h-5 w-5 text-primary" />
          <span className="font-bold">{profile?.points ?? 0}</span>
          <span className="text-sm text-muted-foreground">points</span>
        </div>
      </div>
      <div className="glass rounded-2xl p-2 sm:p-4">
        <iframe
          title="CPAGrip Offer Wall"
          src={offerWallUrl}
          className="w-full rounded-xl bg-background"
          style={{ minHeight: "70vh", border: 0 }}
        />
        <p className="text-xs text-muted-foreground p-3">
          Offer wall provider: CPAGrip. Replace PLACEHOLDER values via env vars on your production host.
        </p>
      </div>
    </div>
  );
}