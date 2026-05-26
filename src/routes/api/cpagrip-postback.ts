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
  const expected = process.env.CPAGRIP_POSTBACK_KEY;
  if (!expected) {
    return new Response("Server misconfiguration", { status: 500 });
  }
  if (!passkey || passkey !== expected) {
    return new Response("Invalid passkey", { status: 401 });
  }

  const userId = url.searchParams.get("user_id");
  const payoutStr = url.searchParams.get("payout");
  const txid = url.searchParams.get("txid") ?? url.searchParams.get("trans_id") ?? "";
  const payout = Number(payoutStr);

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const MAX_PAYOUT = 50; // USD cap per postback
  if (!userId || !UUID_RE.test(userId)) {
    return new Response("Invalid user_id", { status: 400 });
  }
  if (!Number.isFinite(payout) || payout <= 0 || payout > MAX_PAYOUT) {
    return new Response("Bad request", { status: 400 });
  }
  if (!txid || txid.length > 128 || !/^[\w:.\-]+$/.test(txid)) {
    return new Response("Invalid txid", { status: 400 });
  }

  // Idempotency: skip if this txid was already credited
  const { data: existing } = await supabaseAdmin
    .from("points_transactions")
    .select("id")
    .eq("type", "offer")
    .eq("reason", `cpagrip:${txid}`)
    .maybeSingle();
  if (existing) return new Response("OK (duplicate)", { status: 200 });

  const points = Math.round(payout * 100); // $1 = 100 pts

  const { data: newPoints, error: rpcErr } = await supabaseAdmin
    .rpc("increment_points", { _user_id: userId, _delta: points });
  if (rpcErr || newPoints === null) {
    return new Response("User not found", { status: 404 });
  }

  await supabaseAdmin.from("points_transactions").insert({
    user_id: userId,
    amount: points,
    type: "offer",
    reason: `cpagrip:${txid}`,
  });

  return new Response("OK", { status: 200 });
}