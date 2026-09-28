# Readyroom — submission draft

Status: September 27, 2026. Readyroom is built and publicly deployed, and its complete source repository is accessible without signing in. Registration is complete and 1,000 promotional API units were redeemed. The 1 minute 58 second English demonstration video is published on YouTube; signed-out playback was verified. The final project has not been submitted.

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

- **Build and tests:** all 18 unit tests, TypeScript checks, and the production build passed. Tests cover concurrent holds, expiry, pickup and return, session signatures, request origins, workspace isolation, photo validation, metadata stripping, task ownership, preview budgets, and the provider request format.
- **Durable inventory:** six simultaneous first-time holds against the private Blob store produced one winner. Four concurrent reservation attempts on the public deployment produced one success and three conflicts. Collection and return persisted; duplicate collection was rejected.
- **Storage correctness:** testing exposed weak ETags on compressed responses. Requesting the identity representation restored conditional writes. A larger-state regression preserved all five concurrent increments and the original task field.
- **Live YouCam integration:** the public site generated and displayed a fresh Alex/navy preview through its actual browser controls. A separate real PNG upload of the fictional Jordan portrait with the charcoal blazer completed in 13 seconds. Its result was a 1024×1536 JPEG served with private, no-store headers. Another session could access neither the task nor its image.
- **Public access and interface:** the app and source repository were verified without authentication. Browser checks exercised preview comparison, hold, collection, and return. Layouts were inspected at 390px and 2000px without horizontal overflow. The video uses captures of the actual interface.

The detailed record is in [VERIFICATION.md](VERIFICATION.md). These are engineering checks, not evidence of user impact. No student study, demand estimate, or conversion improvement is claimed. A successful preview task does not establish garment fidelity or physical fit.

## What we learned

A useful garment preview needs a clear path back to the exact source item. Availability also needs its own guarantees: generating an image and reserving an item are different operations, and a good-looking result cannot compensate for a duplicated pickup promise.

## Next steps

Evaluate garment fidelity and the decision flow with people who opt in. Establish an authorized closet pilot before introducing real inventory. Add the staff, operations, privacy, and access controls a real shared service requires. These are proposed next steps, not existing partnerships or completed research.

## Judge testing instructions

1. Open [Readyroom](https://readyroom-youcam.vercel.app) in a fresh browser session. No signup is required.
2. Choose a built-in sample person and a garment; inspect the source and illustrative measurements.
3. Accept the processing consent and inspect a saved sample if offered. Then explicitly request a fresh live preview. Wait for the actual provider result; note any error without substituting a cached image.
4. Choose a demonstration pickup day and hold the garment. Confirm the pickup pass and item status.
5. Open Pickup desk, collect the reservation, then return the item. Confirm it becomes available again.
6. Optionally hold another item and release it. A second private-browsing session should start with its own untouched rack.

## Submission artifacts

| Required artifact | Current status |
| --- | --- |
| Working app | [Readyroom](https://readyroom-youcam.vercel.app) — anonymous access and deployed workflow verified. |
| Complete source repository and license | [GitHub repository](https://github.com/SahirSSharma/readyroom) — public access verified; source, setup instructions, and MIT license included. |
| Public 1–3 minute YouTube/Vimeo video | [Public demonstration video](https://youtu.be/1m99EJVRicA) — 117.598 seconds, 1080p, actual edited app captures with synthesized English narration. Published September 27 with English captions; signed-out playback verified. |
| Free judge access | No signup or payment required; verified on the public deployment. Saved YouCam examples remain available; fresh attempts are bounded to preserve promotional units. |
| Final Devpost submission | Not submitted; no receipt exists in this document. |

## Timing and eligibility note

The [official rules](https://youcam-api-skin-ai-ecommerce.devpost.com/rules) open submissions on **September 29, 2026, at 9:00 a.m. Pacific**, and close them on **November 2, 2026, at 8:45 a.m. Pacific**. Development began September 27 at the entrant's direction. The rules require substantial in-period updates for a project begun earlier; document those changes truthfully if the project proceeds to submission. Do not represent this September 27 build as work begun during the submission period, or claim final eligibility before the applicable requirements are satisfied. No continuation is scheduled by this document.
