import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Coins, Loader2, Wallet, Download, ExternalLink } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { requestWithdrawal } from "@/lib/points.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/withdraw")({
  component: WithdrawPage,
  head: () => ({ meta: [{ title: "Withdraw TON — CryptoRewards" }] }),
});

const POINTS_PER_TON = 20000;
const MIN_TON = 15;

type Row = {
  id: string;
  ton_address: string;
  ton_amount: number;
  points_spent: number;
  status: string;
  created_at: string;
};

function WithdrawPage() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const nav = useNavigate();
  const fn = useServerFn(requestWithdrawal);

  const [amount, setAmount] = useState<number>(MIN_TON);
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<Row[]>([]);

  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [loading, user, nav]);

  const loadHistory = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("withdrawals").select("*")
      .eq("user_id", user.id).order("created_at", { ascending: false }).limit(20);
    if (data) setHistory(data as Row[]);
  };
  useEffect(() => { loadHistory(); }, [user]);

  if (!user) return null;

  const points = profile?.points ?? 0;
  const maxTon = Math.floor(points / POINTS_PER_TON);
  const cost = amount * POINTS_PER_TON;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount < MIN_TON) { toast.error(`Minimum ${MIN_TON} TON`); return; }
    if (!address.trim()) { toast.error("Enter your TON wallet address"); return; }
    if (cost > points) { toast.error("Not enough points"); return; }
    setBusy(true);
    try {
      const res = await fn({ data: { tonAmount: amount, tonAddress: address.trim() } });
      if (!res.ok) {
        toast.error(res.reason === "pending_exists" ? "You already have a pending withdrawal" : "Not enough points");
      } else {
        toast.success("Withdrawal request submitted");
        setAddress("");
        await refreshProfile();
        await loadHistory();
      }
    } catch (err: any) {
      toast.error(err instanceof Response ? `Failed (${err.status})` : err?.message ?? "Failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="container mx-auto px-4 py-10 max-w-2xl">
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold neon-text">Withdraw TON</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {POINTS_PER_TON.toLocaleString()} points = 1 TON · Minimum {MIN_TON} TON
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-full glass">
          <Coins className="h-5 w-5 text-primary" />
          <span className="font-bold">{points.toLocaleString()}</span>
          <span className="text-sm text-muted-foreground">points</span>
        </div>
      </div>

      <div className="glass rounded-2xl p-5 mb-5">
        <div className="flex items-start gap-3">
          <Wallet className="h-6 w-6 text-primary mt-1" />
          <div className="flex-1">
            <h3 className="font-semibold">Need a TON wallet?</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-3">
              Download Tonkeeper to receive your TON.
            </p>
            <div className="flex flex-wrap gap-2">
              <a href="https://tonkeeper.com/download" target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline"><Download className="h-4 w-4 mr-1" /> Tonkeeper</Button>
              </a>
              <a href="https://play.google.com/store/apps/details?id=com.ton_keeper" target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="ghost"><ExternalLink className="h-4 w-4 mr-1" /> Play Store</Button>
              </a>
              <a href="https://apps.apple.com/app/tonkeeper/id1587742107" target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="ghost"><ExternalLink className="h-4 w-4 mr-1" /> App Store</Button>
              </a>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={submit} className="glass rounded-2xl p-5 space-y-4">
        <div>
          <Label htmlFor="amount">Amount (TON)</Label>
          <Input
            id="amount" type="number" min={MIN_TON} max={maxTon || MIN_TON}
            value={amount} onChange={(e) => setAmount(parseInt(e.target.value || "0", 10))}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Costs {cost.toLocaleString()} points · You have {points.toLocaleString()} (max {maxTon} TON)
          </p>
        </div>
        <div>
          <Label htmlFor="addr">TON Wallet Address</Label>
          <Input
            id="addr" placeholder="UQ... or EQ..."
            value={address} onChange={(e) => setAddress(e.target.value)}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Paste your Tonkeeper receive address. Double-check before submitting.
          </p>
        </div>
        <Button type="submit" disabled={busy || amount < MIN_TON || cost > points} className="w-full neon-glow">
          {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Request {amount} TON
        </Button>
      </form>

      <div className="mt-8">
        <h2 className="text-xl font-bold mb-3">Your withdrawals</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">No withdrawals yet.</p>
        ) : (
          <div className="space-y-2">
            {history.map((w) => (
              <div key={w.id} className="glass rounded-xl p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold">{Number(w.ton_amount)} TON</div>
                  <div className="text-xs text-muted-foreground truncate">{w.ton_address}</div>
                  <div className="text-xs text-muted-foreground">{new Date(w.created_at).toLocaleString()}</div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  w.status === "paid" ? "bg-emerald-500/20 text-emerald-300"
                  : w.status === "rejected" ? "bg-red-500/20 text-red-300"
                  : "bg-yellow-500/20 text-yellow-300"
                }`}>{w.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}