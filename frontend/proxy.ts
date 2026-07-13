import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/types";

const AUTH_ROUTE_PREFIXES = ["/login", "/register"] as const;

const PROTECTED_ROUTE_PREFIXES = [
  "/dashboard",
  "/plan",
  "/practice",
  "/session",
  "/settings",
  "/setup",
] as const;

function isPathOrChild(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function redirectWithCookies(
  request: NextRequest,
  pathname: string,
  sourceResponse: NextResponse,
): NextResponse {
  const redirectResponse = NextResponse.redirect(
    new URL(pathname, request.url),
  );

  for (const cookie of sourceResponse.cookies.getAll()) {
    redirectResponse.cookies.set(cookie);
  }

  return redirectResponse;
}

export async function proxy(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Falta la configuracion publica de Supabase.");
  }

  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }

        supabaseResponse = NextResponse.next({
          request,
        });

        for (const { name, value, options } of cookiesToSet) {
          supabaseResponse.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isAuthRoute = AUTH_ROUTE_PREFIXES.some((prefix) =>
    isPathOrChild(pathname, prefix),
  );
  const isProtectedRoute = PROTECTED_ROUTE_PREFIXES.some((prefix) =>
    isPathOrChild(pathname, prefix),
  );

  if (!user && isProtectedRoute) {
    return redirectWithCookies(request, "/login", supabaseResponse);
  }

  if (user && isAuthRoute) {
    return redirectWithCookies(request, "/dashboard", supabaseResponse);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|auth/callback).*)",
  ],
};
