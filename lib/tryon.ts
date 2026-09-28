import { createHash, randomUUID } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { findGarment } from "./catalog";
import { mutateWorkspace, readWorkspace } from "./store";
import { checkYoucamTask, createYoucamTask, normalizePhoto, TryonError } from "./youcam";

export type PreviewTask = {
  id: string; status: "processing" | "completed" | "failed"; createdAt: number; checkedAt?: number;
  itemId: string; fingerprint: string; upstreamId?: string; resultUrl?: string; error?: string;
};
const GLOBAL_BUDGET_ID = "00000000-0000-4000-8000-000000000000";
export const SESSION_RENDER_LIMIT = 8;
export const GLOBAL_RENDER_LIMIT = 200;
const DAY = 86_400_000;

export function taskView(task: PreviewTask) {
  return { taskId: task.id, status: task.status, source: "live", elapsedSeconds: Math.floor((Date.now() - task.createdAt) / 1000),
    ...(task.status === "completed" ? { imageUrl: `/api/tryon/${task.id}/image` } : {}),
    ...(task.error ? { error: task.error } : {}),
  };
}
export async function startPreview(workspaceId: string, form: FormData) {
  if (form.get("consent") !== "true") throw new TryonError("Please confirm you have permission to use this photo and send it to YouCam.", 400);
  const item = findGarment(String(form.get("itemId") || ""));
  if (!item) throw new TryonError("Choose a garment from the rack.", 400);
  const sample = form.get("sampleId");
  const upload = form.get("image");
  if (sample && sample !== "alex" && sample !== "jordan") throw new TryonError("Choose a sample portrait from the fitting room.", 400);
  if ((!sample && !(upload instanceof File)) || (sample && upload instanceof File)) throw new TryonError("Choose one photo or sample portrait.", 400);
  if (sample && form.get("live") !== "true") {
    const savedPath = `/assets/previews/${sample}-${item.id}.jpg`;
    if (await stat(path.join(process.cwd(), "public", savedPath)).then(() => true, () => false)) {
      return { taskId: `saved-${sample}-${item.id}`, status: "completed", imageUrl: savedPath, source: "saved" };
    }
  }
  if (upload instanceof File && (upload.size > 4 * 1024 * 1024 || upload.size === 0)) throw new TryonError("Choose a photo smaller than 4 MB.", 400);
  const source = await normalizePhoto(sample ? await readFile(path.join(process.cwd(), `public/assets/model-${sample}.png`)) : Buffer.from(await (upload as File).arrayBuffer()));
  const reference = await normalizePhoto(await readFile(path.join(process.cwd(), "public", item.image)));
  const fingerprint = createHash("sha256").update(source).update(item.id).digest("hex");
  const newTask: PreviewTask = { id: randomUUID(), status: "processing", createdAt: Date.now(), itemId: item.id, fingerprint };
  const reservation = await mutateWorkspace(workspaceId, (workspace) => {
    for (const [id, raw] of Object.entries(workspace.tasks)) {
      const task = raw as PreviewTask;
      if (Date.now() - task.createdAt > DAY) delete workspace.tasks[id];
    }
    const matching = Object.values(workspace.tasks).map(t => t as PreviewTask).find(t => t.fingerprint === fingerprint && t.status !== "failed" && Date.now() - t.createdAt < 60 * 60 * 1000);
    if (matching) return { task: matching, fresh: false };
    if (workspace.renderCount >= SESSION_RENDER_LIMIT) throw new TryonError("You have used this session’s 8 live previews. The saved sample looks and pickup desk remain available.", 429);
    if (Object.values(workspace.tasks).some(t => (t as PreviewTask).status === "processing" && Date.now() - (t as PreviewTask).createdAt < 5 * 60_000)) throw new TryonError("Your preview is still being prepared. Please wait for it to finish.", 409);
    workspace.renderCount++;
    workspace.tasks[newTask.id] = newTask;
    return { task: newTask, fresh: true };
  });
  if (!reservation.fresh) return taskView(reservation.task);
  try {
    await mutateWorkspace(GLOBAL_BUDGET_ID, workspace => {
      if (workspace.renderCount >= GLOBAL_RENDER_LIMIT) throw new TryonError("The public demo’s live preview allowance has been used. Saved sample looks and the pickup desk are still available.", 429);
      workspace.renderCount++;
    });
    const upstreamId = await createYoucamTask(source, reference);
    await mutateWorkspace(workspaceId, workspace => {
      const task = workspace.tasks[newTask.id] as PreviewTask;
      task.upstreamId = upstreamId;
    });
    return taskView(newTask);
  } catch (error) {
    const message = error instanceof TryonError ? error.message : "The preview connection was interrupted. Please try again.";
    await mutateWorkspace(workspaceId, workspace => {
      const task = workspace.tasks[newTask.id] as PreviewTask;
      task.status = "failed"; task.error = message;
    });
    throw error instanceof TryonError ? error : new TryonError(message);
  }
}

export async function getPreview(workspaceId: string, taskId: string) {
  const workspace = await readWorkspace(workspaceId);
  const task = Object.hasOwn(workspace.tasks, taskId) ? workspace.tasks[taskId] as PreviewTask : undefined;
  if (!task) throw new TryonError("This preview is not in your demo session.", 404);
  if (Date.now() - task.createdAt > DAY) throw new TryonError("This preview has expired. Create a new one from the fitting room.", 410);
  if (task.status !== "processing") return task;
  if (Date.now() - task.createdAt > 5 * 60_000) {
    task.status = "failed"; task.error = "This preview took too long. Please try again.";
  } else if (task.upstreamId && (!task.checkedAt || Date.now() - task.checkedAt >= 9000)) {
    Object.assign(task, await checkYoucamTask(task.upstreamId), { checkedAt: Date.now() });
  } else return task;
  return mutateWorkspace(workspaceId, state => {
    const current = state.tasks[taskId] as PreviewTask;
    if (current.status !== "processing") return current;
    state.tasks[taskId] = task;
    return task;
  });
}
