import { RevealText } from "@/components/motion/RevealText";
import type { Dictionary } from "@/i18n/dictionaries";

/**
 * 02 — Mission. A light sheet that slides over the pinned hero (negative top margin = hero's
 * cover distance, see Hero COVER). The scroll-driven globe lands here next.
 */
export function Mission({ t }: { t: Dictionary["mission"] }) {
  return (
    <section
      id="why-azerbaijan"
      data-header="light"
      className="relative z-10 -mt-[100svh] min-h-svh rounded-t-lg bg-page text-primary shadow-[0_-40px_60px_-20px_rgb(3_10_38/0.4)]"
    >
      <div className="container-page section-y flex flex-col items-center">
        <RevealText as="h2" exit className="max-w-[22ch] text-center text-heading-xl text-balance">
          {t.title}
        </RevealText>
      </div>
    </section>
  );
}
