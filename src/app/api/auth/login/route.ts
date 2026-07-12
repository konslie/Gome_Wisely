import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { pinSchema } from "@/lib/validation";

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export async function POST(request: Request) {
  const parsed = pinSchema.safeParse((await request.json()).pin);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: settings, error } = await supabase
    .from("auth_settings")
    .select("password_hash, failed_attempt_count, locked_until, session_version")
    .eq("id", 1)
    .single();

  if (error || !settings) {
    return NextResponse.json({ error: "인증 설정을 확인할 수 없습니다." }, { status: 500 });
  }

  if (settings.locked_until && new Date(settings.locked_until) > new Date()) {
    return NextResponse.json({ error: "로그인이 잠겼습니다. 15분 후 다시 시도해주세요." }, { status: 429 });
  }

  if (!(await compare(parsed.data, settings.password_hash))) {
    const attempts = (settings.failed_attempt_count ?? 0) + 1;
    const lockedUntil = attempts >= MAX_ATTEMPTS
      ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString()
      : null;
    await supabase.from("auth_settings").update({
      failed_attempt_count: attempts >= MAX_ATTEMPTS ? 0 : attempts,
      locked_until: lockedUntil,
    }).eq("id", 1);
    return NextResponse.json({ error: "PIN이 올바르지 않습니다." }, { status: 401 });
  }

  if (settings.failed_attempt_count !== 0 || settings.locked_until !== null) {
    await supabase.from("auth_settings").update({ failed_attempt_count: 0, locked_until: null }).eq("id", 1);
  }
  await createSession(settings.session_version);
  return NextResponse.json({ ok: true });
}
