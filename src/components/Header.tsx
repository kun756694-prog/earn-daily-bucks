import { Link, useNavigate } from "@tanstack/react-router";
import { Sparkles, LogOut, Coins } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

export function Header() {
  const { user, profile, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  return (
    <header className="sticky top-0 z-50 glass border-b">
      <div className="container mx-auto flex items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <div className="relative">
            <Sparkles className="h-6 w-6 text-primary" />
            <div className="absolute inset-0 blur-md bg-primary/40 -z-10" />
          </div>
          <span className="font-bold text-lg neon-text">CryptoRewards</span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          {user ? (
            <>
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full glass">
                <Coins className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm">{profile?.points ?? 0}</span>
                <span className="text-xs text-muted-foreground">pts</span>
              </div>
              <span className="hidden md:inline text-sm text-muted-foreground truncate max-w-[160px]">
                {user.email}
              </span>
              {isAdmin && (
                <Link to="/admin">
                  <Button variant="outline" size="sm">Admin</Button>
                </Link>
              )}
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Link to="/login"><Button variant="ghost" size="sm">Login</Button></Link>
              <Link to="/signup"><Button size="sm">Sign Up</Button></Link>
            </>
          )}
        </div>
      </div>
      {user && (
        <div className="sm:hidden flex items-center justify-center gap-2 pb-2 px-4">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full glass">
            <Coins className="h-3.5 w-3.5 text-primary" />
            <span className="font-semibold text-xs">{profile?.points ?? 0} pts</span>
          </div>
        </div>
      )}
    </header>
  );
}