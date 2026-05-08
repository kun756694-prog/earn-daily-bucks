import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const COOLDOWN_MS = 24 * 60 * 60 * 1000;

export const dailyCheckin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("points,last_checkin_at")
      .eq("id", userId)
      .maybeSingle();
    if (error || !profile) throw new Error("Profile not found");

    if (profile.last_checkin_at) {
      const last = new Date(profile.last_checkin_at).getTime();
      if (Date.now() - last < COOLDOWN_MS) {
        const nextAt = last + COOLDOWN_MS;
        return { ok: false as const, reason: "cooldown", nextAt };
      }
    }

    const newPoints = (profile.points ?? 0) + 10;
    const { error: upErr } = await supabase
      .from("profiles")
      .update({ points: newPoints, last_checkin_at: new Date().toISOString() })
      .eq("id", userId);
    if (upErr) throw new Error(upErr.message);

    await supabase.from("points_transactions").insert({
      user_id: userId, amount: 10, type: "checkin", reason: "Daily check-in",
    });

    return { ok: true as const, points: newPoints };
  });

export const claimAdReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ adType: z.string().min(1).max(64) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Rate limit: max 1 ad reward per minute
    const since = new Date(Date.now() - 60_000).toISOString();
    const { count } = await supabase
      .from("ad_views")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", since);
    if ((count ?? 0) > 0) {
      return { ok: false as const, reason: "rate_limited" };
    }

    await supabase.from("ad_views").insert({ user_id: userId, ad_type: data.adType });

    const { data: prof } = await supabase.from("profiles").select("points").eq("id", userId).maybeSingle();
    const newPoints = (prof?.points ?? 0) + 20;
    await supabase.from("profiles").update({ points: newPoints }).eq("id", userId);
    await supabase.from("points_transactions").insert({
      user_id: userId, amount: 20, type: "ad_view", reason: `Watched ${data.adType}`,
    });
    return { ok: true as const, points: newPoints };
  });

export const claimTaskReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ taskId: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const adType = `task_${data.taskId}`;

    // Prevent claiming the same task twice
    const { data: existing } = await supabase
      .from("ad_views")
      .select("id")
      .eq("user_id", userId)
      .eq("ad_type", adType)
      .maybeSingle();
    if (existing) {
      return { ok: false as const, reason: "already_claimed" };
    }

    await supabase.from("ad_views").insert({ user_id: userId, ad_type: adType });

    const { data: prof } = await supabase.from("profiles").select("points").eq("id", userId).maybeSingle();
    const newPoints = (prof?.points ?? 0) + 20;
    await supabase.from("profiles").update({ points: newPoints }).eq("id", userId);
    await supabase.from("points_transactions").insert({
      user_id: userId, amount: 20, type: "task", reason: `Completed ${data.taskId}`,
    });
    return { ok: true as const, points: newPoints };
  });

export const claimBonusReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    // Rate limit: 1 bonus click per 30 seconds
    const since = new Date(Date.now() - 30_000).toISOString();
    const { count } = await supabase
      .from("ad_views")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("ad_type", "bonus_click")
      .gte("created_at", since);
    if ((count ?? 0) > 0) return { ok: false as const, reason: "rate_limited" };

    await supabase.from("ad_views").insert({ user_id: userId, ad_type: "bonus_click" });
    const { data: prof } = await supabase.from("profiles").select("points").eq("id", userId).maybeSingle();
    const newPoints = (prof?.points ?? 0) + 10;
    await supabase.from("profiles").update({ points: newPoints }).eq("id", userId);
    await supabase.from("points_transactions").insert({
      user_id: userId, amount: 10, type: "bonus", reason: "Bonus ad click",
    });
    return { ok: true as const, points: newPoints };
  });

export const adminAdjustPoints = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    targetUserId: z.string().uuid(),
    delta: z.number().int().min(-1_000_000).max(1_000_000),
    reason: z.string().min(1).max(500),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    if (!roles?.some((r) => r.role === "admin")) throw new Error("Forbidden");

    const { data: prof } = await supabase.from("profiles").select("points").eq("id", data.targetUserId).maybeSingle();
    if (!prof) throw new Error("User not found");
    const newPoints = Math.max(0, (prof.points ?? 0) + data.delta);
    await supabase.from("profiles").update({ points: newPoints }).eq("id", data.targetUserId);
    await supabase.from("points_transactions").insert({
      user_id: data.targetUserId, amount: data.delta, type: "admin_adjust", reason: data.reason,
    });
    return { ok: true as const, points: newPoints };
  });