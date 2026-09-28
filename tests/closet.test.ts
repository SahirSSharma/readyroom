import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { ClosetError, getCloset, HOLD_TTL_MS, reserveGarment, updateReservation } from "../lib/closet";
import { assertSameOrigin, signSession, verifySession } from "../lib/session";
import { mutateWorkspace, readWorkspace } from "../lib/store";

const now = Date.parse("2026-09-29T16:00:00Z");
const newWorkspace = () => randomBytes(16).toString("hex");
let temporaryDirectory: string;

before(async () => {
  temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "readyroom-closet-"));
  process.env.STORE_LOCAL_DIR = temporaryDirectory;
  process.env.STORE_FORCE_LOCAL = "true";
  delete process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.BLOB_STORE_ID;
  process.env.SESSION_SECRET = "readyroom-test-secret-with-at-least-32-characters";
});

after(async () => { await rm(temporaryDirectory, { recursive: true, force: true }); });

test("concurrent attempts to hold one item produce exactly one reservation", async () => {
  const workspace = newWorkspace();
  const results = await Promise.allSettled(Array.from({ length: 12 }, () => reserveGarment(workspace, "navy", "2026-09-29", now)));
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const rejected = results.filter((result) => result.status === "rejected");
  assert.equal(rejected.length, 11);
  for (const result of rejected) assert.equal((result.reason as ClosetError).status, 409);
  const closet = await getCloset(workspace, now);
  assert.equal(closet.reservations.length, 1);
  assert.equal(closet.items.find((item) => item.id === "navy")?.status, "held");
});

test("expired holds release at the exact deadline and allow a new reservation", async () => {
  const workspace = newWorkspace();
  const original = await reserveGarment(workspace, "sand", "2026-09-29", now);
  assert.equal((await getCloset(workspace, now + HOLD_TTL_MS - 1)).items.find((item) => item.id === "sand")?.status, "held");
  const expired = await getCloset(workspace, now + HOLD_TTL_MS);
  assert.equal(expired.items.find((item) => item.id === "sand")?.status, "available");
  assert.equal(expired.reservations[0].status, "released");
  await assert.rejects(updateReservation(workspace, original.id, "collect", now + HOLD_TTL_MS), { status: 409 });
  const replacement = await reserveGarment(workspace, "sand", "2026-09-30", now + HOLD_TTL_MS);
  assert.notEqual(replacement.id, original.id);
});

test("a different workspace cannot view or alter another workspace's hold", async () => {
  const owner = newWorkspace();
  const visitor = newWorkspace();
  const reservation = await reserveGarment(owner, "olive", "2026-09-29", now);
  assert.equal((await getCloset(visitor, now)).reservations.length, 0);
  await assert.rejects(updateReservation(visitor, reservation.id, "collect", now), { status: 404 });
  assert.equal((await getCloset(owner, now)).reservations[0].status, "held");
  assert.equal((await reserveGarment(visitor, "olive", "2026-09-29", now)).status, "held");
});

test("pickup rejects duplicates, remains collected after hold deadline, and return frees the item", async () => {
  const workspace = newWorkspace();
  const reservation = await reserveGarment(workspace, "charcoal", "2026-09-29", now);
  await assert.rejects(updateReservation(workspace, reservation.id, "return", now), { status: 409 });
  assert.equal((await updateReservation(workspace, reservation.id, "collect", now)).status, "collected");
  await assert.rejects(updateReservation(workspace, reservation.id, "collect", now), { status: 409 });
  await assert.rejects(updateReservation(workspace, reservation.id, "release", now), { status: 409 });
  assert.equal((await getCloset(workspace, now + HOLD_TTL_MS)).items.find((item) => item.id === "charcoal")?.status, "collected");
  assert.equal((await updateReservation(workspace, reservation.id, "return", now + HOLD_TTL_MS)).status, "released");
  await assert.rejects(updateReservation(workspace, reservation.id, "return", now + HOLD_TTL_MS), { status: 409 });
  assert.equal((await getCloset(workspace, now + HOLD_TTL_MS)).items.find((item) => item.id === "charcoal")?.status, "available");
});

test("invalid garments, dates, actions and path traversal cannot mutate state", async () => {
  const workspace = newWorkspace();
  await assert.rejects(reserveGarment(workspace, "missing", "2026-09-29", now), { status: 404 });
  await assert.rejects(reserveGarment(workspace, "navy", "2026-02-30", now), { status: 400 });
  await assert.rejects(reserveGarment(workspace, "navy", "Tomorrow", now), { status: 400 });
  await assert.rejects(updateReservation(workspace, "missing", "erase", now), { status: 400 });
  await assert.rejects(readWorkspace("../../somewhere"), { status: 401 });
  assert.equal((await getCloset(workspace, now)).reservations.length, 0);
});

test("signed sessions reject tampering, a changed secret and expiration", () => {
  const id = newWorkspace();
  const token = signSession(id, now);
  assert.equal(verifySession(token, now), id);
  assert.equal(verifySession(token.replace(id, newWorkspace()), now), null);
  assert.equal(verifySession(`${token}x`, now), null);
  assert.equal(verifySession(token, now + 7 * 24 * 60 * 60 * 1000), null);
  const secret = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = "different-session-secret-at-least-32-characters";
  assert.equal(verifySession(token, now), null);
  process.env.SESSION_SECRET = secret;
});

test("write requests require a matching Origin header", () => {
  assert.doesNotThrow(() => assertSameOrigin(new Request("https://readyroom.example/api/reservations", { headers: { origin: "https://readyroom.example" } })));
  assert.throws(() => assertSameOrigin(new Request("https://readyroom.example/api/reservations")), { status: 403 });
  assert.throws(() => assertSameOrigin(new Request("https://readyroom.example/api/reservations", { headers: { origin: "https://elsewhere.example" } })), { status: 403 });
});

test("concurrent render accounting preserves all increments and reservation fields", async () => {
  const workspace = newWorkspace();
  const reservation = await reserveGarment(workspace, "black", "2026-09-29", now);
  await Promise.all(Array.from({ length: 20 }, () => mutateWorkspace(workspace, (state) => { state.renderCount++; })));
  const state = await readWorkspace(workspace);
  assert.equal(state.renderCount, 20);
  assert.equal(state.reservations[0].id, reservation.id);
});

test("production fails closed without Blob even when the development override is set", async () => {
  const environment = process.env as Record<string, string | undefined>;
  const previous = environment.NODE_ENV;
  environment.NODE_ENV = "production";
  try {
    await assert.rejects(readWorkspace(newWorkspace()), { status: 503 });
    await assert.rejects(mutateWorkspace(newWorkspace(), (workspace) => { workspace.renderCount++; }), { status: 503 });
  } finally {
    if (previous === undefined) delete environment.NODE_ENV;
    else environment.NODE_ENV = previous;
  }
});

test("same-origin checks use the external Host when Next normalizes an internal URL", () => {
  assert.doesNotThrow(() => assertSameOrigin(new Request("http://localhost:3091/api/reservations", {
    headers: { host: "127.0.0.1:3091", origin: "http://127.0.0.1:3091" },
  })));
  assert.throws(() => assertSameOrigin(new Request("http://localhost:3091/api/reservations", {
    headers: { host: "127.0.0.1:3091", origin: "https://attacker.example" },
  })));
});
