import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// API routes handle their own auth in-route (session-based for user-facing
// calls, shared-secret for server-to-server ones like the ReinAI
// integration) — a login-page redirect would break both, so they're
// excluded here rather than just being "public".
const PUBLIC_PATHS = ["/login", "/register", "/auth", "/forgot-password", "/reset-password", "/api"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Must call getUser() (not getSession()) here — it revalidates against
  // Supabase Auth's server rather than trusting a potentially-stale cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicPath = PUBLIC_PATHS.some((path) => request.nextUrl.pathname.startsWith(path));

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  if (user && (request.nextUrl.pathname === "/login" || request.nextUrl.pathname === "/register")) {
    const url = request.nextUrl.clone();
    url.pathname = "/chats";
    return NextResponse.redirect(url);
  }

  return response;
}
