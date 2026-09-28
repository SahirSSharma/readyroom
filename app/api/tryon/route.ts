import { NextResponse } from "next/server";
import { assertSameOrigin, requireSession } from "@/lib/session";
import { startPreview } from "@/lib/tryon";
import { apiError } from "@/lib/api-error";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requireSession();
    if (Number(request.headers.get("content-length") || 0) > 4.3 * 1024 * 1024) return NextResponse.json({ error: "Choose a photo smaller than 4 MB." }, { status: 413 });
    return NextResponse.json(await startPreview(session.id, await request.formData()), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
