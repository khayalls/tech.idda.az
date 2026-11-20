import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/sections/hero/Hero";
import { Mission } from "@/components/sections/mission/Mission";
import { Taxes } from "@/components/sections/taxes/Taxes";
import { Beyond } from "@/components/sections/beyond/Beyond";
import { MoreTax } from "@/components/sections/more/MoreTax";
import { Audience } from "@/components/sections/audience/Audience";
import { Faq } from "@/components/sections/faq/Faq";
import { Apply } from "@/components/sections/apply/Apply";
import { getDictionary, getLocale } from "@/i18n/dictionaries";

export default async function Home() {
  const locale = await getLocale();
  const t = await getDictionary(locale);

  return (
    <>
      <Header locale={locale} nav={t.nav} a11y={t.a11y} />
      <main id="main" data-warp>
        <Hero t={t.hero} />
        <Mission t={t.mission} />
        <Taxes t={t.taxes} />
        <Beyond t={t.beyond} />
        <MoreTax t={t.moreTax} />
        <Audience t={t.audience} />
        {/* Light sheet that slides over "Who can apply": FAQ and the application form. */}
        <div data-header="light" className="relative z-10 -mt-[100svh] min-h-svh rounded-lg bg-surface shadow-[0_40px_60px_-30px_rgb(18_18_18/0.22)]">
          <Faq t={t.faq} />
          <Apply t={t.apply} locale={locale} />
        </div>
      </main>
      <div data-warp data-header="light">
        <Footer t={t.footer} />
      </div>
    </>
  );
}
