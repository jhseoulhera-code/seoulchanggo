"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { OrderRow } from "@/types/database";
import type { CurrencyCode } from "@/types/market";

export type MyOrderSummary = {
  id: string;
  orderNumber: string;
  createdAt: string;
  totalAmount: number;
  currencyCode: CurrencyCode;
};

export async function getMyOrdersAction(): Promise<MyOrderSummary[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase.from("orders").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
  if (error) {
    console.error("[mypage] getMyOrdersAction failed:", error.message);
    return [];
  }
  return ((data ?? []) as unknown as OrderRow[]).map((row) => ({
    id: row.id,
    orderNumber: row.order_number,
    createdAt: row.created_at,
    totalAmount: row.total_amount,
    currencyCode: row.currency_code,
  }));
}

export type MyReviewSummary = { id: string; productId: string; productNameKo: string; rating: number; content: string; createdAt: string };

export async function getMyReviewsAction(): Promise<MyReviewSummary[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("reviews")
    .select("id, product_id, rating, content, created_at, products(name_ko)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[mypage] getMyReviewsAction failed:", error.message);
    return [];
  }

  type Row = { id: string; product_id: string; rating: number; content: string; created_at: string; products: { name_ko: string } | null };
  return ((data ?? []) as unknown as Row[]).map((row) => ({
    id: row.id,
    productId: row.product_id,
    productNameKo: row.products?.name_ko ?? "-",
    rating: row.rating,
    content: row.content,
    createdAt: row.created_at,
  }));
}

export type MyInquirySummary = { id: string; productId: string; productNameKo: string; question: string; status: string; createdAt: string };

export async function getMyInquiriesAction(): Promise<MyInquirySummary[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("product_inquiries")
    .select("id, product_id, question, status, created_at, products(name_ko)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[mypage] getMyInquiriesAction failed:", error.message);
    return [];
  }

  type Row = { id: string; product_id: string; question: string; status: string; created_at: string; products: { name_ko: string } | null };
  return ((data ?? []) as unknown as Row[]).map((row) => ({
    id: row.id,
    productId: row.product_id,
    productNameKo: row.products?.name_ko ?? "-",
    question: row.question,
    status: row.status,
    createdAt: row.created_at,
  }));
}
