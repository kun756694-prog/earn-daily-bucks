import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Rocket, Wallet, CheckCircle2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { submitAirdropClaim } from "@/lib/points.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/withdraw")({
  component: WithdrawPage,
  head: () => ({ meta: [{ title: "Claim Airdrop — CryptoRewards" }] }),
});

function WithdrawPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const submit = useServerFn(submitAirdropClaim);

  const [discord, setDiscord] = useState("");
  const [wallet, setWallet] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (loading) {
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[60vh] grid place-items-center p-6">
        <div className="max-w-md text-center space-y-4 rounded-2xl border border-border/60 bg-card/60 backdrop-blur p-8">
          <Wallet className="mx-auto h-10 w-10 text-primary" />
          <h1 className="text-2xl font-bold">Connect Wallet First</h1>
          <p className="text-muted-foreground">
            You need to be logged in to submit an airdrop claim.
          </p>
          <Button onClick={() => navigate({ to: "/login" })} className="w-full">
            Connect Wallet
          </Button>
        </div>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    const d = discord.trim();
    const w = wallet.trim();

    if (d.length < 2 || d.length > 64 || !/^[A-Za-z0-9._#-]+$/.test(d)) {
      toast.error("Enter a valid Discord username");
      return;
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(w)) {
      toast.error("Enter a valid Arbitrum wallet address (0x…)");
      return;
    }

    setBusy(true);
    try {
      const res = await submit({ data: { discordUsername: d, walletAddress: w } });
      if (res?.ok) {
        setDone(true);
        toast.success("Claim request received!");
        setDiscord("");
        setWallet("");
      } else {
        toast.error("Could not submit. Please try again.");
      }
    } catch {
      toast.error("Could not submit. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-xl space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-purple-500 shadow-lg shadow-primary/30">
            <Rocket className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Claim Airdrop</h1>
          <p className="text-muted-foreground">
            Submit your Discord username and Arbitrum wallet to receive your airdrop.
          </p>
        </div>

        {done ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-8 text-center space-y-4">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
            <h2 className="text-xl font-semibold">Request received!</h2>
            <p className="text-muted-foreground">
              Your airdrop claim has been submitted. We'll verify and process it shortly.
            </p>
            <div className="flex gap-2 justify-center pt-2">
              <Button variant="outline" onClick={() => setDone(false)}>
                Submit another
              </Button>
              <Button asChild>
                <Link to="/">Back to home</Link>
              </Button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={onSubmit}
            className="space-y-5 rounded-2xl border border-border/60 bg-card/60 backdrop-blur p-6"
          >
            <div className="space-y-2">
              <Label htmlFor="discord">Discord Username</Label>
              <Input
                id="discord"
                placeholder="yourname or yourname#1234"
                value={discord}
                onChange={(e) => setDiscord(e.target.value)}
                maxLength={64}
                autoComplete="off"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="wallet">Arbitrum Wallet Address</Label>
              <Input
                id="wallet"
                placeholder="0x..."
                value={wallet}
                onChange={(e) => setWallet(e.target.value)}
                maxLength={64}
                autoComplete="off"
                spellCheck={false}
                required
              />
              <p className="text-xs text-muted-foreground">
                Must be a valid Arbitrum (EVM) address starting with 0x.
              </p>
            </div>

            <Button type="submit" disabled={busy} className="w-full" size="lg">
              {busy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting…
                </>
              ) : (
                "Submit Claim"
              )}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
