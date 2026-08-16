import { createClient } from "@supabase/supabase-js";

// 서버 전용. service role 키를 쓰므로 클라이언트 컴포넌트에서 import 금지.
// (모든 테이블은 RLS deny-all — anon 키 경로는 아예 없다.)
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env: ${name}`);
  return v;
}

export const db = createClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});
