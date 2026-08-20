/**
 * True once real Supabase credentials are present. Every dual-mode module
 * (AuthContext, product/cart/order repositories) branches on this instead of
 * assuming a backend — see .env.example for the variables it checks.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
