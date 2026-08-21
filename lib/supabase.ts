import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase phía server.
 *
 * Dùng service-role key nên chỉ được gọi trong route handler — key này bỏ qua
 * mọi Row Level Security. Không bao giờ import file này từ component client.
 *
 * App một người dùng nên các bảng đóng RLS hoàn toàn; mọi truy cập đi qua đây.
 */
let client: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function supabase(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("Chưa cấu hình SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY.");
    }
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
