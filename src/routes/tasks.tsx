import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Coins, Loader2, ExternalLink, CheckCircle2, Youtube } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { claimTaskReward } from "@/lib/points.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/tasks")({
  component: TasksPage,
  head: () => ({ meta: [{ title: "Tasks — CryptoRewards" }] }),
});

type Task = {
  id: string;
  title: string;
  adUrl: string;
  videoUrl: string;
};

const TASKS: Task[] = [
  {
    id: "task1",
    title: "Task 1",
    adUrl: "https://omg10.com/4/10958497",
    videoUrl: "https://youtu.be/7mJcDu1H0h4?si=slZNMRzYVfvGp0iu",
  },
  {
    id: "task2",
    title: "Task 2",
    adUrl: "https://omg10.com/4/10958858",
    videoUrl: "https://youtu.be/_2oFJlCrMZU?si=sYMTEyCbqAhgszpP",
  },
  {
    id: "task3",
    title: "Task 3",
    adUrl: "https://omg10.com/4/10970856",
    videoUrl: "https://youtu.be/diR0AnDaBlM?si=A8eq40NHi52g1Am5",
  },
  {
    id: "task4",
    title: "Task 4",
    adUrl: "https://www.profitablecpmratenetwork.com/jjinsj1h2v?key=15e360c0e974dce88867b96383c9c1f5",
    videoUrl: "https://youtu.be/dQw4w9WgXcQ",
  },
];

function TasksPage() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const nav = useNavigate();
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [loading, user, nav]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("ad_views")
        .select("ad_type")
        .eq("user_id", user.id)
        .like("ad_type", "task_%");
      if (data) setCompleted(new Set(data.map((r) => r.ad_type.replace("task_", ""))));
    })();
  }, [user]);

  if (!user) return null;

  return (
    <div className="container mx-auto px-4 py-10 max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold neon-text">Video Tasks</h1>
          <p className="text-muted-foreground text-sm mt-1">Watch a 15-second ad, then watch the video to earn 20 points.</p>
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
              done={completed.has(t.id)}
              onClaimed={async () => {
                setCompleted((s) => new Set(s).add(t.id));
                await refreshProfile();
              }}
            />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

type Phase = "idle" | "ad" | "video" | "claiming" | "done";

function TaskCard({ task, done, onClaimed }: { task: Task; done: boolean; onClaimed: () => Promise<void> }) {
  const claim = useServerFn(claimTaskReward);
  const [phase, setPhase] = useState<Phase>(done ? "done" : "idle");
  const [seconds, setSeconds] = useState(15);

  useEffect(() => { if (done) setPhase("done"); }, [done]);

  useEffect(() => {
    if (phase !== "ad") return;
    setSeconds(15);
    const i = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) { clearInterval(i); setPhase("video"); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(i);
  }, [phase]);

  const start = () => {
    window.open(task.adUrl, "_blank", "noopener,noreferrer");
    setPhase("ad");
  };

  const watchVideoAndClaim = async () => {
    window.open(task.videoUrl, "_blank", "noopener,noreferrer");
    setPhase("claiming");
    try {
      const res = await claim({ data: { taskId: task.id } });
      if (!res.ok) toast.error("Already claimed");
      else { toast.success(`${task.title} complete +20 points`); await onClaimed(); }
      setPhase("done");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to claim");
      setPhase("video");
    }
  };

  return (
    <div className="glass rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <Youtube className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-lg">{task.title}</h3>
          {phase === "done" && <CheckCircle2 className="h-5 w-5 text-emerald-400" />}
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {phase === "idle" && "Open the ad, wait 15 seconds, then watch the video."}
          {phase === "ad" && `Watching ad… ${seconds}s remaining`}
          {phase === "video" && "Now watch the YouTube video to claim your reward."}
          {phase === "claiming" && "Crediting your points…"}
          {phase === "done" && "Reward claimed (+20 points)."}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {phase === "idle" && (
          <Button onClick={start}>
            <ExternalLink className="h-4 w-4 mr-1" /> Start
          </Button>
        )}
        {phase === "ad" && (
          <Button disabled>
            <Loader2 className="h-4 w-4 mr-1 animate-spin" /> {seconds}s
          </Button>
        )}
        {phase === "video" && (
          <Button onClick={watchVideoAndClaim} variant="secondary">
            <Youtube className="h-4 w-4 mr-1" /> Watch & claim +20
          </Button>
        )}
        {phase === "claiming" && (
          <Button disabled><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Claiming…</Button>
        )}
        {phase === "done" && (
          <Button disabled variant="outline">
            <CheckCircle2 className="h-4 w-4 mr-1" /> Done
          </Button>
        )}
      </div>
    </div>
  );
}