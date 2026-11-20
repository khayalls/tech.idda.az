"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from "react";

/*
 * Form controls for the application form. Shared language:
 *  · 60px tall, 16px corners, white surface with a hairline border on the page grey;
 *  · the label sits inside as a placeholder and lifts to a small caption on focus / when filled;
 *  · focus: accent border + soft accent ring; error: error border, the label turns error colour,
 *    the message unfolds underneath; a shake (restartable) when a submit finds the field wrong;
 *  Kept minimal: grey fields on the white sheet, a light ink border on focus, errors only after
 *  a submit attempt.
 */

// Figma 09: #f5f5f5 field, #f1f1f1 hairline, 16px corners, 60px tall.
const box =
  "relative h-15 w-full rounded-2xl border bg-page transition-[border-color] duration-200 ease-out";
const boxState = (error: boolean, focused: boolean) =>
  error
    ? "border-[var(--text-error)]"
    : focused
      ? "border-[rgb(18_18_18/0.4)]"
      : "border-[#f1f1f1] hover:border-[rgb(18_18_18/0.14)]";

/** Restartable shake: the parent bumps `shake` to replay it. */
const shakeStyle = (shake: number) =>
  shake ? { animation: `field-shake-${shake % 2 ? "a" : "b"} 380ms var(--ease-out)` } : undefined;

function FloatingLabel({
  htmlFor,
  id,
  up,
  error,
  children,
}: {
  htmlFor?: string;
  id?: string;
  up: boolean;
  error: boolean;
  children: ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      id={id}
      className={`pointer-events-none absolute top-0 left-4 origin-left text-label-m transition-[transform,color] duration-300 ease-emphasized ${
        up ? "translate-y-[9px] scale-[0.75]" : "translate-y-[18px] scale-100"
      } ${error ? "text-[var(--text-error)]" : "text-tertiary"}`}
    >
      {children}
    </label>
  );
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  // Keeps the last message while folding away, so the text doesn't vanish before the height.
  const [last, setLast] = useState(message);
  if (message && message !== last) setLast(message);
  return (
    <div
      className={`grid transition-[grid-template-rows,opacity] duration-300 ease-emphasized ${
        message ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
      }`}
    >
      <p id={id} role={message ? "alert" : undefined} className="overflow-hidden">
        <span
          className={`flex items-center gap-2 px-4 pt-2 text-body-s text-[var(--text-error)] transition-transform duration-300 ease-emphasized ${
            message ? "translate-y-0" : "-translate-y-1"
          }`}
        >
          {message ?? last}
        </span>
      </p>
    </div>
  );
}

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
  name: string;
  label: ReactNode;
  value: string;
  onChange: (v: string) => void;
  onBlurValidate?: () => void;
  error?: string;
  shake?: number;
};

export function TextField({
  name,
  label,
  value,
  onChange,
  onBlurValidate,
  error,
  shake = 0,
  ...rest
}: TextFieldProps) {
  const id = useId();
  const [focused, setFocused] = useState(false);
  const up = focused || value.length > 0;
  const errId = `${id}-error`;
  return (
    <div data-morph-src>
      <div className={`${box} ${boxState(!!error, focused)}`} style={shakeStyle(shake)}>
        <input
          {...rest}
          id={id}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            onBlurValidate?.();
          }}
          aria-invalid={!!error}
          aria-describedby={error ? errId : undefined}
          className="size-full rounded-2xl bg-transparent px-4 pt-[22px] pb-[6px] pr-11 text-label-m font-normal text-primary caret-current outline-none"
        />
        <FloatingLabel htmlFor={id} up={up} error={!!error}>
          {label}
        </FloatingLabel>
      </div>
      <FieldError id={errId} message={error} />
    </div>
  );
}

type Option = { value: string; label: string };

type SelectFieldProps = {
  name: string;
  label: ReactNode;
  value: string;
  options: Option[];
  onChange: (v: string) => void;
  onBlurValidate?: () => void;
  error?: string;
  shake?: number;
  /** Adds a filter box at the top of the list (long lists such as countries). */
  searchable?: boolean;
  searchPlaceholder?: string;
  noResults?: string;
};

const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase();

