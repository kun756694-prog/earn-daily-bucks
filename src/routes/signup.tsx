import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Gift } from "lucide-react";

type Search = { ref?: string };

export const Route = createFileRoute("/signup")({
  component: SignupPage,
  validateSearch: (s: Record<string, unknown>): Search => ({ ref: typeof s.ref === "string" ? s.ref : undefined }),
  head: () => ({ meta: [{ title: "Sign up — CryptoRewards" }] }),
});

function SignupPage() {
  const nav = useNavigate();
  const { ref } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [referral, setReferral] = useState(ref ?? "");
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (ref) setReferral(ref); }, [ref]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { referral_code: referral || null },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Account created! +100 bonus points 🎉");
    nav({ to: "/" });
  };

  return (
    <div className="container mx-auto px-4 py-16 max-w-md">
      <div className="glass rounded-2xl p-8">
        <h1 className="text-3xl font-bold mb-2 neon-text">Join CryptoRewards</h1>
        <p className="text-muted-foreground mb-6 text-sm flex items-center gap-2">
          <Gift className="h-4 w-4 text-primary" /> Get 100 bonus points instantly.
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password (min 6)</Label>
            <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="referral">Referral code (optional)</Label>
            <Input id="referral" value={referral} onChange={(e) => setReferral(e.target.value)} placeholder="Friend's code" />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create account
          </Button>
        </form>
        <p className="text-sm text-muted-foreground mt-6 text-center">
          Already a member? <Link to="/login" className="text-primary hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  );
}