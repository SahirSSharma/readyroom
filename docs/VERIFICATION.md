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

Public deployment and video verification will be appended after publication. Contest submission is not verified until a Devpost receipt exists.
