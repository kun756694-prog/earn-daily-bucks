import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Calendar, Play, Target, Users, Copy, Loader2, Sparkles, Youtube } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useServerFn } from "@tanstack/react-start";
import { dailyCheckin, claimAdReward } from "@/lib/points.functions";
import { toast } from "sonner";
import { BonusButton } from "@/components/BonusButton";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const { user, profile, refreshProfile, loading } = useAuth();

  return (
    <div className="container mx-auto px-4 py-10 sm:py-16">
      <Hero />
      {!user && !loading && <SignedOutCTA />}
      {user && (
        <section className="mt-12">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
            <h2 className="text-2xl sm:text-3xl font-bold">Ways to earn</h2>
            <BonusButton onDone={refreshProfile as any} />
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
            <CheckinCard profile={profile} onDone={refreshProfile} />
            <WatchAdCard onDone={refreshProfile} />
            <TasksCard />
            <OffersCard />
            <ReferralCard code={profile?.referral_code} />
          </div>
        </section>
      )}
      {/* Monetag in-page push placeholder — enable on prod host once compliant */}
      {/* <div id="monetag-inpage-push" /> */}
    </div>
  );
}

function Hero() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="text-center max-w-3xl mx-auto"
    >
      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass mb-6">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-xs font-medium">Earn rewards every day</span>
      </div>
      <h1 className="text-4xl sm:text-6xl font-bold tracking-tight">
        <span className="neon-text">CryptoRewards</span>
        <br />
        <span className="text-foreground">Earn Daily Points</span>
      </h1>
      <p className="mt-5 text-muted-foreground text-base sm:text-lg max-w-xl mx-auto">
        Check in, watch ads, complete offers, and invite friends to stack up points.
      </p>
    </motion.div>
  );
}

function SignedOutCTA() {
  return (
    <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
      <Link to="/signup"><Button size="lg" className="neon-glow">Get 100 bonus points</Button></Link>
      <Link to="/login"><Button size="lg" variant="outline">Log in</Button></Link>
    </div>
  );
}

function Card({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 300 }}
      className={`glass rounded-2xl p-6 flex flex-col h-full ${accent ? "neon-glow" : ""}`}
    >
      {children}
    </motion.div>
  );
}

function CheckinCard({ profile, onDone }: { profile: any; onDone: () => Promise<void> }) {
  const fn = useServerFn(dailyCheckin);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(i); }, []);

  const last = profile?.last_checkin_at ? new Date(profile.last_checkin_at).getTime() : 0;
  const next = last + 24 * 60 * 60 * 1000;
  const onCooldown = last && now < next;
  const hours = Math.max(0, Math.ceil((next - now) / 3_600_000));

  const claim = async () => {
    setBusy(true);
    try {
      const res = await fn();
      if (!res.ok) toast.error("Already claimed today");
      else { toast.success("Check-in success +10 points"); await onDone(); }
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Card>
      <Calendar className="h-8 w-8 text-primary mb-3" />
      <h3 className="font-semibold text-lg">Daily Check-in</h3>
      <p className="text-sm text-muted-foreground mt-1 mb-4">+10 points every 24 hours.</p>
      <Button onClick={claim} disabled={busy || !!onCooldown} className="mt-auto">
        {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        {onCooldown ? `Come back in ~${hours}h` : "Claim +10"}
      </Button>
    </Card>
  );
}

function WatchAdCard({ onDone }: { onDone: () => Promise<void> }) {
  const fn = useServerFn(claimAdReward);
  const [busy, setBusy] = useState(false);

  const watch = async () => {
    setBusy(true);
    try {
      // Monetag Rewarded Interstitial integration goes here on production host:
      // await window.show_XXXXXX();
      await new Promise((r) => setTimeout(r, 1500)); // placeholder ad playback
      const res = await fn({ data: { adType: "rewarded_interstitial" } });
      if (!res.ok) toast.error("Wait a moment before watching another ad");
      else { toast.success("Ad completed +20 points"); await onDone(); }
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Card accent>
      <Play className="h-8 w-8 text-accent mb-3" />
      <h3 className="font-semibold text-lg">Watch Ad</h3>
      <p className="text-sm text-muted-foreground mt-1 mb-4">+20 points per full view.</p>
      <Button onClick={watch} disabled={busy} variant="secondary" className="mt-auto">
        {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        {busy ? "Playing ad…" : "Watch & earn +20"}
      </Button>
    </Card>
  );
}

function OffersCard() {
  return (
    <Card>
      <Target className="h-8 w-8 text-primary mb-3" />
      <h3 className="font-semibold text-lg">Complete Offers</h3>
      <p className="text-sm text-muted-foreground mt-1 mb-4">Earn up to 500 points per offer.</p>
      <Link to="/earn" className="mt-auto">
        <Button variant="outline" className="w-full">Open offer wall</Button>
      </Link>
    </Card>
  );
}

function TasksCard() {
  return (
    <Card>
      <Youtube className="h-8 w-8 text-primary mb-3" />
      <h3 className="font-semibold text-lg">Video Tasks</h3>
      <p className="text-sm text-muted-foreground mt-1 mb-4">Watch ad + video. +20 per task.</p>
      <Link to="/tasks" className="mt-auto">
        <Button variant="outline" className="w-full">Open tasks</Button>
      </Link>
    </Card>
  );
}

function ReferralCard({ code }: { code?: string }) {
  const link = typeof window !== "undefined" && code ? `${window.location.origin}/signup?ref=${code}` : "";
  const copy = async () => {
    await navigator.clipboard.writeText(link);
    toast.success("Referral link copied");
  };
  return (
    <Card>
      <Users className="h-8 w-8 text-primary mb-3" />
      <h3 className="font-semibold text-lg">Invite Friends</h3>
      <p className="text-sm text-muted-foreground mt-1 mb-3">You and your friend both get +100.</p>
      <div className="flex gap-2 mt-auto">
        <Input readOnly value={link} className="text-xs" />
        <Button onClick={copy} size="icon" variant="outline"><Copy className="h-4 w-4" /></Button>
      </div>
    </Card>
  );
}
