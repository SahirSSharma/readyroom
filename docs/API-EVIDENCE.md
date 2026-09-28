# Readyroom live YouCam evidence

Recorded September 27, 2026 (Pacific); API ledger timestamps use September 28, 2026 UTC.

## What was verified

Twelve real YouCam Clothes V4 tasks completed successfully: two generated fictional adult models, Alex and Jordan, each wearing six generated unbranded blazer references. The initial Alex/navy result was created by the live integration probe; the sample-generation script created the remaining eleven tasks. There were no failed tasks in this eleven-task batch, and no retries were needed.

All twelve provider JPEGs were downloaded unchanged and visually inspected individually. Every image is 1024 × 1536. The twelve files total 1,730,658 bytes. Source PNGs are documented in [ASSET-LICENSES.md](ASSET-LICENSES.md).

The complete machine-readable evidence is [public/assets/previews/manifest.json](../public/assets/previews/manifest.json). Each entry contains the provider task ID, original source and garment SHA-256 hashes, the uploaded JPEG hashes, start and observed completion timestamps, result path, result SHA-256 hash, byte count, dimensions, and terminal status. The manifest contains no API credential or signed provider URL.

These are cached outputs of real provider calls. Showing a cached sample in the interface must not claim that a new call just completed. The samples demonstrate this integration on twelve controlled combinations; they are not a user study, physical fit validation, or evidence of real closet inventory.

## Observed outputs

| Sample | Garment | Observed elapsed time | Visual inspection |
| --- | --- | ---: | --- |
| Alex | Navy | 20.1 seconds* | Navy outer layer, full body and base outfit recognizable. |
| Alex | Charcoal | 21.1 seconds | Charcoal outer layer; fabric has a slightly mottled appearance. |
| Alex | Sand | 21.2 seconds | Beige outer layer; generated silhouette is more fitted than the relaxed catalog description. |
| Alex | Olive | 20.8 seconds | Olive outer layer, shirt and trousers remain recognizable. |
| Alex | Plaid | 10.5 seconds | Gray plaid remains clearly visible. |
| Alex | Black | 10.5 seconds | Black outer layer, with visible lapels and pockets. |
| Jordan | Navy | 10.8 seconds | Navy outer layer; shirt collar is visibly raised/reshaped. |
| Jordan | Charcoal | 10.6 seconds | Charcoal outer layer; shirt collar is reshaped. |
| Jordan | Sand | 11.6 seconds | Beige outer layer; button placement differs from the reference. |
| Jordan | Olive | 11.5 seconds | Olive outer layer; shirt collar is visibly raised/reshaped. |
| Jordan | Plaid | 20.8 seconds | Gray plaid remains visible; local line distortion and collar changes are observable. |
| Jordan | Black | 20.8 seconds | Black outer layer; shirt collar is visibly raised/reshaped. |

*The initial probe's completion time is the modification timestamp of its saved successful provider response. Its start timestamp was recorded after task creation. It is not directly comparable to the batch timings.

For the eleven new tasks, observed elapsed time ranged from 10.510 to 21.154 seconds, with a median of 11.589 seconds. This includes upload/task creation, polling in ten-second intervals, result download, and local save. It is not exact model inference time or a latency guarantee.

Across all results, garment color and the plaid distinction were recognizable, and the person, trousers, shoes, and overall pose remained recognizable. The provider opened the jackets even though the garment references showed fastened fronts. Collar shape, button arrangement, fabric detail, and garment proportions changed. No obvious missing limbs, extra people, or severe face deformation were observed in this visual review. No quantitative identity-preservation or garment-fidelity score is claimed.

These findings support presenting a visual outfit preview with the source garment alongside it. They do not support claiming exact physical fit, exact construction, sizing accuracy, or pixel-identical preservation of the base outfit.

## Request path

The script uses the same provider functions as the application, exported by `lib/youcam.ts`:

1. `normalizePhoto` converts source and reference images to upload-ready JPEGs.
2. `createYoucamTask` calls `POST /s2s/v2.0/file`, uploads both files to the provider-issued locations, then calls `POST /s2s/v2.0/task/cloth-v4`.
3. Task parameters are `garment_category: "outer"`, `change_shoes: false`, and `filter_multi_person: "strict"`.
4. `checkYoucamTask` polls `GET /s2s/v2.0/task/cloth-v4/{task_id}`.
5. A successful result is fetched from the provider URL and saved as JPEG bytes without image editing or recompression.

The batch runs at most two tasks at once. Existing completed entries are hash-verified and skipped. An interrupted task with a recorded task ID is polled again instead of creating another one. Recorded failures are retained rather than automatically starting another chargeable task.

The expected budget is two units per Clothes V4 task: 22 additional units for this eleven-task batch, or 24 units including the initial probe. Actual account billing and remaining balance were not independently verified by this script; `billingVerified` is therefore `false` in the manifest.

## Reproduce and validate

Run from the repository root with `YOUCAM_API_KEY` set in the local, ignored `.env.local` file:

```sh
npx tsx scripts/generate-samples.ts
```

With the completed manifest present, this checks and skips all twelve existing outputs without creating another provider task. Do not delete the manifest to perform a routine check.

Validation performed:

- The generator completed with exit code zero and reported `12/12 sample previews complete`.
- A focused TypeScript check of `scripts/generate-samples.ts` and its imported provider module passed.
- All twelve source, garment, and result hashes in the manifest matched the files on disk.
- Every result was individually opened with the image viewer and visually inspected.
- The manifest and evidence document were checked for the actual local API key and signed-URL parameters; none were present.

This evidence covers the sample generation path. Application authorization, reservation concurrency, browser behavior, deployment, and competition submission require their own verification.
