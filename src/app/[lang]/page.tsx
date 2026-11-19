import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/sections/hero/Hero";
import { Mission } from "@/components/sections/mission/Mission";
import { Taxes } from "@/components/sections/taxes/Taxes";
import { Beyond } from "@/components/sections/beyond/Beyond";
import { MoreTax } from "@/components/sections/more/MoreTax";
import { getDictionary, getLocale } from "@/i18n/dictionaries";

export default async function Home() {
  const locale = await getLocale();
  const t = await getDictionary(locale);

  return (
    <>
      <Header locale={locale} nav={t.nav} a11y={t.a11y} />
      <main id="main">
        <Hero t={t.hero} />
        <Mission t={t.mission} />
        <Taxes t={t.taxes} />
        <Beyond t={t.beyond} />
        <MoreTax t={t.moreTax} />
        {/* Next: Who can apply → FAQ → Apply. */}
      </main>
      <Footer t={t.footer} />
    </>
  );
}
