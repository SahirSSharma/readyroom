import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { getPreview, taskView } from "@/lib/tryon";
import { apiError } from "@/lib/api-error";
export const runtime = "nodejs";
export async function GET(_request: Request, context: { params: Promise<{ taskId: string }> }) {
  try {
    const { id } = await requireSession();
    const { taskId } = await context.params;
    return NextResponse.json(taskView(await getPreview(id, taskId)), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
