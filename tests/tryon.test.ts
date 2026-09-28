import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { normalizePhoto, trustedProviderUrl, createYoucamTask, checkYoucamTask } from "../lib/youcam";
import { startPreview, getPreview, SESSION_RENDER_LIMIT } from "../lib/tryon";
import { mutateWorkspace, readWorkspace } from "../lib/store";

process.env.STORE_FORCE_LOCAL = "true";
const id = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
let directory: string;
test.before(async () => { directory = await mkdtemp(path.join(os.tmpdir(), "readyroom-preview-")); process.env.STORE_LOCAL_DIR = directory; });
test.after(async () => { await rm(directory, { recursive: true, force: true }); });

test("photo normalizer rejects malformed, vector and tiny images", async () => {
  await assert.rejects(normalizePhoto(Buffer.from("not an image")), /Choose a clear/);
  await assert.rejects(normalizePhoto(Buffer.from('<svg width="400" height="400"></svg>')), /Choose a clear/);
  const tiny = await sharp({ create: { width: 30, height: 30, channels: 3, background: "white" } }).png().toBuffer();
  await assert.rejects(normalizePhoto(tiny), /Choose a clear/);
});
test("photo normalization bounds dimensions and strips embedded metadata", async () => {
  const input = await sharp({ create: { width: 2000, height: 3000, channels: 3, background: "white" } }).withMetadata({ exif: { IFD0: { Artist: "private" } } }).png().toBuffer();
  const output = await sharp(await normalizePhoto(input)).metadata();
  assert.equal(output.height, 1536); assert.equal(output.format, "jpeg"); assert.equal(output.exif, undefined);
});
test("provider URL boundary rejects local addresses and hostname impersonation", () => {
  assert.match(trustedProviderUrl("https://yce-us.s3-accelerate.amazonaws.com/result.jpg"), /^https:/);
  for (const value of ["http://yce-us.s3-accelerate.amazonaws.com/a", "https://localhost/a", "https://127.0.0.1/a", "https://amazonaws.com.attacker.example/a", "https://key@bucket.amazonaws.com/a"]) assert.throws(() => trustedProviderUrl(value));
});
test("consent and catalog are validated before any API access", async () => {
  const form = new FormData(); form.set("itemId", "navy"); form.set("sampleId", "alex");
  await assert.rejects(startPreview(id, form), /permission/);
  form.set("consent", "true"); form.set("itemId", "invented");
  await assert.rejects(startPreview(id, form), /Choose a garment/);
});
test("a task is invisible outside its owning workspace", async () => {
  await mutateWorkspace(id, state => { state.tasks["private-task"] = { id: "private-task", status: "completed", createdAt: Date.now(), itemId: "navy", fingerprint: "private", resultUrl: "https://yce-us.s3-accelerate.amazonaws.com/a" }; });
  await assert.rejects(getPreview(otherId, "private-task"), /not in your demo session/);
  assert.equal((await getPreview(id, "private-task")).status, "completed");
});
test("session limits reject new live jobs without charging the global budget", async () => {
  await mutateWorkspace(id, state => { state.renderCount = SESSION_RENDER_LIMIT; });
  const form = new FormData(); form.set("itemId", "navy"); form.set("sampleId", "alex"); form.set("consent", "true"); form.set("live", "true");
  await assert.rejects(startPreview(id, form), /8 live previews/);
  assert.equal((await readWorkspace("00000000-0000-4000-8000-000000000000")).renderCount, 0);
});
test("YouCam adapter sends outer layering and handles observed v2 response envelope", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.YOUCAM_API_KEY;
  process.env.YOUCAM_API_KEY = "test-secret-never-exposed";
  const paths: string[] = [];
  globalThis.fetch = async (url, options) => {
    const target = String(url); paths.push(target);
    if (target.endsWith("/file")) return Response.json({ status: 200, data: { files: ["source", "reference"].map(file_id => ({file_id,requests:[{url:`https://bucket.amazonaws.com/${file_id}`,method:"PUT",headers:{"Content-Type":"image/jpeg"}}]})) } });
    if (target.startsWith("https://bucket.amazonaws.com")) { assert.equal(new Headers(options?.headers).has("Authorization"), false); return new Response(null, { status: 200 }); }
    if (options?.method === "POST") {
      const body = JSON.parse(String(options.body));
      assert.equal(body.garment_category, "outer"); assert.equal(body.filter_multi_person, "strict"); assert.equal(body.change_shoes, false);
      return Response.json({ status: 200, data: { task_id: "provider-task" } });
    }
    return Response.json({ status: 200, data: { task_status: "success", results: { url: "https://bucket.amazonaws.com/result" } } });
  };
  try {
    assert.equal(await createYoucamTask(Buffer.from("a"), Buffer.from("b")), "provider-task");
    assert.equal((await checkYoucamTask("provider-task")).status, "completed");
    assert.equal(paths.length, 5);
  } finally { globalThis.fetch = originalFetch; if (originalKey) process.env.YOUCAM_API_KEY = originalKey; else delete process.env.YOUCAM_API_KEY; }
});

test("inherited object property names are not preview tasks", async () => {
  for (const name of ["toString", "__proto__", "constructor"]) await assert.rejects(getPreview(otherId, name), /not in your demo session/);
});
