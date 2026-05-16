import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Coins, Loader2, Smartphone, Wallet, CreditCard, Banknote, Gem } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { requestWithdrawal } from "@/lib/points.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/withdraw")({
  component: WithdrawPage,
  head: () => ({ meta: [{ title: "Withdraw — CryptoRewards" }] }),
});

const POINTS_PER_UNIT = 10000;
const MIN_POINTS = 10000;
const AD_URL = "https://www.profitablecpmratenetwork.com/ziadeax47?key=280244817897c83ce7c6542678cc971d";
const AD_WAIT_SECONDS = 15;

type MethodId = "wave" | "kbzpay" | "tng" | "duitnow" | "ton";

const METHODS: {
  id: MethodId;
  name: string;
  unit: string;
  detailsLabel: string;
  detailsPlaceholder: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}[] = [
  { id: "wave",    name: "Wave Money", unit: "MMK eq.", detailsLabel: "Phone Number",   detailsPlaceholder: "09xxxxxxxxx",  icon: Smartphone, accent: "from-sky-500/30 to-blue-500/10" },
  { id: "kbzpay",  name: "KBZPay",     unit: "MMK eq.", detailsLabel: "Phone Number",   detailsPlaceholder: "09xxxxxxxxx",  icon: Banknote,   accent: "from-amber-500/30 to-orange-500/10" },
  { id: "tng",     name: "Touch 'n Go",unit: "MYR eq.", detailsLabel: "Phone Number",   detailsPlaceholder: "01xxxxxxxx",   icon: CreditCard, accent: "from-rose-500/30 to-pink-500/10" },
  { id: "duitnow", name: "DuitNow",    unit: "MYR eq.", detailsLabel: "Account / ID",   detailsPlaceholder: "Account ID or NRIC", icon: Wallet, accent: "from-emerald-500/30 to-green-500/10" },
  { id: "ton",     name: "TON",        unit: "TON",     detailsLabel: "Wallet Address", detailsPlaceholder: "UQ... or EQ...", icon: Gem,    accent: "from-primary/40 to-purple-500/10" },
];

type Row = {
  id: string;
  method: string | null;
  payout_details: string | null;
  ton_address: string | null;
  ton_amount: number;
  points_spent: number;
  status: string;
  created_at: string;
};

