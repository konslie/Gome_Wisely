import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { createItemSchema, deliveryTypeSchema, parseItemInput } from "@/lib/validation";

async function resolveProductName(productUrl: string) {
  try {
    const url = new URL(productUrl);
    const allowed = url.hostname === "shop.wisely.store"
      || url.hostname === "wiselycompany.com"
      || url.hostname.endsWith(".wiselycompany.com");
    if (!allowed) return null;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 900);
    const response = await fetch(productUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; WiselyCart/1.0)" },
      cache: "no-store",
    });
    clearTimeout(timeout);
    if (!response.ok) return null;
    const html = (await response.text()).slice(0, 500_000);
    const match = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i)
      || html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return match?.[1]?.replace(/&amp;/g, "&").trim().slice(0, 100) || null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  if (!(await requireSession())) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  const deliveryType = deliveryTypeSchema.safeParse(new URL(request.url).searchParams.get("deliveryType"));
  if (!deliveryType.success) return NextResponse.json({ error: "배송 유형이 올바르지 않습니다." }, { status: 400 });

  const { data, error } = await getSupabaseAdmin().from("cart_items").select("*")
    .eq("delivery_type", deliveryType.data).eq("status", "active").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "목록을 불러오지 못했습니다." }, { status: 500 });
  return NextResponse.json({ items: data });
}

export async function POST(request: Request) {
  if (!(await requireSession())) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  const parsed = createItemSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  let item;
  try { item = parseItemInput(parsed.data.inputValue); }
  catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }); }

  const itemName = item.inputType === "url" ? await resolveProductName(item.productUrl) || item.itemName : item.itemName;
  const { data, error } = await getSupabaseAdmin().from("cart_items").insert({
    input_value: parsed.data.inputValue.trim(), input_type: item.inputType, item_name: itemName,
    quantity: parsed.data.quantity, delivery_type: parsed.data.deliveryType, product_url: item.productUrl,
  }).select().single();
  if (error) return NextResponse.json({ error: "상품을 추가하지 못했습니다." }, { status: 500 });
  return NextResponse.json({ item: data }, { status: 201 });
}
