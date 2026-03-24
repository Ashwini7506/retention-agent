import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/_next")
  ) {
    return NextResponse.next();
  }

  const email    = process.env.FUNNELMIND_EMAIL;
  const password = process.env.FUNNELMIND_PASSWORD;

  if (!email || !password) {
    // Env vars not set — block access
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const expectedToken = Buffer.from(`${email}:${password}`).toString("base64");
  const cookie        = request.cookies.get("fm_session")?.value;

  if (cookie !== expectedToken) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
