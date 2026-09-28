import { NextResponse } from "next/server";
import { SessionError } from "./session";
import { StoreError } from "./store";
import { TryonError } from "./youcam";
export function apiError(error: unknown) {
  const known = error instanceof SessionError || error instanceof StoreError || error instanceof TryonError;
  return NextResponse.json({ error: known ? error.message : "The connection was interrupted. Please try again." }, { status: known ? error.status : 503, headers: { "Cache-Control": "no-store" } });
}
