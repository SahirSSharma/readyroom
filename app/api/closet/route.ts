import { getCloset, closetErrorResponse } from "@/lib/closet";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getSession();
    return Response.json(await getCloset(session.id), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return closetErrorResponse(error); }
}
