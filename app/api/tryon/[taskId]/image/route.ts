import { requireSession } from "@/lib/session";
import { getPreview } from "@/lib/tryon";
import { trustedProviderUrl, TryonError } from "@/lib/youcam";
import { apiError } from "@/lib/api-error";
export const runtime = "nodejs";
export async function GET(_request: Request, context: { params: Promise<{ taskId: string }> }) {
  try {
    const { id } = await requireSession();
    const task = await getPreview(id, (await context.params).taskId);
    if (!task.resultUrl || task.status !== "completed") throw new TryonError("This preview is not ready yet.", 409);
    const response = await fetch(trustedProviderUrl(task.resultUrl), { signal: AbortSignal.timeout(20_000), redirect: "error", cache: "no-store" });
    if (!response.ok) throw new TryonError("This image link has expired. Create a new preview.", 410);
    return new Response(response.body, { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return apiError(error); }
}
