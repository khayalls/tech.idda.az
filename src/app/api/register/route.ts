import { countryNameEn, EMPTY_VALUES, validate, type ApplyField, type ApplyValues } from "@/lib/apply";

/**
 * POST /api/register — the application form.
 *
 * Validates the payload with the same rules as the form, then forwards it (country as its English
 * name, like the current tech.idda.az form) to APPLY_FORWARD_URL. Without a forward URL the
 * submission is accepted in development only, so the form can be exercised locally; production
 * answers 503 until a destination is configured.
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ success: false, error: "invalid_json" }, { status: 400 });
  }

  const values = { ...EMPTY_VALUES };
  for (const key of Object.keys(EMPTY_VALUES) as ApplyField[]) {
    const v = body[key];
    values[key] = typeof v === "string" ? v.trim().slice(0, 200) : "";
  }
  const errors = validate(values);
  if (Object.keys(errors).length) return Response.json({ success: false, errors }, { status: 422 });

  const payload: ApplyValues & { locale: string } = {
    ...values,
    country: countryNameEn(values.country),
    locale: body.locale === "az" ? "az" : "en",
  };

  const target = process.env.APPLY_FORWARD_URL;
  if (!target) {
    if (process.env.NODE_ENV !== "production") return Response.json({ success: true, dev: true });
    return Response.json({ success: false, error: "not_configured" }, { status: 503 });
  }

  try {
    const res = await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return Response.json({ success: false, error: "upstream" }, { status: 502 });
    return Response.json({ success: true });
  } catch {
    return Response.json({ success: false, error: "upstream" }, { status: 502 });
  }
}
