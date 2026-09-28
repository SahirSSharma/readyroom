import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { checkYoucamTask, createYoucamTask, normalizePhoto, TryonError } from "../lib/youcam";

type Sample = {
  sample: string;
  garment: string;
  sourcePath: string;
  garmentPath: string;
  resultPath: string;
  sourceSha256: string;
  garmentSha256: string;
  uploadedSourceSha256: string;
  uploadedGarmentSha256: string;
  taskId?: string;
  startedAt: string;
  completedObservedAt?: string;
  elapsedMs?: number;
  resultSha256?: string;
  resultBytes?: number;
  resultWidth?: number;
  resultHeight?: number;
  state: "processing" | "completed" | "failed";
  error?: string;
  observationNote?: string;
};

const outputDir = "public/assets/previews";
const manifestPath = path.join(outputDir, "manifest.json");
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const samples: Sample[] = [];
let saveQueue = Promise.resolve();

function save() {
  const content = JSON.stringify({
    provider: "YouCam API", endpoint: "cloth-v4", garmentCategory: "outer",
    inputs: "Generated fictional adult models and unbranded demonstration garments",
    estimatedUnitsPerTask: 2, billingVerified: false, samples,
  }, null, 2) + "\n";
  saveQueue = saveQueue.then(async () => {
    await fs.writeFile(manifestPath + ".tmp", content);
    await fs.rename(manifestPath + ".tmp", manifestPath);
  });
  return saveQueue;
}

async function inputs(sample: string, garment: string) {
  const sourcePath = `public/assets/model-${sample}.png`;
  const garmentPath = `public/assets/garment-${garment}.png`;
  const [sourceOriginal, garmentOriginal] = await Promise.all([fs.readFile(sourcePath), fs.readFile(garmentPath)]);
  const [source, clothing] = await Promise.all([normalizePhoto(sourceOriginal), normalizePhoto(garmentOriginal)]);
  return { sourcePath, garmentPath, sourceOriginal, garmentOriginal, source, clothing };
}

async function recordResult(entry: Sample, bytes: Buffer) {
  const metadata = await sharp(bytes).metadata();
  if (metadata.format !== "jpeg") throw new Error("Expected a JPEG provider result");
  await fs.writeFile(entry.resultPath, bytes);
  entry.state = "completed";
  entry.completedObservedAt = new Date().toISOString();
  entry.elapsedMs = Date.parse(entry.completedObservedAt) - Date.parse(entry.startedAt);
  entry.resultSha256 = hash(bytes);
  entry.resultBytes = bytes.length;
  entry.resultWidth = metadata.width;
  entry.resultHeight = metadata.height;
  await save();
}

async function generate(sample: string, garment: string) {
  let entry = samples.find((item) => item.sample === sample && item.garment === garment);
  if (entry?.state === "completed") {
    if (hash(await fs.readFile(entry.resultPath)) !== entry.resultSha256) throw new Error("Saved result hash mismatch");
    console.log(`${sample}-${garment}: existing verified result`);
    return;
  }
  if (entry?.state === "failed") {
    console.log(`${sample}-${garment}: prior failure retained; no automatic paid retry`);
    return;
  }
  const data = await inputs(sample, garment);
  if (!entry) {
    entry = {
      sample, garment, sourcePath: data.sourcePath, garmentPath: data.garmentPath,
      resultPath: `${outputDir}/${sample}-${garment}.jpg`,
      sourceSha256: hash(data.sourceOriginal), garmentSha256: hash(data.garmentOriginal),
      uploadedSourceSha256: hash(data.source), uploadedGarmentSha256: hash(data.clothing),
      startedAt: new Date().toISOString(), state: "processing",
    };
    samples.push(entry);
    await save();
  }
  try {
    if (!entry.taskId) {
      entry.taskId = await createYoucamTask(data.source, data.clothing);
      await save();
    }
    console.log(`${sample}-${garment}: task running`);
    for (let attempt = 0; attempt < 60; attempt++) {
      await pause(10_000);
      const status = await checkYoucamTask(entry.taskId);
      if (status.status === "failed") throw new TryonError(status.error || "Provider task failed.");
      if (status.status === "completed" && status.resultUrl) {
        const response = await fetch(status.resultUrl, { signal: AbortSignal.timeout(25_000), redirect: "error" });
        if (!response.ok) throw new Error("Result download failed");
        await recordResult(entry, Buffer.from(await response.arrayBuffer()));
        console.log(`${sample}-${garment}: completed in ${(entry.elapsedMs! / 1000).toFixed(1)} seconds`);
        return;
      }
    }
    throw new TryonError("Task remained processing after ten minutes of polling.");
  } catch (error) {
    entry.state = "failed";
    entry.error = error instanceof TryonError ? error.message : "Network or local file step failed.";
    await save();
    console.log(`${sample}-${garment}: FAILED — ${entry.error}`);
  }
}

async function main() {
  process.loadEnvFile(".env.local");
  if (!process.env.YOUCAM_API_KEY) throw new Error("YOUCAM_API_KEY is required in .env.local");
  await fs.mkdir(outputDir, { recursive: true });
  try {
    samples.push(...JSON.parse(await fs.readFile(manifestPath, "utf8")).samples);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const first = JSON.parse(await fs.readFile("work/evidence/first-task.json", "utf8"));
    const firstResult = JSON.parse(await fs.readFile("work/evidence/first-result.json", "utf8"));
    if (firstResult.data?.task_status !== "success") throw new Error("First sample lacks a successful provider response");
    const data = await inputs("alex", "navy");
    const source = await sharp(data.sourceOriginal).resize({ height: 1536, withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer();
    const clothing = await sharp(data.garmentOriginal).resize({ width: 1536, withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer();
    const completedAt = (await fs.stat("work/evidence/first-result.json")).mtime.toISOString();
    const entry: Sample = {
      sample: "alex", garment: "navy", sourcePath: data.sourcePath, garmentPath: data.garmentPath,
      resultPath: `${outputDir}/alex-navy.jpg`, sourceSha256: hash(data.sourceOriginal),
      garmentSha256: hash(data.garmentOriginal), uploadedSourceSha256: hash(source), uploadedGarmentSha256: hash(clothing),
      taskId: first.task.data.task_id, startedAt: first.createdAt, state: "processing",
      observationNote: "Imported from the initial live probe; completion time is the saved successful response file modification time, not exact provider completion time.",
    };
    samples.push(entry);
    await recordResult(entry, await fs.readFile(entry.resultPath));
    entry.completedObservedAt = completedAt;
    entry.elapsedMs = Date.parse(completedAt) - Date.parse(entry.startedAt);
    await save();
  }
  const queue = ["alex", "jordan"].flatMap((sample) => ["navy", "charcoal", "sand", "olive", "plaid", "black"].map((garment) => ({ sample, garment })));
  await Promise.all([0, 1].map(async () => {
    while (queue.length) {
      const next = queue.shift()!;
      await generate(next.sample, next.garment);
    }
  }));
  const completed = samples.filter((entry) => entry.state === "completed").length;
  console.log(`${completed}/12 sample previews complete; ledger: ${manifestPath}`);
  if (completed !== 12) process.exitCode = 1;
}

main().catch(() => { console.error("Sample generation stopped; inspect the credential-free manifest for progress."); process.exitCode = 1; });
