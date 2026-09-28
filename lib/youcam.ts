import sharp from "sharp";

const API = "https://yce-api-01.makeupar.com/s2s/v2.0";
export class TryonError extends Error {
  constructor(message: string, public status = 502) { super(message); }
}
export async function normalizePhoto(input: Buffer): Promise<Buffer> {
  try {
    const image = sharp(input, { limitInputPixels: 32_000_000, animated: false });
    const metadata = await image.metadata();
    if (!["jpeg", "png", "webp"].includes(metadata.format || "") || !metadata.width || !metadata.height || metadata.width < 256 || metadata.height < 256) {
      throw new Error("invalid image");
    }
    return await image.rotate().resize({ width: 1536, height: 1536, fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 88 }).toBuffer();
  } catch {
    throw new TryonError("Choose a clear JPG, PNG or WebP photo at least 256 pixels on each side.", 400);
  }
}

async function api(path: string, body?: unknown) {
  if (!process.env.YOUCAM_API_KEY) throw new TryonError("Live previews are temporarily unavailable. You can still explore the sample looks and pickup desk.", 503);
  const response = await fetch(`${API}${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${process.env.YOUCAM_API_KEY}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(25_000), cache: "no-store",
  });
  if (!response.ok) {
    if (response.status === 429) throw new TryonError("YouCam is busy. Please wait a moment before trying again.", 429);
    throw new TryonError("YouCam could not complete that request. Please try again in a moment.");
  }
  return response.json();
}

export function trustedProviderUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password ||
      !(url.hostname.endsWith(".amazonaws.com") || url.hostname.endsWith(".makeupar.com") || url.hostname.endsWith(".perfectcorp.com"))) {
    throw new TryonError("YouCam returned an unsupported image location.");
  }
  return url.toString();
}

export async function createYoucamTask(source: Buffer, garment: Buffer): Promise<string> {
  const response = await api("/file", { files: [source, garment].map((bytes, index) => ({
    content_type: "image/jpeg", file_name: index ? "garment.jpg" : "source.jpg", file_size: bytes.length,
  })) });
  const files = response.data?.files;
  if (!Array.isArray(files) || files.length !== 2) throw new TryonError("YouCam could not prepare the images.");
  await Promise.all(files.map(async (file, index) => {
    if (!file.file_id || !Array.isArray(file.requests) || !file.requests.length) throw new TryonError("YouCam could not prepare the images.");
    for (const request of file.requests) {
      if (request.method !== "PUT") throw new TryonError("YouCam returned an unsupported upload method.");
      const upload = await fetch(trustedProviderUrl(request.url), {
        method: "PUT", headers: request.headers, body: new Uint8Array(index ? garment : source),
        signal: AbortSignal.timeout(25_000), redirect: "error",
      });
      if (!upload.ok) throw new TryonError("The image upload did not finish. Please try again.");
    }
  }));
  const task = await api("/task/cloth-v4", {
    src_file_id: files[0].file_id, ref_file_id: files[1].file_id,
    garment_category: "outer", change_shoes: false, filter_multi_person: "strict",
  });
  if (typeof task.data?.task_id !== "string") throw new TryonError("YouCam did not return a preview task.");
  return task.data.task_id;
}

export async function checkYoucamTask(id: string): Promise<{status: "processing" | "completed" | "failed"; resultUrl?: string; error?: string}> {
  const response = await api(`/task/cloth-v4/${encodeURIComponent(id)}`);
  const data = response.data;
  if (data?.task_status === "success" && typeof data.results?.url === "string") {
    return { status: "completed", resultUrl: trustedProviderUrl(data.results.url) };
  }
  if (data?.task_status === "error") {
    const photoError = ["error_no_face", "error_pose", "error_face_parsing", "error_decode_image"].includes(data.error);
    return { status: "failed", error: photoError ? "YouCam could not read this pose. Use one person standing front-on, with their face and body visible." : "YouCam could not create this preview. Please try a different photo or garment." };
  }
  return { status: "processing" };
}
