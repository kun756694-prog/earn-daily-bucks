import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Coins, Loader2, ExternalLink, CheckCircle2, Youtube } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { claimTaskReward, startTask } from "@/lib/points.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/tasks")({
  component: TasksPage,
  head: () => ({ meta: [{ title: "Tasks — CryptoRewards" }] }),
});

type Task = {
  id: string;
  title: string;
  url: string;
};

const TASKS: Task[] = [
  { id: "task1", title: "Task 1", url: "https://www.profitablecpmratenetwork.com/ph1f2ij5tc?key=7b593523cfc95a14f0eeb3939de91779" },
  { id: "task2", title: "Task 2", url: "https://www.profitablecpmratenetwork.com/jjinsj1h2v?key=15e360c0e974dce88867b96383c9c1f5" },
  { id: "task3", title: "Task 3", url: "https://www.profitablecpmratenetwork.com/ziadeax47?key=280244817897c83ce7c6542678cc971d" },
  { id: "task4", title: "Task 4", url: "https://omg10.com/4/10958497" },
  { id: "task5", title: "Task 5", url: "https://omg10.com/4/10958858" },
  { id: "task6", title: "Task 6", url: "https://omg10.com/4/10984329" },
  { id: "task7", title: "Task 7", url: "https://omg10.com/4/10970856" },
];

function TasksPage() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const nav = useNavigate();
  const [lastClaim, setLastClaim] = useState<Map<string, number>>(new Map());

  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [loading, user, nav]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("ad_views")
        .select("ad_type, created_at")
        .eq("user_id", user.id)
        .like("ad_type", "task_%");
      if (data) {
        const m = new Map<string, number>();
        for (const r of data) {
          const id = r.ad_type.replace("task_", "");
          const t = new Date(r.created_at).getTime();
          if (!m.has(id) || (m.get(id) ?? 0) < t) m.set(id, t);
        }
        setLastClaim(m);
      }
    })();
  }, [user]);

  if (!user) return null;

  return (
    <div className="container mx-auto px-4 py-10 max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold neon-text">Video Tasks</h1>
          <p className="text-muted-foreground text-sm mt-1">Open each task, wait 30 seconds, then claim 10 points. Each task can be claimed every 30 minutes.</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-full glass">
          <Coins className="h-5 w-5 text-primary" />
          <span className="font-bold">{profile?.points ?? 0}</span>
          <span className="text-sm text-muted-foreground">points</span>
        </div>
      </div>

      <div className="grid gap-4">
        {TASKS.map((t, i) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <TaskCard
              task={t}
              lastClaimAt={lastClaim.get(t.id) ?? 0}
              onClaimed={async () => {
                setLastClaim((m) => new Map(m).set(t.id, Date.now()));
                await refreshProfile();
              }}
            />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

type Phase = "idle" | "watching" | "ready" | "claiming" | "cooldown";

const WAIT_SECONDS = 30;
const COOLDOWN_MS = 30 * 60 * 1000;
const CLAIM_AD_URL = "https://omg10.com/4/10958858";

function TaskCard({ task, lastClaimAt, onClaimed }: { task: Task; lastClaimAt: number; onClaimed: () => Promise<void> }) {
  const claim = useServerFn(claimTaskReward);
  const begin = useServerFn(startTask);
  const inCooldown = () => Date.now() - lastClaimAt < COOLDOWN_MS;
  const [phase, setPhase] = useState<Phase>(inCooldown() ? "cooldown" : "idle");
  const [remaining, setRemaining] = useState(WAIT_SECONDS);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [cooldownLeft, setCooldownLeft] = useState(0);

  useEffect(() => {
    if (inCooldown()) setPhase("cooldown");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastClaimAt]);

  // Cooldown countdown
  useEffect(() => {
    if (phase !== "cooldown") return;
    const tick = () => {
      const left = Math.max(0, COOLDOWN_MS - (Date.now() - lastClaimAt));
      setCooldownLeft(left);
      if (left === 0) setPhase("idle");
    };
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [phase, lastClaimAt]);

  // Background timer + window focus check: when 30s elapsed since open, enable claim.
  useEffect(() => {
    if (phase !== "watching" || startedAt == null) return;
    const tick = () => {
      const left = Math.max(0, WAIT_SECONDS - Math.floor((Date.now() - startedAt) / 1000));
      setRemaining(left);
      if (left === 0) setPhase("ready");
    };
    tick();
    const i = setInterval(tick, 500);
    const onFocus = () => tick();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      clearInterval(i);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [phase, startedAt]);

  const openTask = async () => {
    try {
      await begin({ data: { taskId: task.id } });
    } catch {
      toast.error("Could not start task. Please try again.");
      return;
    }
    window.open(task.url, "_blank", "noopener,noreferrer");
    setStartedAt(Date.now());
    setRemaining(WAIT_SECONDS);
    setPhase("watching");
  };

  const claimReward = async () => {
    setPhase("claiming");
    // Open monetized ad in new tab on claim — revenue trigger
    try { window.open(CLAIM_AD_URL, "_blank", "noopener,noreferrer"); } catch {}
    try {
      const res = await claim({ data: { taskId: task.id } });
      if (!res.ok) {
        if (res.reason === "too_soon") toast.error("Please wait 30 seconds first");
        else if (res.reason === "not_started") toast.error("Start the task first");
        else if (res.reason === "cooldown") toast.error("Already claimed — try again in 30 minutes");
        else toast.error("Could not claim reward");
        setPhase("ready");
        return;
      } else { toast.success(`${task.title} complete +10 points`); await onClaimed(); }
      setPhase("cooldown");
    } catch {
      toast.error("Failed to claim");
      setPhase("ready");
    }
  };

  const fmtCooldown = (ms: number) => {
    const s = Math.ceil(ms / 1000);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}m ${r}s`;
  };

  return (
    <div className="glass rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <Youtube className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-lg">{task.title}</h3>
          {phase === "cooldown" && <CheckCircle2 className="h-5 w-5 text-emerald-400" />}
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {phase === "idle" && "Open the link, wait 30 seconds, then claim 10 points."}
          {phase === "watching" && `Watching… come back in ${remaining}s to claim`}
          {phase === "ready" && "You're back! Claim your reward."}
          {phase === "claiming" && "Crediting your points…"}
          {phase === "cooldown" && `Claimed (+10 points). Available again in ${fmtCooldown(cooldownLeft)}.`}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {phase === "idle" && (
          <Button onClick={openTask}>
            <ExternalLink className="h-4 w-4 mr-1" /> Open Task
          </Button>
        )}
        {phase === "watching" && (
          <Button disabled>
            <Loader2 className="h-4 w-4 mr-1 animate-spin" /> {remaining}s
          </Button>
        )}
        {phase === "ready" && (
          <Button onClick={claimReward} variant="secondary">
            <Youtube className="h-4 w-4 mr-1" /> Claim +10
          </Button>
        )}
        {phase === "claiming" && (
          <Button disabled><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Claiming…</Button>
        )}
        {phase === "cooldown" && (
          <Button disabled variant="outline">
            <CheckCircle2 className="h-4 w-4 mr-1" /> {fmtCooldown(cooldownLeft)}
          </Button>
        )}
      </div>
    </div>
  );
}