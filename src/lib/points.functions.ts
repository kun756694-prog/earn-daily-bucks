import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Map raw DB errors to a generic, safe message before they reach the client.
function safeError(err: unknown, fallback = "Something went wrong. Please try again."): never {
  console.error("[server-fn]", err);
  throw new Error(fallback);
}

export const dailyCheckin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase.rpc("claim_daily_checkin", {
      _user_id: userId, _amount: 10,
    });
    if (error) safeError(error);
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.claimed) {
      return { ok: false as const, reason: "cooldown", nextAt: new Date(row?.next_at).getTime() };
    }
    await supabase.from("points_transactions").insert({
      user_id: userId, amount: 10, type: "checkin", reason: "Daily check-in",
    });
    return { ok: true as const, points: row.points };
  });

export const claimAdReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ adType: z.string().min(1).max(64) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rpc, error } = await supabase.rpc("claim_ad_reward_atomic", {
      _user_id: userId, _ad_type: data.adType,
    });
    if (error) safeError(error);
    const row = Array.isArray(rpc) ? rpc[0] : rpc;
    if (!row?.ok) return { ok: false as const, reason: row?.reason ?? "error" };
    return { ok: true as const, points: row.points };
  });

export const startTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ taskId: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.rpc("start_task", { _user_id: userId, _task_id: data.taskId });
    if (error) safeError(error);
    return { ok: true as const };
  });

export const claimTaskReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ taskId: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rpc, error } = await supabase.rpc("claim_task_reward_atomic", {
      _user_id: userId,
      _task_id: data.taskId,
    } as never);
    if (error) safeError(error);
    const row = Array.isArray(rpc) ? rpc[0] : rpc;
    if (!row?.ok) return { ok: false as const, reason: row?.reason ?? "error" };
    return { ok: true as const, points: row.points };
  });

export const claimBonusReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: rpc, error } = await supabase.rpc("claim_bonus_reward_atomic", {
      _user_id: userId,
    });
    if (error) safeError(error);
    const row = Array.isArray(rpc) ? rpc[0] : rpc;
    if (!row?.ok) return { ok: false as const, reason: row?.reason ?? "error" };
    return { ok: true as const, points: row.points };
  });

export const POINTS_PER_UNIT = 10000;
export const MIN_UNITS = 1;

const WithdrawMethod = z.enum(["wave", "kbzpay", "tng", "duitnow", "ton"]);

export const requestWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    method: WithdrawMethod,
    payoutDetails: z.string().trim().min(5).max(80),
    amountUnits: z.number().min(MIN_UNITS).max(100000),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rpc, error } = await supabase.rpc("request_withdrawal_v2", {
      _user_id: userId,
      _method: data.method,
      _payout_details: data.payoutDetails,
      _amount_units: data.amountUnits,
    });
    if (error) safeError(error);
    const row = Array.isArray(rpc) ? rpc[0] : rpc;
    if (!row?.ok) return { ok: false as const, reason: row?.reason ?? "error" };
    return { ok: true as const, points: row.new_points };
  });

export const adminAdjustPoints = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    targetUserId: z.string().uuid(),
    delta: z.number().int().min(-1_000_000).max(1_000_000),
    reason: z.string().min(1).max(500),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: newPoints, error } = await supabase.rpc("admin_adjust_points", {
      _target: data.targetUserId, _delta: data.delta, _reason: data.reason,
    });
    if (error) safeError(error);
    return { ok: true as const, points: newPoints };
  });

// Admin-only: fetch the data shown in the admin panel. Re-checks role server-side.
export const adminLoad = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    if (!roles?.some((r) => r.role === "admin")) throw new Error("Forbidden");
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id,email,points,created_at,last_login_at")
      .order("created_at", { ascending: false })
      .limit(500);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("ad_views")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since);
    return { profiles: profiles ?? [], adViewsToday: count ?? 0 };
  });

export const adminUserHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ targetUserId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    if (!roles?.some((r) => r.role === "admin")) throw new Error("Forbidden");
    const { data: items } = await supabase
      .from("points_transactions")
      .select("*")
      .eq("user_id", data.targetUserId)
      .order("created_at", { ascending: false })
      .limit(100);
    return { items: items ?? [] };
  });

export const adminListWithdrawals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    if (!roles?.some((r) => r.role === "admin")) throw new Error("Forbidden");
    const { data: ws } = await supabase
      .from("withdrawals")
      .select("id,user_id,method,payout_details,points_spent,ton_amount,status,admin_note,created_at,processed_at")
      .order("created_at", { ascending: false })
      .limit(500);
    const ids = Array.from(new Set((ws ?? []).map((w) => w.user_id)));
    let emailById: Record<string, string> = {};
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id,email").in("id", ids);
      emailById = Object.fromEntries((profs ?? []).map((p) => [p.id, p.email ?? "—"]));
    }
    return { items: (ws ?? []).map((w) => ({ ...w, email: emailById[w.user_id] ?? "—" })) };
  });

export const adminProcessWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    withdrawalId: z.string().uuid(),
    action: z.enum(["approve", "reject"]),
    note: z.string().max(500).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rpc, error } = await supabase.rpc("admin_process_withdrawal", {
      _withdrawal_id: data.withdrawalId,
      _action: data.action,
      _note: data.note,
    });
    if (error) safeError(error);
    const row = Array.isArray(rpc) ? rpc[0] : rpc;
    if (!row?.ok) return { ok: false as const, reason: row?.reason ?? "error" };
    return { ok: true as const };
  });

export const submitAirdropClaim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      discordUsername: z.string().trim().min(2).max(64).regex(/^[A-Za-z0-9._#-]+$/),
      walletAddress: z.string().trim().min(26).max(64).regex(/^0x[a-fA-F0-9]{40}$/, { message: "Invalid Arbitrum wallet address" }),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("withdraw_requests").insert({
      user_id: userId,
      discord_username: data.discordUsername,
      wallet_address: data.walletAddress,
    });
    if (error) safeError(error);

    const webhook = process.env.DISCORD_WEBHOOK_URL;
    if (webhook) {
      try {
        await fetch(webhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content:
              `🚀 **New Airdrop Claim Request**\n` +
              `👤 Discord User: ${data.discordUsername}\n` +
              `💰 Wallet Address: \`${data.walletAddress}\`\n` +
              `Please verify this user in the database.`,
          }),
        });
      } catch (e) {
        console.error("[discord-webhook]", e);
      }
    }
    return { ok: true as const };
  });