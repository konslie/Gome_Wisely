import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST() {
  if (!(await requireSession())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const { data, error } = await getSupabaseAdmin().rpc("complete_cart_purchase");
  if (error) {
    return NextResponse.json({ error: "구매 완료 처리에 실패했습니다." }, { status: 500 });
  }

  const purchase = data?.[0];
  if (!purchase) {
    return NextResponse.json({ error: "장바구니가 비어 있습니다." }, { status: 400 });
  }

  return NextResponse.json({ purchase });
}
