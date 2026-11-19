import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { locales, localePath, defaultLocale } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import "../globals.css";

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getDictionary(locale);
  return {
    metadataBase: new URL("https://tech.idda.az"),
    title: t.meta.title,
    description: t.meta.description,
    alternates: {
      canonical: localePath(locale),
      languages: {
        ...Object.fromEntries(locales.map((l) => [l, localePath(l)])),
        "x-default": localePath(defaultLocale),
      },
    },
    openGraph: { title: t.meta.title, description: t.meta.description, locale, type: "website" },
  };
}

export const viewport: Viewport = {
  themeColor: "#2457B0",
};

export default async function RootLayout({ children }: LayoutProps<"/[lang]">) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={GeistSans.variable}>
      <body>{children}</body>
    </html>
  );
}
