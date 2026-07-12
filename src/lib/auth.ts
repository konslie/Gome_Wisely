import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { getSupabaseAdmin } from "@/lib/supabase";

const COOKIE_NAME = "wisely_session";
const SESSION_DAYS = 30;

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error("SESSION_SECRET은 32자 이상이어야 합니다.");
  }
  return new TextEncoder().encode(value);
}

export async function createSession(sessionVersion: number) {
  const token = await new SignJWT({ sessionVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function requireSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return false;

  try {
    const { payload } = await jwtVerify(token, secret());
    const { data } = await getSupabaseAdmin()
      .from("auth_settings")
      .select("session_version")
      .eq("id", 1)
      .single();
    return data?.session_version === payload.sessionVersion;
  } catch {
    return false;
  }
}
