import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, locales } from "@/i18n/config";

// English is the default and is served without a prefix:
//   /      → app/[lang=en]   (rewrite, URL stays /)
//   /az    → app/[lang=az]
//   /en/*  → redirect to /*  (one canonical URL per page)
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const first = pathname.split("/")[1];

  if (first === defaultLocale) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.slice(defaultLocale.length + 1) || "/";
    return NextResponse.redirect(url, 308);
  }

  if ((locales as readonly string[]).includes(first)) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = `/${defaultLocale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // Skip Next internals and any file with an extension (dots data, images, favicon…).
  matcher: ["/((?!_next|api|.*\\..*).*)"],
};
