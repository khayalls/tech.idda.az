/**
 * Application form — shared by the client form and the /api/register handler.
 * Fields, rules and the country list mirror the current tech.idda.az registration form so the
 * payload stays compatible: { applicantType, fullName, companyName, email, phone, country }
 * with `country` sent as its English name.
 */

export const APPLICANT_TYPES = ["legalEntity", "individualEntrepreneur", "freelancer", "digitalNomad"] as const;
export type ApplicantType = (typeof APPLICANT_TYPES)[number];

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_PATTERN = /^[+\d][\d\s()-]{6,}$/;

export type ApplyValues = {
  applicantType: string;
  fullName: string;
  companyName: string;
  email: string;
  phone: string;
  /** ISO 3166-1 alpha-2 code in the form; sent as the English country name. */
  country: string;
};
export type ApplyField = keyof ApplyValues;
export type ApplyError = "required" | "email" | "phone";
export type ApplyErrors = Partial<Record<ApplyField, ApplyError>>;

export const EMPTY_VALUES: ApplyValues = {
  applicantType: "",
  fullName: "",
  companyName: "",
  email: "",
  phone: "",
  country: "",
};

/** ISO 3166-1 alpha-2 codes offered in the country list (same set as tech.idda.az). */
export const COUNTRY_CODES = [
  "AD", "AE", "AF", "AG", "AI", "AL", "AO", "AQ", "AR", "AS", "AT", "AU", "AW", "AX", "AZ", "BA", "BB", "BD", "BE", "BF",
  "BG", "BH", "BI", "BJ", "BL", "BM", "BN", "BO", "BQ", "BR", "BS", "BT", "BV", "BW", "BY", "BZ", "CA", "CC", "CD", "CF",
  "CG", "CH", "CI", "CK", "CL", "CM", "CN", "CO", "CR", "CU", "CV", "CW", "CX", "CY", "CZ", "DE", "DJ", "DK", "DM", "DO",
  "DZ", "EC", "EE", "EG", "EH", "ER", "ES", "ET", "FI", "FJ", "FK", "FM", "FO", "FR", "GA", "GB", "GD", "GE", "GF", "GG",
  "GH", "GI", "GL", "GM", "GN", "GP", "GQ", "GR", "GS", "GT", "GU", "GW", "GY", "HK", "HM", "HN", "HR", "HT", "HU", "ID",
  "IE", "IL", "IM", "IN", "IO", "IQ", "IR", "IS", "IT", "JE", "JM", "JO", "JP", "KE", "KG", "KH", "KI", "KM", "KN", "KP",
  "KR", "KW", "KY", "KZ", "LA", "LB", "LC", "LI", "LK", "LR", "LS", "LT", "LU", "LV", "LY", "MA", "MC", "MD", "ME", "MF",
  "MG", "MH", "MK", "ML", "MM", "MN", "MO", "MP", "MQ", "MR", "MS", "MT", "MU", "MV", "MW", "MX", "MY", "MZ", "NA", "NC",
  "NE", "NF", "NG", "NI", "NL", "NO", "NP", "NR", "NU", "NZ", "OM", "PA", "PE", "PF", "PG", "PH", "PK", "PL", "PM", "PN",
  "PR", "PS", "PT", "PW", "PY", "QA", "RE", "RO", "RS", "RU", "RW", "SA", "SB", "SC", "SD", "SE", "SG", "SH", "SI", "SJ",
  "SK", "SL", "SM", "SN", "SO", "SR", "SS", "ST", "SV", "SX", "SY", "SZ", "TC", "TD", "TF", "TG", "TH", "TJ", "TK", "TL",
  "TM", "TN", "TO", "TR", "TT", "TV", "TW", "TZ", "UA", "UG", "UM", "US", "UY", "UZ", "VA", "VC", "VE", "VG", "VI", "VN",
  "VU", "WF", "WS", "YE", "YT", "ZA", "ZM", "ZW",
] as const;

export function isApplicantType(v: string): v is ApplicantType {
  return (APPLICANT_TYPES as readonly string[]).includes(v);
}

export function isCountryCode(v: string) {
  return (COUNTRY_CODES as readonly string[]).includes(v);
}

/** Validates one field; returns the error key or null. */
export function validateField(name: ApplyField, raw: string): ApplyError | null {
  const v = raw.trim();
  switch (name) {
    case "applicantType":
      return isApplicantType(v) ? null : "required";
    case "country":
      return isCountryCode(v) ? null : "required";
    case "companyName":
      return null;
    case "email":
      return !v ? "required" : EMAIL_PATTERN.test(v) ? null : "email";
    case "phone":
      return !v ? "required" : PHONE_PATTERN.test(v) ? null : "phone";
    default:
      return v ? null : "required";
  }
}

export function validate(values: ApplyValues): ApplyErrors {
  const errors: ApplyErrors = {};
  for (const name of Object.keys(EMPTY_VALUES) as ApplyField[]) {
    const e = validateField(name, values[name] ?? "");
    if (e) errors[name] = e;
  }
  return errors;
}

/** Country list for a locale: Azerbaijan first, then alphabetical in that language. */
export function countryOptions(locale: string) {
  const names = new Intl.DisplayNames([locale], { type: "region" });
  return COUNTRY_CODES.map((code) => ({ value: code as string, label: names.of(code) ?? code })).sort((a, b) =>
    a.value === "AZ" ? -1 : b.value === "AZ" ? 1 : a.label.localeCompare(b.label, locale),
  );
}

export function countryNameEn(code: string) {
  return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
}
