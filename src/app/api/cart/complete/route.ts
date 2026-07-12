import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { deliveryTypeSchema } from "@/lib/validation";

export async function POST(request: Request) {
  if (!(await requireSession())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const parsed = deliveryTypeSchema.safeParse((await request.json()).deliveryType);
  if (!parsed.success) {
    return NextResponse.json({ error: "배송 유형이 올바르지 않습니다." }, { status: 400 });
  }

  const { data, error } = await getSupabaseAdmin().rpc("complete_cart_purchase", {
    target_delivery_type: parsed.data,
  });
  if (error) {
    return NextResponse.json({ error: "구매 완료 처리에 실패했습니다." }, { status: 500 });
  }

  const purchase = data?.[0];
  if (!purchase) {
    return NextResponse.json({ error: "장바구니가 비어 있습니다." }, { status: 400 });
  }

  return NextResponse.json({ purchase });
}
