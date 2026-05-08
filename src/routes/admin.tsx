import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useServerFn } from "@tanstack/react-start";
import { adminAdjustPoints } from "@/lib/points.functions";
import { toast } from "sonner";
import { Users, Coins, TrendingUp, Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({ meta: [{ title: "Admin — CryptoRewards" }] }),
});

type Row = {
  id: string; email: string; points: number;
  created_at: string; last_login_at: string | null;
};

function AdminPage() {
  const { user, isAdmin, loading } = useAuth();
  const nav = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [adViewsToday, setAdViewsToday] = useState(0);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user || !isAdmin) nav({ to: "/" });
  }, [user, isAdmin, loading, nav]);

  const load = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id,email,points,created_at,last_login_at")
      .order("created_at", { ascending: false })
      .limit(500);
    setRows((data as Row[]) ?? []);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabase.from("ad_views").select("id", { count: "exact", head: true }).gte("created_at", since);
    setAdViewsToday(count ?? 0);
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  const totals = useMemo(() => ({
    users: rows.length,
    points: rows.reduce((s, r) => s + (r.points ?? 0), 0),
    revenue: (adViewsToday * 0.005).toFixed(2), // ~$0.005/view estimate
  }), [rows, adViewsToday]);

  const filtered = rows.filter((r) => r.email.toLowerCase().includes(search.toLowerCase()));

  if (!isAdmin) return null;

  return (
    <div className="container mx-auto px-4 py-10 max-w-6xl">
      <h1 className="text-3xl font-bold neon-text mb-6">Admin Panel</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Stat icon={<Users className="h-5 w-5" />} label="Total users" value={totals.users.toString()} />
        <Stat icon={<Coins className="h-5 w-5" />} label="Total points given" value={totals.points.toLocaleString()} />
        <Stat icon={<TrendingUp className="h-5 w-5" />} label="Today ad revenue est." value={`$${totals.revenue}`} />
      </div>

      <div className="glass rounded-2xl p-4 sm:p-6">
        <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
          <h2 className="text-xl font-semibold">Users</h2>
          <Input
            placeholder="Search by email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground border-b">
              <tr>
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">Joined</th>
                <th className="py-2 pr-4">Last login</th>
                <th className="py-2 pr-4">Points</th>
                <th className="py-2 pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-border/50">
                  <td className="py-2 pr-4">{r.email}</td>
                  <td className="py-2 pr-4">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="py-2 pr-4">{r.last_login_at ? new Date(r.last_login_at).toLocaleDateString() : "—"}</td>
                  <td className="py-2 pr-4 font-semibold">{r.points}</td>
                  <td className="py-2 pr-4 flex gap-2">
                    <EditPointsDialog row={r} onDone={load} />
                    <HistoryDialog userId={r.id} email={r.email} />
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No users</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center gap-2 text-muted-foreground text-sm">{icon}{label}</div>
      <div className="text-2xl font-bold mt-2">{value}</div>
    </div>
  );
}

function EditPointsDialog({ row, onDone }: { row: Row; onDone: () => void }) {
  const fn = useServerFn(adminAdjustPoints);
  const [delta, setDelta] = useState("0");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  const submit = async () => {
    const n = parseInt(delta, 10);
    if (!Number.isFinite(n) || !reason.trim()) return toast.error("Enter delta and reason");
    setBusy(true);
    try {
      await fn({ data: { targetUserId: row.id, delta: n, reason: reason.trim() } });
      toast.success("Points updated");
      setOpen(false); setDelta("0"); setReason(""); onDone();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline">Edit</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit points — {row.email}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Delta (use negative to deduct)</Label><Input type="number" value={delta} onChange={(e) => setDelta(e.target.value)} /></div>
          <div><Label>Reason</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} /></div>
          <Button onClick={submit} disabled={busy} className="w-full">
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Apply
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function HistoryDialog({ userId, email }: { userId: string; email: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    if (!open) return;
    supabase.from("points_transactions").select("*").eq("user_id", userId)
      .order("created_at", { ascending: false }).limit(100).then(({ data }) => setItems(data ?? []));
  }, [open, userId]);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="ghost">History</Button></DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Transactions — {email}</DialogTitle></DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto space-y-2 text-sm">
          {items.map((t) => (
            <div key={t.id} className="flex justify-between border-b border-border/50 py-2">
              <div>
                <div className="font-medium">{t.type}</div>
                <div className="text-xs text-muted-foreground">{t.reason}</div>
                <div className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()}</div>
              </div>
              <div className={`font-semibold ${t.amount >= 0 ? "text-primary" : "text-destructive"}`}>
                {t.amount > 0 ? "+" : ""}{t.amount}
              </div>
            </div>
          ))}
          {items.length === 0 && <div className="text-muted-foreground text-center py-8">No transactions</div>}
        </div>
      </DialogContent>
    </Dialog>
  );
}