import { closetErrorResponse, reserveGarment } from "@/lib/closet";
import { assertSameOrigin, requireSession } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requireSession();
    const body = await request.json();
    const reservation = await reserveGarment(session.id, body?.itemId, body?.pickupDay);
    return Response.json({ reservation }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return closetErrorResponse(error); }
}
