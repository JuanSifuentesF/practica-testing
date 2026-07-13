// frontend/app/api/settings/ai/test-connection/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { inspectAiRuntimeConfiguration } from "@/lib/ai/runtime";
import { isPlainObject } from "@/lib/ai/settings-contract";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "NO_SESSION" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  if (!isPlainObject(body)) {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  for (const key of Object.keys(body)) {
    if (key !== "byokApiKey") {
      return NextResponse.json({ error: "UNKNOWN_FIELD" }, { status: 400 });
    }
  }

  let byokApiKey: string | undefined;
  if (Object.prototype.hasOwnProperty.call(body, "byokApiKey")) {
    if (typeof body.byokApiKey !== "string") {
      return NextResponse.json({ error: "INVALID_BYOK_KEY" }, { status: 400 });
    }

    const trimmed = body.byokApiKey.trim();
    if (trimmed.length > 512) {
      return NextResponse.json({ error: "INVALID_BYOK_KEY" }, { status: 400 });
    }
    byokApiKey = trimmed || undefined;
  }

  try {
    const data = await inspectAiRuntimeConfiguration({
      userId: user.id,
      byokApiKey,
    });

    // El resultado no contiene settings, cuota, eventId ni la key recibida.
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json(
      { error: "SETTINGS_INSPECTION_FAILED" },
      { status: 500 },
    );
  }
}
