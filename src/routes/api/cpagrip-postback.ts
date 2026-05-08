import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// CPAGrip server-to-server postback.
// Configure POSTBACK URL in CPAGrip dashboard, e.g.:
//   https://your-domain/api/cpagrip-postback?user_id={user_id}&payout={payout}&txid={trans_id}&passkey=YOUR_KEY
export const Route = createFileRoute("/api/cpagrip-postback")({
  server: {
    handlers: {
      GET: async ({ request }) => handle(request),
      POST: async ({ request }) => handle(request),
    },
  },
});

async function handle(request: Request) {
  const url = new URL(request.url);
  const passkey = url.searchParams.get("passkey");
  const expected = process.env.CPAGRIP_POSTBACK_KEY ?? "PLACEHOLDER";
  if (!passkey || passkey !== expected) {
    return new Response("Invalid passkey", { status: 401 });
  }

  const userId = url.searchParams.get("user_id");
  const payoutStr = url.searchParams.get("payout");
  const txid = url.searchParams.get("txid") ?? url.searchParams.get("trans_id") ?? "";
  const payout = Number(payoutStr);

  if (!userId || !Number.isFinite(payout) || payout <= 0) {
    return new Response("Bad request", { status: 400 });
  }

  // Idempotency: skip if this txid was already credited
  if (txid) {
    const { data: existing } = await supabaseAdmin
      .from("points_transactions")
      .select("id")
      .eq("type", "offer")
      .eq("reason", `cpagrip:${txid}`)
      .maybeSingle();
    if (existing) return new Response("OK (duplicate)", { status: 200 });
  }

  const points = Math.round(payout * 100); // $1 = 100 pts

  const { data: prof, error: pErr } = await supabaseAdmin
    .from("profiles").select("points").eq("id", userId).maybeSingle();
  if (pErr || !prof) return new Response("User not found", { status: 404 });

  await supabaseAdmin
    .from("profiles")
    .update({ points: (prof.points ?? 0) + points })
    .eq("id", userId);

  await supabaseAdmin.from("points_transactions").insert({
    user_id: userId,
    amount: points,
    type: "offer",
    reason: txid ? `cpagrip:${txid}` : "cpagrip offer",
  });

  return new Response("OK", { status: 200 });
}