function WithdrawPage() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const nav = useNavigate();
  const fn = useServerFn(requestWithdrawal);

  const [method, setMethod] = useState<MethodId>("wave");
  const [units, setUnits] = useState<number>(1);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<Row[]>([]);
  const [adWatched, setAdWatched] = useState(false);
  const [adCountdown, setAdCountdown] = useState(0);

  useEffect(() => {
    if (adCountdown <= 0) return;
    const t = setTimeout(() => {
      setAdCountdown((c) => {
        if (c <= 1) { setAdWatched(true); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearTimeout(t);
  }, [adCountdown]);

  const watchAd = () => {
    window.open(AD_URL, "_blank", "noopener,noreferrer");
    setAdCountdown(AD_WAIT_SECONDS);
    toast.info(`Watch the ad — unlock in ${AD_WAIT_SECONDS}s`);
  };

  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [loading, user, nav]);

  const loadHistory = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("withdrawals").select("*")
      .eq("user_id", user.id).order("created_at", { ascending: false }).limit(20);
    if (data) setHistory(data as unknown as Row[]);
  };
  useEffect(() => { loadHistory(); }, [user]);

  const active = useMemo(() => METHODS.find((m) => m.id === method)!, [method]);

  if (!user) return null;

  const points = profile?.points ?? 0;
  const maxUnits = Math.floor(points / POINTS_PER_UNIT);
  const cost = units * POINTS_PER_UNIT;
  const belowMin = points < MIN_POINTS;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adWatched) { toast.error("Please watch the ad first to unlock withdrawal"); return; }
    if (belowMin) { toast.error(`You need at least ${MIN_POINTS.toLocaleString()} points`); return; }
    if (units < 1) { toast.error("Minimum withdrawal is 1 unit"); return; }
    if (cost > points) { toast.error("Not enough points"); return; }
    if (!details.trim()) { toast.error(`Enter your ${active.detailsLabel.toLowerCase()}`); return; }
    setBusy(true);
    try {
      const res = await fn({ data: { method, payoutDetails: details.trim(), amountUnits: units } });
      if (!res.ok) {
        const map: Record<string, string> = {
          pending_exists: "You already have a pending withdrawal",
          insufficient_points: "Not enough points",
          invalid_details: `Invalid ${active.detailsLabel.toLowerCase()}`,
          invalid_amount: "Invalid amount",
          invalid_method: "Invalid method",
        };
        toast.error(map[res.reason] ?? "Could not submit request");
      } else {
        toast.success("Withdrawal request submitted — Pending review");
        setDetails("");
        setAdWatched(false);
        await refreshProfile();
        await loadHistory();
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="container mx-auto px-4 py-10 max-w-2xl">
      <div className="flex items-center justify-between flex-wrap gap-4 mb-2">
        <div>
          <h1 className="text-3xl font-bold neon-text">Cash Out</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {POINTS_PER_UNIT.toLocaleString()} points = 1 {active.unit} · Minimum {MIN_POINTS.toLocaleString()} points
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-full glass">
          <Coins className="h-5 w-5 text-primary" />
          <span className="font-bold">{points.toLocaleString()}</span>
          <span className="text-sm text-muted-foreground">points</span>
        </div>
      </div>

      {belowMin && (
        <div className="glass rounded-xl p-3 mt-4 text-sm text-muted-foreground">
          Earn at least {MIN_POINTS.toLocaleString()} points to unlock withdrawals.
        </div>
      )}

      <div className="mt-6">
        <Label className="mb-2 block">Choose a method</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {METHODS.map((m) => {
            const Icon = m.icon;
            const isActive = m.id === method;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setMethod(m.id)}
                className={`relative text-left rounded-2xl p-4 border transition-all overflow-hidden ${
                  isActive ? "border-primary ring-2 ring-primary/40" : "border-border hover:border-primary/40"
                }`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${m.accent} opacity-60`} />
                <div className="relative">
                  <Icon className="h-6 w-6 mb-2 text-foreground" />
                  <div className="font-semibold text-sm">{m.name}</div>
                  <div className="text-[11px] text-muted-foreground">{m.unit}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <form onSubmit={submit} className="glass rounded-2xl p-5 space-y-4 mt-6">
        <div>
          <Label htmlFor="amount">Amount ({active.unit})</Label>
          <Input
            id="amount" type="number" min={1} max={Math.max(maxUnits, 1)}
            value={units} onChange={(e) => setUnits(parseInt(e.target.value || "0", 10))}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Costs {cost.toLocaleString()} points · Max {maxUnits} {active.unit}
          </p>
        </div>
        <div>
          <Label htmlFor="details">{active.detailsLabel}</Label>
          <Input
            id="details" placeholder={active.detailsPlaceholder}
            value={details} onChange={(e) => setDetails(e.target.value)}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Double-check before submitting — payouts can't be reversed.
          </p>
        </div>
        <div className="rounded-xl border border-border p-3 space-y-2">
          <div className="text-sm font-medium">
            {adWatched ? "✅ Ad watched — withdrawal unlocked" : "Watch a short ad to unlock withdrawal"}
          </div>
          {!adWatched && (
            <Button
              type="button" variant="outline" className="w-full"
              onClick={watchAd} disabled={adCountdown > 0}
            >
              {adCountdown > 0 ? `Waiting… ${adCountdown}s` : "Watch ad to unlock"}
            </Button>
          )}
        </div>
        <Button type="submit" disabled={busy || belowMin || cost > points || !adWatched} className="w-full neon-glow">
          {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Request Withdrawal
        </Button>
      </form>

      <div className="mt-8">
        <h2 className="text-xl font-bold mb-3">Your withdrawals</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">No withdrawals yet.</p>
        ) : (
          <div className="space-y-2">
            {history.map((w) => {
              const m = METHODS.find((x) => x.id === w.method) ?? METHODS[METHODS.length - 1];
              return (
                <div key={w.id} className="glass rounded-xl p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold">{Number(w.ton_amount)} {m.unit} <span className="text-xs text-muted-foreground">· {m.name}</span></div>
                    <div className="text-xs text-muted-foreground truncate">{w.payout_details ?? w.ton_address}</div>
                    <div className="text-xs text-muted-foreground">{new Date(w.created_at).toLocaleString()}</div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    w.status === "paid" ? "bg-emerald-500/20 text-emerald-300"
                    : w.status === "rejected" ? "bg-red-500/20 text-red-300"
                    : "bg-yellow-500/20 text-yellow-300"
                  }`}>{w.status}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
