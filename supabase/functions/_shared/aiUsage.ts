// Shared AI-gateway helpers used by every edge function that calls the
// Lovable AI gateway. Two responsibilities:
//   1. ai_gate()   — enforce the per-club AI master switch + resolve club_id
//   2. logAiUsage()— record one durable row per gateway call (model + tokens)
//
// Both are best-effort and MUST NOT throw into the caller's happy path:
// logging failures are swallowed so a hiccup in telemetry never breaks a
// user-facing AI feature.
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export interface AiGateResult {
  /** The caller's active club, or null if they aren't in one. */
  clubId: string | null;
  /** False only when a club has explicitly turned AI off. */
  enabled: boolean;
}

/**
 * Check the per-club AI switch and resolve the caller's club in one round-trip.
 * Pass the *user-scoped* client (built with the caller's Authorization header)
 * so auth.uid() resolves inside the SECURITY DEFINER RPC.
 *
 * Fails open (enabled: true) on any error — telemetry/config problems should
 * never silently disable a paying club's features. The explicit "off" only
 * comes from a real settings row.
 */
export async function aiGate(userClient: SupabaseClient): Promise<AiGateResult> {
  try {
    const { data, error } = await userClient.rpc("ai_gate");
    if (error || !data) return { clubId: null, enabled: true };
    return {
      clubId: (data as Record<string, unknown>).club_id as string | null ?? null,
      enabled: (data as Record<string, unknown>).enabled !== false,
    };
  } catch {
    return { clubId: null, enabled: true };
  }
}

export interface AiUsageMeta {
  functionName: string;
  model: string;
  userId?: string | null;
  clubId?: string | null;
  feature?: string | null;
}

interface OpenAiUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

let cachedAdmin: SupabaseClient | null = null;
function adminClient(): SupabaseClient | null {
  if (cachedAdmin) return cachedAdmin;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  cachedAdmin = createClient(url, key);
  return cachedAdmin;
}

/**
 * Record one gateway call. `usage` is the OpenAI-compatible `data.usage`
 * object returned by the Lovable gateway (may be undefined on failures).
 * Never throws.
 */
export async function logAiUsage(
  meta: AiUsageMeta,
  usage: OpenAiUsage | null | undefined,
  opts: { success?: boolean; errorStatus?: number | null } = {},
): Promise<void> {
  try {
    const admin = adminClient();
    if (!admin) return;
    const prompt = usage?.prompt_tokens ?? 0;
    const completion = usage?.completion_tokens ?? 0;
    const total = usage?.total_tokens ?? prompt + completion;
    await admin.from("ai_usage_log").insert({
      function_name: meta.functionName,
      model: meta.model,
      user_id: meta.userId ?? null,
      club_id: meta.clubId ?? null,
      feature: meta.feature ?? null,
      prompt_tokens: prompt,
      completion_tokens: completion,
      total_tokens: total,
      success: opts.success !== false,
      error_status: opts.errorStatus ?? null,
    });
  } catch {
    // Telemetry must never break the request.
  }
}
