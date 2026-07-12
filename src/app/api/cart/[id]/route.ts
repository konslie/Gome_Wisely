import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { updateItemSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  if (!(await requireSession())) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  const parsed = updateItemSchema.safeParse(await request.json());
  if (!parsed.success || Object.keys(parsed.data).length === 0) return NextResponse.json({ error: "변경값이 올바르지 않습니다." }, { status: 400 });
  const { id } = await context.params;
  const update = {
    ...(parsed.data.quantity !== undefined && { quantity: parsed.data.quantity }),
    ...(parsed.data.deliveryType && { delivery_type: parsed.data.deliveryType }),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await getSupabaseAdmin().from("cart_items").update(update).eq("item_id", id).eq("status", "active").select().single();
  if (error) return NextResponse.json({ error: "상품을 변경하지 못했습니다." }, { status: 500 });
  return NextResponse.json({ item: data });
}

export async function DELETE(_: Request, context: Context) {
  if (!(await requireSession())) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  const { id } = await context.params;
  const now = new Date().toISOString();
  const { error } = await getSupabaseAdmin().from("cart_items").update({ status: "deleted", deleted_at: now, updated_at: now }).eq("item_id", id).eq("status", "active");
  if (error) return NextResponse.json({ error: "상품을 삭제하지 못했습니다." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
