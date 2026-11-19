"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { localeLabels, localePath, locales, type Locale } from "@/i18n/config";

type Props = {
  current: Locale;
  label: string;
  className?: string;
};

export function LanguageSwitcher({ current, label, className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        aria-label={`${label}: ${localeLabels[current]}`}
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded-full py-2 pr-2 pl-3 text-label-m transition-colors duration-200 hover:bg-current/8"
      >
        {localeLabels[current]}
        <svg
          viewBox="0 0 24 24"
          className={`size-6 transition-transform duration-200 ease-out ${open ? "rotate-180" : ""}`}
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M12 13.17 16.95 8.22l1.41 1.41L12 16 5.64 9.63l1.41-1.41L12 13.17Z" />
        </svg>
      </button>
      <ul
        id={listId}
        hidden={!open}
        className="absolute top-full right-0 mt-2 min-w-24 overflow-hidden rounded-md bg-surface p-1 text-primary shadow-[0_8px_32px_rgb(18_18_18/0.12)]"
      >
        {locales.map((l) => (
          <li key={l}>
            <Link
              href={localePath(l)}
              hrefLang={l}
              lang={l}
              aria-current={l === current ? "true" : undefined}
              onClick={() => setOpen(false)}
              className="flex items-center justify-between gap-4 rounded-sm px-3 py-2 text-label-m hover:bg-page aria-[current]:text-accent"
            >
              {localeLabels[l]}
              <span className="text-caption text-tertiary">{l === "en" ? "English" : "Azərbaycan"}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
