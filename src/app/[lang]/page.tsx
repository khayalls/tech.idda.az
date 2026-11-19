import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/sections/hero/Hero";
import { getDictionary, getLocale } from "@/i18n/dictionaries";

export default async function Home() {
  const locale = await getLocale();
  const t = await getDictionary(locale);

  return (
    <>
      <Header locale={locale} nav={t.nav} a11y={t.a11y} />
      <main id="main">
        <Hero t={t.hero} />
        {/* Next sections are built one at a time: Mission → 0% → Beyond tax → Benefits → Who can apply → FAQ → Apply. */}
      </main>
      <Footer t={t.footer} />
    </>
  );
}
