import { closetErrorResponse, updateReservation } from "@/lib/closet";
import { assertSameOrigin, requireSession } from "@/lib/session";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await requireSession();
    const { id } = await context.params;
    const body = await request.json();
    const reservation = await updateReservation(session.id, id, body?.action);
    return Response.json({ reservation }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return closetErrorResponse(error); }
}
