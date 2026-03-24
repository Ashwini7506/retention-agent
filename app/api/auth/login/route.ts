import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  const allowedEmail    = process.env.FUNNELMIND_EMAIL;
  const allowedPassword = process.env.FUNNELMIND_PASSWORD;

  if (
    !allowedEmail || !allowedPassword ||
    email?.trim().toLowerCase() !== allowedEmail.toLowerCase() ||
    password !== allowedPassword
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Session token = base64(email:password) — never exposed to client JS (httpOnly)
  const sessionToken = Buffer.from(`${allowedEmail}:${allowedPassword}`).toString("base64");

  const res = NextResponse.json({ ok: true });
  res.cookies.set("fm_session", sessionToken, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });
  return res;
}
