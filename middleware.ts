import { NextResponse, type NextRequest } from "next/server";

const PUBLIC = ["/", "/login", "/api/auth/login"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC.some((p) => pathname.startsWith(p)) || pathname.startsWith("/_next")) {
    return NextResponse.next();
  }

  const cookie  = request.cookies.get("fm_access")?.value;
  const correct = process.env.ACCESS_PASSWORD;

  if (!correct || cookie !== correct) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
