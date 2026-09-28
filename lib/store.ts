import { BlobError, BlobPreconditionFailedError, get, put } from "@vercel/blob";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Reservation } from "./catalog";

export type Workspace = {
  id: string;
  version: 1;
  reservations: Reservation[];
  renderCount: number;
  tasks: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export class StoreError extends Error {
  constructor(message: string, public status = 503) { super(message); }
}

export function validWorkspaceId(id: string) {
  return /^(?:[a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/.test(id);
}

function initialWorkspace(id: string): Workspace {
  const now = new Date().toISOString();
  return { id, version: 1, reservations: [], renderCount: 0, tasks: {}, createdAt: now, updatedAt: now };
}

function workspacePath(id: string) {
  if (!validWorkspaceId(id)) throw new StoreError("Invalid demonstration session.", 401);
  return `readyroom/workspaces/${id}.json`;
}

function useBlob() {
  if (process.env.STORE_FORCE_LOCAL === "true" && process.env.NODE_ENV !== "production") return false;
  const configured = Boolean(process.env.BLOB_READ_WRITE_TOKEN ||
    (process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN));
  if (!configured && process.env.NODE_ENV === "production") {
    throw new StoreError("The demonstration closet is temporarily unavailable.");
  }
  return configured;
}

function parseWorkspace(text: string, id: string): Workspace {
  const value = JSON.parse(text) as Workspace;
  if (value.id !== id || value.version !== 1 || !Array.isArray(value.reservations) ||
      typeof value.renderCount !== "number" || !value.tasks || typeof value.tasks !== "object") {
    throw new StoreError("The demonstration closet could not be read.");
  }
  return value;
}

async function readBlob(id: string) {
  // Compression turns the response ETag into a weak validator, which cannot
  // be used for a conditional write. Read the original representation.
  const response = await get(workspacePath(id), {
    access: "private", useCache: false, headers: { "Accept-Encoding": "identity" },
  });
  if (!response) return null;
  if (response.statusCode !== 200) throw new StoreError("The demonstration closet could not be read.");
  return {
    workspace: parseWorkspace(await new Response(response.stream).text(), id),
    etag: response.blob.etag,
  };
}

function localPath(id: string) {
  workspacePath(id);
  return path.join(process.env.STORE_LOCAL_DIR || path.join(process.cwd(), ".local", "workspaces"), `${id}.json`);
}

async function readLocal(id: string): Promise<Workspace> {
  try {
    return parseWorkspace(await readFile(localPath(id), "utf8"), id);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return initialWorkspace(id);
    throw error;
  }
}

const localState = globalThis as typeof globalThis & { readyroomLocalLocks?: Map<string, Promise<void>> };
const locks = localState.readyroomLocalLocks ??= new Map<string, Promise<void>>();

async function mutateLocal<T>(id: string, mutate: (workspace: Workspace) => T | Promise<T>) {
  const filename = localPath(id);
  const previous = locks.get(filename) ?? Promise.resolve();
  let unlock!: () => void;
  const current = new Promise<void>((resolve) => { unlock = resolve; });
  locks.set(filename, current);
  await previous;
  try {
    const workspace = await readLocal(id);
    const result = await mutate(workspace);
    workspace.updatedAt = new Date().toISOString();
    await mkdir(path.dirname(filename), { recursive: true });
    const temporary = `${filename}.${randomBytes(8).toString("hex")}.tmp`;
    await writeFile(temporary, JSON.stringify(workspace), { mode: 0o600 });
    await rename(temporary, filename);
    return result;
  } finally {
    unlock();
    if (locks.get(filename) === current) locks.delete(filename);
  }
}

export async function readWorkspace(id: string): Promise<Workspace> {
  workspacePath(id);
  if (!useBlob()) return readLocal(id);
  return (await readBlob(id))?.workspace ?? initialWorkspace(id);
}

// The callback may run again after a conflicting write. Keep external API calls outside it.
export async function mutateWorkspace<T>(id: string, mutate: (workspace: Workspace) => T | Promise<T>): Promise<T> {
  workspacePath(id);
  if (!useBlob()) return mutateLocal(id, mutate);
  for (let attempt = 0; attempt < 6; attempt++) {
    const current = await readBlob(id);
    const workspace = current?.workspace ?? initialWorkspace(id);
    const result = await mutate(workspace);
    workspace.updatedAt = new Date().toISOString();
    try {
      await put(workspacePath(id), JSON.stringify(workspace), {
        access: "private", addRandomSuffix: false, contentType: "application/json",
        ...(current ? { ifMatch: current.etag } : { allowOverwrite: false }),
      });
      return result;
    } catch (error) {
      // The SDK reports an existing pathname as a generic error during first creation.
      // A fresh read distinguishes that race from a failed initial write.
      const creationRace = !current && await readBlob(id);
      // Blob can also surface an origin write collision as a generic bad-request error.
      const originConflict = error instanceof BlobError &&
        error.message.includes("The conditional request cannot succeed due to a conflicting operation");
      if (!(error instanceof BlobPreconditionFailedError) && !originConflict && !creationRace) throw error;
      if (attempt < 5) await new Promise((resolve) => setTimeout(resolve, 20 * (attempt + 1)));
    }
  }
  throw new StoreError("The closet changed while saving. Please try again.", 409);
}
