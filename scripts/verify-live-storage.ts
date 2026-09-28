// Explicit opt-in integration check: creates and deletes only its own random fixture.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { del } from "@vercel/blob";
import { mutateWorkspace, readWorkspace } from "../lib/store";

async function main() {
  process.loadEnvFile(".env.local");
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("A private Blob token is required for this live check.");
  Object.assign(process.env, { NODE_ENV: "production" });
  const id = randomBytes(16).toString("hex");
  const padding = "x".repeat(4096);
  try {
    await mutateWorkspace(id, state => { state.tasks.large = { status: "completed", padding }; });
    await Promise.all(Array.from({ length: 5 }, () => mutateWorkspace(id, state => { state.renderCount++; })));
    const state = await readWorkspace(id);
    assert.equal(state.renderCount, 5);
    assert.equal((state.tasks.large as { padding: string }).padding, padding);
    console.log("PASS: large-state conditional writes preserve all 5 concurrent updates.");
  } finally {
    await del(`readyroom/workspaces/${id}.json`);
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
