import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// ── Access control ─────────────────────────────────────────────────────────
const ALLOWED_DOMAIN = "@outx.ai";
const ALLOWED_EMAILS = new Set(["ashessssm123@gmail.com"]);

function isAllowed(email: string | undefined): boolean {
  if (!email) return false;
  return email.endsWith(ALLOWED_DOMAIN) || ALLOWED_EMAILS.has(email);
}

// ── Public paths (no auth required) ───────────────────────────────────────
const PUBLIC_PATHS = ["/", "/login", "/auth/callback", "/unauthorized"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow public paths and static assets
  if (
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/")) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll()      { return request.cookies.getAll(); },
        setAll(toSet) {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Not logged in → go to login
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Logged in but email not allowed → go to unauthorized
  if (!isAllowed(user.email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/unauthorized", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
