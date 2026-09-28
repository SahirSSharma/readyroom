# Readyroom — submission draft

Status: preparation in progress, September 27, 2026. Registration is complete, 1,000 promotional API credits were redeemed, and the first live Clothes V4 preview succeeded. The final project has not been submitted. Deployed-app behavior, public repository access, and a published video must each be verified before those claims are entered in Devpost.

## Project name

Readyroom

## Short description

Preview an interview blazer over the outfit you already own, then hold that exact piece for pickup.

## Inspiration

For someone assembling an interview outfit, the missing piece might be a single blazer. A donated-clothing closet can offer that piece, but a flat garment photo leaves a practical question unanswered: how might it look with the clothes someone already has?

Readyroom explores that decision without losing sight of the physical item. The preview, source garment, illustrative measurements, availability, and pickup pass belong to one continuous journey.

## What it does

Choose a sample person or a photograph you have permission to use. Inspect one of six sample blazers, consent to photo processing, and request a YouCam outerwear preview. Built-in samples can show clearly labeled saved YouCam results; a separate live request exercises the provider. Compare the garment with the generated image, then hold the item for a demonstration pickup.

Each browser session has an isolated sample closet. Holds expire after 15 minutes. The pickup desk can release a hold, mark an item collected, and return it to availability. Those operations update durable state and enforce one active reservation per item within the session.

The inventory, people, measurements, condition descriptions, and pickups are fictional demonstrations. Readyroom has no university affiliation, donated stock, confirmed closet partner, or completed field pilot. Previews are visual suggestions, not physical-fit or garment-condition guarantees.

## How it is built

The web app uses Next.js, React, and TypeScript. The preview integration uses Perfect Corp's YouCam Clothes V4 API with the `outer` garment category. Its asynchronous flow registers image files, starts an outerwear task, and polls the real task status. API credentials stay on the server; a clear consent action precedes processing. A failed provider request remains a visible error. Saved examples are labeled separately, and live attempts are limited to eight per session and 200 across the public deployment.

Private Vercel Blob stores session-scoped state. Fresh reads and ETag-conditional writes prevent simultaneous requests from silently overwriting each other. Signed, expiring HttpOnly cookies identify the current workspace. Reservation writes check the request origin, and the pickup desk cannot operate on another workspace's reservation.

The sample rack and generated fictional people are documented in [ASSET-LICENSES.md](ASSET-LICENSES.md). Source code has an MIT license.

## What is distinctive

Readyroom connects a visualization to a specific item and a working pickup process. The garment remains inspectable, a preview does not silently hold inventory, and a reservation is checked atomically when requested. The isolated demonstration lets a judge exercise that complete journey without using a personal photograph or interfering with another judge's session.

## Engineering challenges and verified evidence

- **Concurrent reservations:** twelve local attempts to hold one item produced exactly one successful reservation. Six simultaneous first-time holds against the private Blob store likewise produced one winner and five conflicts.
- **State transitions:** tests cover expiry at the exact deadline, duplicate collection rejection, return to availability, and a collected item's persistence after its original hold deadline.
- **Isolation and request boundaries:** tests reject altered session signatures, cross-origin writes, invalid workspace paths, and attempts to modify another workspace's reservation.
- **Provider-storage behavior:** a live test found that one Blob contention response was surfaced as a generic error rather than the SDK's dedicated precondition error. Bounded retry handling was adjusted for that observed response. Five concurrent live counter increments then persisted without losing an unrelated task field.
- **YouCam feasibility:** the first real Clothes V4 outerwear task, using the fictional Alex portrait and navy blazer, returned `task_status: success` on September 27, 2026. Its recorded submission and successful status responses are preserved as internal evidence. Further sample-result inspection and deployed route verification remain separate checks.

These are engineering checks, not evidence of user impact. No student study, demand estimate, conversion improvement, or deployment availability is claimed by this draft. A successful preview task is also not evidence of guaranteed garment fidelity or physical fit.

## What we learned

A useful garment preview needs a clear path back to the exact source item. Availability also needs its own guarantees: generating an image and reserving an item are different operations, and a good-looking result cannot compensate for a duplicated pickup promise.

## Next steps

Evaluate garment fidelity and the decision flow with people who opt in. Establish an authorized closet pilot before introducing real inventory. Add the staff, operations, privacy, and access controls a real shared service requires. These are proposed next steps, not existing partnerships or completed research.

## Judge testing instructions

1. Open the verified deployment URL in a fresh browser session. No signup is required.
2. Choose a built-in sample person and a garment; inspect the source and illustrative measurements.
3. Accept the processing consent and inspect a saved sample if offered. Then explicitly request a fresh live preview. Wait for the actual provider result; note any error without substituting a cached image.
4. Choose a demonstration pickup day and hold the garment. Confirm the pickup pass and item status.
5. Open Pickup desk, collect the reservation, then return the item. Confirm it becomes available again.
6. Optionally hold another item and release it. A second private-browsing session should start with its own untouched rack.

## Links to verify before submitting

| Required artifact | Current status |
| --- | --- |
| Working app | Target: `https://readyroom-youcam.vercel.app`; live availability pending verification. |
| Complete source repository and license | Local source and MIT license prepared; public repository URL/access pending verification. |
| Public 1–3 minute YouTube/Vimeo video | Script prepared; recording, publication, and anonymous access pending verification. |
| Free judge access | Designed for no-signup access; deployed access and credit headroom pending verification. |
| Final Devpost submission | Not submitted; no receipt exists in this document. |

## Timing and eligibility note

The [official rules](https://youcam-api-skin-ai-ecommerce.devpost.com/rules) open submissions on **September 29, 2026, at 9:00 a.m. Pacific**, and close them on **November 2, 2026, at 8:45 a.m. Pacific**. Development began September 27 at the entrant's direction. The rules require substantial in-period updates for a project begun earlier; document those changes truthfully if the project proceeds to submission. Do not represent this September 27 build as work begun during the submission period, or claim final eligibility before the applicable requirements are satisfied. No continuation is scheduled by this document.
