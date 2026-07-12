import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

type Context = { params: Promise<{ id: string }> };

export async function POST(_: Request, context: Context) {
  if (!(await requireSession())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const { id } = await context.params;
  const { data, error } = await getSupabaseAdmin()
    .from("cart_items")
    .update({ status: "active", deleted_at: null, updated_at: new Date().toISOString() })
    .eq("item_id", id)
    .eq("status", "deleted")
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: "삭제를 되돌리지 못했습니다." }, { status: 500 });
  }
  return NextResponse.json({ item: data });
}
