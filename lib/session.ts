import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { validWorkspaceId } from "./store";

export const SESSION_COOKIE = "rr_workspace";
const SESSION_SECONDS = 7 * 24 * 60 * 60;

export class SessionError extends Error {
  constructor(message: string, public status = 401) { super(message); }
}

function sessionSecret() {
  const configured = process.env.SESSION_SECRET;
  if (configured && configured.length >= 32) return configured;
  if (process.env.NODE_ENV === "production") throw new SessionError("The demonstration session is temporarily unavailable.", 503);
  const state = globalThis as typeof globalThis & { readyroomDevSecret?: string };
  return state.readyroomDevSecret ??= randomBytes(32).toString("hex");
}

export function signSession(id: string, now = Date.now()) {
  if (!validWorkspaceId(id)) throw new SessionError("Invalid demonstration session.");
  const payload = `v1.${id}.${Math.floor(now / 1000) + SESSION_SECONDS}`;
  return `${payload}.${createHmac("sha256", sessionSecret()).update(payload).digest("base64url")}`;
}

export function verifySession(token: string | undefined, now = Date.now()): string | null {
  if (!token || token.length > 160) return null;
  const [version, id, expires, signature, extra] = token.split(".");
  if (version !== "v1" || !id || !validWorkspaceId(id) || !/^\d{10}$/.test(expires || "") ||
      Number(expires) <= Math.floor(now / 1000) || !signature || extra !== undefined) return null;
  const expected = createHmac("sha256", sessionSecret()).update(`${version}.${id}.${expires}`).digest("base64url");
  const actualBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes) ? id : null;
}

export async function getSession(): Promise<{ id: string; isNew: boolean }> {
  const jar = await cookies();
  const existing = verifySession(jar.get(SESSION_COOKIE)?.value);
  if (existing) return { id: existing, isNew: false };
  const id = randomBytes(16).toString("hex");
  jar.set(SESSION_COOKIE, signSession(id), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax",
    path: "/", maxAge: SESSION_SECONDS,
  });
  return { id, isNew: true };
}

export async function requireSession(): Promise<{ id: string; isNew: false }> {
  const jar = await cookies();
  const id = verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!id) throw new SessionError("Open the fitting room to start a demonstration session.");
  return { id, isNew: false };
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  // Next may normalize the internal URL to localhost. The browser's Host
  // remains the external authority and cannot be set by cross-origin scripts.
  const expected = new URL(request.url);
  const host = request.headers.get("host");
  if (host) expected.host = host;
  const forwardedProtocol = process.env.VERCEL ? request.headers.get("x-forwarded-proto") : null;
  if (forwardedProtocol === "https" || forwardedProtocol === "http") expected.protocol = `${forwardedProtocol}:`;
  if (!origin || origin !== expected.origin) {
    throw new SessionError("This action must be made from your Readyroom session.", 403);
  }
}
