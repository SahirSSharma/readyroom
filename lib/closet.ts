import { randomBytes, randomUUID } from "node:crypto";
import { CATALOG, findGarment, type Garment, type Reservation } from "./catalog";
import { mutateWorkspace, readWorkspace, StoreError, type Workspace } from "./store";
import { SessionError } from "./session";

export const HOLD_TTL_MS = 15 * 60 * 1000;

export class ClosetError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

function releaseExpired(workspace: Workspace, now: number) {
  for (const reservation of workspace.reservations) {
    if (reservation.status === "held" && Date.parse(reservation.expiresAt) <= now) reservation.status = "released";
  }
}

function snapshot(workspace: Workspace) {
  const items: Garment[] = CATALOG.map((item) => {
    const active = workspace.reservations.find((entry) => entry.itemId === item.id && entry.status !== "released");
    return { ...item, status: active?.status === "held" ? "held" : active?.status === "collected" ? "collected" : "available", ...(active ? { reservationId: active.id } : {}) };
  });
  return { items, reservations: workspace.reservations, renderCount: workspace.renderCount };
}

export async function getCloset(workspaceId: string, now = Date.now()) {
  const workspace = await readWorkspace(workspaceId);
  if (workspace.reservations.some((entry) => entry.status === "held" && Date.parse(entry.expiresAt) <= now)) {
    return mutateWorkspace(workspaceId, (latest) => { releaseExpired(latest, now); return snapshot(latest); });
  }
  return snapshot(workspace);
}

export async function reserveGarment(workspaceId: string, itemId: unknown, pickupDay: unknown, now = Date.now()) {
  const item = typeof itemId === "string" ? findGarment(itemId) : undefined;
  if (!item) throw new ClosetError("Choose an item from the demonstration closet.", 404);
  if (typeof pickupDay !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(pickupDay) ||
      Number.isNaN(Date.parse(pickupDay)) || new Date(pickupDay).toISOString().slice(0, 10) !== pickupDay) {
    throw new ClosetError("Choose a valid demonstration pickup day.");
  }
  return mutateWorkspace(workspaceId, (workspace): Reservation => {
    releaseExpired(workspace, now);
    if (workspace.reservations.some((entry) => entry.itemId === item.id && entry.status !== "released")) {
      throw new ClosetError("This item is already held or collected in your demonstration closet.", 409);
    }
    const reservation: Reservation = {
      id: randomUUID(), itemId: item.id, itemName: item.name,
      pickupCode: `RR-${randomBytes(3).toString("hex").toUpperCase()}`, pickupDay,
      status: "held", createdAt: new Date(now).toISOString(), expiresAt: new Date(now + HOLD_TTL_MS).toISOString(),
    };
    workspace.reservations.unshift(reservation);
    return reservation;
  });
}

export async function updateReservation(workspaceId: string, reservationId: string, action: unknown, now = Date.now()) {
  if (action !== "release" && action !== "collect" && action !== "return") throw new ClosetError("Choose a valid pickup-desk action.");
  return mutateWorkspace(workspaceId, (workspace): Reservation => {
    releaseExpired(workspace, now);
    const reservation = workspace.reservations.find((entry) => entry.id === reservationId);
    if (!reservation) throw new ClosetError("That reservation was not found in your demonstration closet.", 404);
    const requiredStatus = action === "return" ? "collected" : "held";
    if (reservation.status !== requiredStatus) {
      throw new ClosetError(action === "return" ? "Only a collected item can be returned." : "This hold is no longer active.", 409);
    }
    reservation.status = action === "collect" ? "collected" : "released";
    return reservation;
  });
}

export function closetErrorResponse(error: unknown) {
  if (error instanceof ClosetError || error instanceof SessionError || error instanceof StoreError) {
    return Response.json({ error: error.message }, { status: error.status, headers: { "Cache-Control": "no-store" } });
  }
  if (error instanceof SyntaxError) return Response.json({ error: "Send a valid JSON request." }, { status: 400 });
  console.error("Readyroom closet request failed:", error instanceof Error ? error.name : "UnknownError");
  return Response.json({ error: "The demonstration closet is temporarily unavailable. Please try again." }, { status: 503 });
}