export function SelectField({
  name,
  label,
  value,
  options,
  onChange,
  onBlurValidate,
  error,
  shake = 0,
  searchable,
  searchPlaceholder,
  noResults,
}: SelectFieldProps) {
  const id = useId();
  const listId = `${id}-list`;
  const labelId = `${id}-label`;
  const errId = `${id}-error`;
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  // Options mount on first open: keeps the DOM light and avoids server/client Intl differences.
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const q = fold(query.trim());
    return options.filter((o) => fold(o.label).includes(q) || o.value.toLowerCase() === q);
  }, [options, query, searchable]);

  const openList = () => {
    setQuery("");
    const i = Math.max(0, options.findIndex((o) => o.value === value));
    setActive(i);
    setMounted(true);
    setOpen(true);
  };
  const close = (focusButton = true) => {
    setOpen(false);
    if (focusButton) buttonRef.current?.focus({ preventScroll: true });
  };
  const choose = (o: Option) => {
    onChange(o.value);
    close();
  };

  // Focus the filter box on open; keep the active option in view.
  useEffect(() => {
    if (!open || !searchable) return;
    // Next frame: the popover must be visible before it can take focus.
    const raf = requestAnimationFrame(() => searchRef.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(raf);
  }, [open, searchable]);
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  // Close on outside pointer.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        onBlurValidate?.();
      }
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open, onBlurValidate]);

  const onKey = (e: KeyboardEvent) => {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(filtered.length - 1);
    } else if (e.key === "Enter" || (e.key === " " && !searchable)) {
      e.preventDefault();
      const o = filtered[active];
      if (o) choose(o);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  const up = open || !!selected;
  const activeId = open && filtered[active] ? `${id}-opt-${filtered[active].value}` : undefined;

  return (
    <div data-morph-src ref={rootRef} className="relative">
      <div className={`${box} ${boxState(!!error, open || focused)}`} style={shakeStyle(shake)}>
        <button
          ref={buttonRef}
          id={id}
          type="button"
          name={name}
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          aria-labelledby={labelId}
          aria-activedescendant={searchable ? undefined : activeId}
          aria-invalid={!!error}
          aria-describedby={error ? errId : undefined}
          onClick={() => (open ? close() : openList())}
          onKeyDown={onKey}
          onFocus={() => setFocused(true)}
          onBlur={(e) => {
            setFocused(false);
            if (!rootRef.current?.contains(e.relatedTarget as Node) && !open) onBlurValidate?.();
          }}
          className="flex size-full cursor-pointer items-end rounded-2xl px-4 pb-[6px] text-left text-label-m font-normal text-primary outline-none"
        >
          <span
            className={`block truncate pr-8 transition-[opacity,transform] duration-300 ease-emphasized ${
              selected ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
            }`}
          >
            {selected?.label ?? " "}
          </span>
        </button>
        <FloatingLabel id={labelId} up={up} error={!!error}>
          {label}
        </FloatingLabel>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          className={`pointer-events-none absolute top-1/2 right-4 size-5 -translate-y-1/2 text-tertiary transition-transform duration-300 ease-emphasized ${
            open ? "rotate-180" : ""
          }`}
        >
          <path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {/* Popover: unfolds from the field (fade + slight scale), stays mounted for the exit.
          Visibility flips instantly on open (so the filter box can take focus at once) and
          only waits for the fade on close. */}
      <div
        className={`absolute inset-x-0 top-[calc(100%+8px)] z-30 origin-top overflow-hidden rounded-2xl border border-[rgb(18_18_18/0.06)] bg-surface shadow-[0_24px_48px_-12px_rgb(10_26_77/0.18)] duration-200 ease-out ${
          open
            ? "visible translate-y-0 scale-100 opacity-100 transition-[opacity,transform]"
            : "invisible -translate-y-1 scale-[0.98] opacity-0 transition-[opacity,transform,visibility]"
        }`}
      >
        {searchable && (
          <div className="border-b border-[rgb(18_18_18/0.06)] p-2">
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKey}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              aria-controls={listId}
              aria-activedescendant={activeId}
              tabIndex={open ? 0 : -1}
              className="h-11 w-full rounded-xl bg-page px-3 text-body-s text-primary caret-current outline-none placeholder:text-tertiary"
            />
          </div>
        )}
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-labelledby={labelId}
          className="max-h-64 overflow-y-auto overscroll-contain p-1.5"
          data-lenis-prevent
        >
          {mounted && filtered.map((o, i) => {
            const isSel = o.value === value;
            const isAct = i === active;
            return (
              <li
                key={o.value}
                id={`${id}-opt-${o.value}`}
                role="option"
                aria-selected={isSel}
                data-index={i}
                onPointerMove={() => setActive(i)}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => choose(o)}
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-body-s transition-colors duration-150 ${
                  isAct ? "bg-page" : ""
                } text-primary`}
              >
                <span className="truncate">{o.label}</span>
                {isSel && (
                  <svg viewBox="0 0 16 16" className="size-4 shrink-0" fill="none" aria-hidden="true">
                    <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </li>
            );
          })}
          {mounted && filtered.length === 0 && <li className="px-3 py-2.5 text-body-s text-tertiary">{noResults}</li>}
        </ul>
      </div>
      <FieldError id={errId} message={error} />
    </div>
  );
}

export function SubmitButton({ busy, label, busyLabel }: { busy: boolean; label: string; busyLabel: string }) {
  return (
    <button
      type="submit"
      disabled={busy}
      aria-busy={busy}
      data-morph-src
      className="relative h-[55px] w-full cursor-pointer overflow-hidden rounded-full bg-neutral-950 text-label-m text-white transition-[background-color,transform] duration-200 ease-out hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent active:scale-[0.985] disabled:cursor-default disabled:hover:bg-neutral-950"
    >
      <span
        className={`absolute inset-0 flex items-center justify-center transition-[transform,opacity] duration-300 ease-emphasized ${
          busy ? "-translate-y-full opacity-0" : "translate-y-0 opacity-100"
        }`}
      >
        {label}
      </span>
      <span
        aria-hidden={!busy}
        className={`absolute inset-0 flex items-center justify-center gap-2 transition-[transform,opacity] duration-300 ease-emphasized ${
          busy ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
        }`}
      >
        <span className="sr-only">{busyLabel}</span>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-1.5 rounded-full bg-white"
            style={busy ? { animation: `dot-wave 900ms ${i * 120}ms infinite var(--ease-out)` } : undefined}
          />
        ))}
      </span>
    </button>
  );
}
