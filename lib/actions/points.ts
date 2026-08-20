"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/** 0 for guests and when Supabase isn't configured — never a guessed/fake balance. */
export async function getMyPointBalanceAction(): Promise<number> {
  if (!isSupabaseConfigured()) return 0;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const { data, error } = await supabase.rpc("get_point_balance", { p_user_id: user.id } as never);
  if (error) {
    console.error("[points] getMyPointBalanceAction failed:", error.message);
    return 0;
  }
  return (data as unknown as number) ?? 0;
}
