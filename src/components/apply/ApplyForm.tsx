"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import {
  APPLICANT_TYPES,
  EMPTY_VALUES,
  countryOptions,
  validate,
  validateField,
  type ApplyErrors,
  type ApplyField,
  type ApplyValues,
} from "@/lib/apply";
import { SelectField, SubmitButton, TextField } from "./fields";
import { BADGE, playSuccessMorph } from "./successMorph";

type Status = "idle" | "submitting" | "morphing" | "done";

const ORDER: ApplyField[] = ["applicantType", "fullName", "companyName", "email", "phone", "country"];

/**
 * Application form (Figma 09). Errors show only after Apply is pressed: every wrong field shakes
 * and the first one takes focus; from then on fields re-check as you type, so a fixed field
 * clears immediately. On success the fields dissolve into dots that gather into
 * a dot badge with a check, and a short confirmation appears underneath.
 */
export function ApplyForm({ t, locale }: { t: Dictionary["apply"]; locale: Locale }) {
  const [values, setValues] = useState<ApplyValues>(EMPTY_VALUES);
  const [errors, setErrors] = useState<ApplyErrors>({});
  const [touched, setTouched] = useState<Partial<Record<ApplyField, boolean>>>({});
  const [shake, setShake] = useState<Partial<Record<ApplyField, number>>>({});
  const [status, setStatus] = useState<Status>("idle");
  const [formError, setFormError] = useState<string | null>(null);
  const [lockedHeight, setLockedHeight] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Names come from Intl; the list itself only renders once opened (see SelectField).
  const countries = useMemo(() => countryOptions(locale), [locale]);
  const types = APPLICANT_TYPES.map((v) => ({ value: v, label: t.applicantType.options[v] }));

  const message = (f: ApplyField) => (errors[f] ? t.errors[errors[f]!] : undefined);

  const set = (f: ApplyField) => (v: string) => {
    setValues((s) => ({ ...s, [f]: v }));
    setFormError(null);
    // Errors appear only after a submit attempt; from then on a fixed field clears as you type.
    if (touched[f]) setErrors((e) => ({ ...e, [f]: validateField(f, v) ?? undefined }));
  };
  const chooseSelect = (f: ApplyField) => (v: string) => {
    setValues((s) => ({ ...s, [f]: v }));
    if (touched[f]) setErrors((e) => ({ ...e, [f]: validateField(f, v) ?? undefined }));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (status !== "idle") return;
    setFormError(null);
    const errs = validate(values);
    setErrors(errs);
    setTouched(Object.fromEntries(ORDER.map((f) => [f, true])));
    const bad = ORDER.filter((f) => errs[f]);
    if (bad.length) {
      setShake((s) => Object.fromEntries(ORDER.map((f) => [f, errs[f] ? (s[f] ?? 0) + 1 : s[f] ?? 0])));
      // Focus the first wrong field.
      const idx = ORDER.indexOf(bad[0]);
      const el = formRef.current?.querySelectorAll<HTMLElement>("[data-morph-src] input, [data-morph-src] button")[idx];
      el?.focus({ preventScroll: false });
      return;
    }

    setStatus("submitting");
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, locale }),
      });
      const data = await res.json().catch(() => null);
      if (!data?.success) throw new Error("failed");
    } catch {
      setStatus("idle");
      setFormError(t.errors.generic);
      return;
    }

    // Success: lock the height, dissolve the form into dots, then settle on the confirmation.
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) {
      setStatus("done");
      return;
    }
    setLockedHeight(container.offsetHeight);
    setStatus("morphing");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    await playSuccessMorph(container, canvas, reduce);
    setStatus("done");
    setLockedHeight(BADGE.top + BADGE.r + 132);
    // The page got shorter: let the smooth scroller re-measure once the height has settled.
    window.setTimeout(() => (window as unknown as { lenis?: { resize: () => void } }).lenis?.resize(), 760);
  };

  const hidden = status === "morphing" || status === "done";

  return (
    <div
      ref={containerRef}
      className={`relative w-full max-w-[400px] transition-[height] duration-700 ease-emphasized ${hidden ? "overflow-hidden" : ""}`}
      style={lockedHeight ? { height: lockedHeight } : undefined}
    >
      <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute top-0 left-0 z-10" />

      <form
        ref={formRef}
        noValidate
        onSubmit={onSubmit}
        aria-hidden={hidden}
        inert={hidden}
        className={`flex flex-col gap-6 transition-[opacity,filter] duration-300 ease-out ${
          hidden ? "opacity-0 blur-[2px]" : "opacity-100"
        }`}
      >
        <div className="flex flex-col gap-4">
          <SelectField
            name="applicantType"
            label={t.applicantType.label}
            value={values.applicantType}
            options={types}
            onChange={chooseSelect("applicantType")}
            error={message("applicantType")}
            shake={shake.applicantType}
          />
          <TextField
            name="fullName"
            label={t.fields.fullName}
            autoComplete="name"
            value={values.fullName}
            onChange={set("fullName")}
            error={message("fullName")}
            shake={shake.fullName}
          />
          <TextField
            name="companyName"
            label={
              <>
                {t.fields.companyName} <span className="text-muted">· {t.optional}</span>
              </>
            }
            autoComplete="organization"
            value={values.companyName}
            onChange={set("companyName")}
          />
          <TextField
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            spellCheck={false}
            label={t.fields.email}
            value={values.email}
            onChange={set("email")}
            error={message("email")}
            shake={shake.email}
          />
          <TextField
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            label={t.fields.phone}
            value={values.phone}
            onChange={set("phone")}
            error={message("phone")}
            shake={shake.phone}
          />
          <SelectField
            name="country"
            label={t.fields.country}
            value={values.country}
            options={countries}
            onChange={chooseSelect("country")}
            error={message("country")}
            shake={shake.country}
            searchable
            searchPlaceholder={t.countrySearch}
            noResults={t.noResults}
          />
        </div>

        <div className="flex flex-col gap-3">
          <div
            className={`grid transition-[grid-template-rows,opacity] duration-300 ease-emphasized ${
              formError ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
            }`}
          >
            <p role={formError ? "alert" : undefined} className="overflow-hidden text-center text-body-s text-[var(--text-error)]">
              {formError}
            </p>
          </div>
          <SubmitButton busy={status === "submitting"} label={t.submit} busyLabel={t.submitting} />
        </div>
      </form>

      {/* Confirmation under the dot badge: short and plain. */}
      <div
        role="status"
        aria-live="polite"
        className={`absolute inset-x-0 text-center transition-[opacity,transform] duration-500 ease-emphasized ${
          status === "done" ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
        }`}
        style={{ top: BADGE.top + BADGE.r + 28 }}
      >
        {status === "done" && (
          <>
            <p className="text-heading-s text-primary">{t.success.heading}</p>
            <p className="mt-2 text-body-m text-tertiary">{t.success.description}</p>
          </>
        )}
      </div>
    </div>
  );
}
