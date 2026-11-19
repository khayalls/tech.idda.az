import { ScrollLines } from "@/components/motion/ScrollLines";
import type { Dictionary } from "@/i18n/dictionaries";

/** 04 — Beyond tax. A single statement; lines arrive and leave with the site's scroll motion. */
export function Beyond({ t }: { t: Dictionary["beyond"] }) {
  return (
    <section data-header="light" className="bg-page text-primary">
      <div className="container-page section-y">
        <ScrollLines className="mx-auto max-w-[1000px] text-center text-display-l">{t.text}</ScrollLines>
      </div>
    </section>
  );
}
