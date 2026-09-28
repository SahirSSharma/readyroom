# Verification evidence

September 27, 2026. All checks below were executed against the implementation, not inferred from code.

- Unit suite: 18 tests passed, covering simultaneous holds, expiry, pickup and return, signed-cookie tampering, origin boundaries, workspace isolation, photo validation and metadata stripping, task ownership, preview budget, and provider request format.
- TypeScript and production Next.js build passed.
- Runtime dependencies: npm audit reported zero vulnerabilities.
- Real private Blob check: six simultaneous first-time holds produced exactly one winner. Five concurrent counter increments preserved every update.
- A larger-state regression (4,096-byte task payload) preserved all five concurrent increments and the original task field. Reproducible with `npx tsx scripts/verify-live-storage.ts`; this opt-in script creates and deletes only its own random test fixture.
- HTTP integration against the production build: six concurrent holds yielded one 201 and five 409 responses; collection, duplicate rejection, return, release, and refresh persistence passed. Different sessions could not alter each other's reservations.
- Same-origin HTTP requests were accepted; absent, foreign, and misleading normalized origins were rejected. Next's internal localhost normalization is handled using the external Host.
- Saved preview bytes matched the checked-in result. One fresh Jordan/olive request returned a real YouCam result; repeat input reused its existing task. A different session received 404 for both the task and its image. The result was a 148,195-byte JPEG, 1024×1536, SHA-256 `10d88c3ce32eecfc9b6ccfc10afb53028ffaa9e1dfa413a508bb07ee72b34b69`.
- Testing revealed that compressed Blob GETs yield weak ETags, which fail conditional updates once state crosses the compression threshold. Requesting the identity representation restored strong ETags. The same previously blocked task then completed without creating a second provider job.
- Browser checks exercised a saved preview, hold, collection, and return through actual controls. Portrait framing was corrected. Layout was inspected at 390px and 2000px; no horizontal overflow was observed. Mobile completion announcement and automatic result scrolling were added.
- Generated sample output inspection and provenance are recorded separately in [API-EVIDENCE.md](API-EVIDENCE.md). These checks do not measure user impact or fit accuracy.

Public deployment evidence follows. Contest submission is not complete: the signed-in Devpost project manager was checked again after publication and still states that submissions begin September 29 at 12:00 p.m. EDT. No submission form or receipt is available.

## Public deployment

`https://readyroom-youcam.vercel.app`, deployed from commit `9b76d53`, passed anonymous HTTP and actual browser checks on September 27, 2026. The public GitHub repository likewise returned 200 without authentication.

A real 1,780,353-byte PNG upload (the generated Jordan sample, sent through the file-upload branch, not `sampleId`) with the charcoal garment completed in 13 seconds. Task `97c2bc4e-39ef-424b-bd6d-7d93f8dad7dc` returned a 147,809-byte 1024×1536 JPEG, SHA-256 `e71c58d451b0a4ea2306fa84bbf4821d91e7562f81d642aef5681b1b79b8cf2b`. Its headers were `private, no-store`. Other-session access returned 404; unauthenticated access returned 401.

Four concurrent deployed reservation attempts produced 201, 409, 409, 409. Collection and return persisted; duplicate collection returned 409. A second browser session retained its untouched rack. Exactly one live job was used by that deployed API check.

A separate browser demonstration on the public site generated a fresh Alex/navy preview (task `c00108b7-0e21-480f-8450-d3678428a686`) and displayed its live badge and before/after comparison. Video frames are captured from the actual interface, not reconstructed UI.

## Provider account

The YouCam usage dashboard was refreshed after both public-deployment checks. It recorded 15 Clothes V4 calls at two units each, 1,000 redeemed promotional units, and 40 first-key free units: **1,010 units remained**. No paid credit purchase or automatic recharge was enabled. This is a dated balance, not a guarantee of later availability.

## Video artifact

The completed English demonstration is 117.598 seconds, 1920×1080 at 30 fps, H.264 with AAC audio. Its 5,185,749-byte source file has SHA-256 `e3f5b63957af146e3760ac9132947e513748cb83cd172f5475d9457e7c80b3e7`. Full decode and scene-frame inspection passed. This is an edited walkthrough of actual public-app captures, with synthesized narration and a visible processing-time-shortened label.

YouTube Studio confirmed **Video published** on September 27, 2026: [public demonstration](https://youtu.be/1m99EJVRicA). A separate signed-out browser displayed the correct title and played the video; the media element advanced to 9.66 seconds with readyState 4 and no playback error. YouTube reported no copyright issues at publication.

English captions were uploaded from the exact narration in 36 cues. YouTube Studio read back **English (video language) — Published Sep 27, 2026**, and caption text appeared in the signed-out player. Timing is approximate within measured scene/audio spans; cues are ordered, nonoverlapping, and end before the video does.
