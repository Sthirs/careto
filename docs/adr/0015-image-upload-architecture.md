# ADR-0015: Image upload architecture — DB-resident data URLs, multer+sharp, replace-only

- **Status:** 🟢 accepted
- **Date:** 2026-08-24
- **Deciders:** Backend team, Frontend team

## Context

The specification ([`docs/specifications.md`](../specifications.md) §Features) requires:

- Shopping list images: "A list has a name and an image that can be updated by its members."
- User profile pictures: shown in place of the initials avatar when set, uploaded or changed from the account screen using the device's standard file picker (gallery, camera, or other sources).

Constraints from existing ADRs:

- ADR-0004: PostgreSQL with TypeORM synchronize (no migrations) — schema changes via entity edits
- ADR-0003: Backend stack — Node, TypeScript, Express 5, TypeORM, REST API
- ADR-0005: JWT local auth + OIDC PKCE — auth context available on all protected routes
- ADR-0013: Global API rate limiting with express-rate-limit — upload endpoints inherit protection

Forces:

- Simplicity: avoid object storage (S3, GCS, Azure Blob) and CDN complexity
- Portability: data URLs embed in JSON responses and work offline with the PWA
- Security: validate MIME type and size server-side; normalize to strip EXIF/metadata
- Replace-only semantics for shopping list images: no versioning, no gallery
- Consistency: same pipeline for shopping list images and user profile pictures

## Decision

We will implement image uploads for both shopping lists and user profiles using a unified architecture:

1. **Storage**: base64 data URLs stored directly in the database
   - `ShoppingList.imageUrl` (`shopping_lists.image_url`, `text`, nullable) stores `data:image/webp;base64,...`
   - `User.imageUrl` (`users.image_url`, `text`, nullable), same format

2. **Upload pipeline** (shared `middleware/upload.ts` + `services/imageService.ts`):
   - `multer` with `memoryStorage` (no temp files)
   - File filter: accept `image/jpeg`, `image/png`, `image/webp` only
   - Size limit: 5 MB (enforced by multer `limits.fileSize`)
   - `sharp` normalization pipeline:
     - Auto-rotate from EXIF orientation
     - Strip all metadata (EXIF, ICC profile, XMP)
     - Resize to fit inside 512×512 (preserving aspect ratio, never enlarging) — sufficient for avatars and list thumbnails
     - Convert to WebP, quality 80
     - Output buffer → base64 data URL

3. **Endpoints**:
   - `POST /api/lists/:id/image` — `multipart/form-data` field `image`; returns `{ shoppingList }` with the new `imageUrl`; requires membership
   - `POST /api/auth/me/image` — `multipart/form-data` field `image`; returns `{ user }` with the new `imageUrl`
   - `DELETE /api/auth/me/image` — clears the profile picture
   - Errors: 400 when no file is attached, 415 for an unsupported type, 422 when the file cannot be decoded, 404 when the list is not found or the caller is not a member, 401 per ADR-0005

4. **Frontend integration**:
   - Account screen: file picker (`<input type="file" accept="image/jpeg,image/png,image/webp">`) with upload state
   - Shopping list settings: same `useImageUpload` composable reused
   - Display: `<img :src="entity.imageUrl" />` with fallback to initials

5. **Schema**: TypeORM `synchronize: true` (ADR-0004) handles column changes on backend restart.

## Alternatives considered

- **Alternative A: Object storage (S3-compatible) + signed URLs**
  - Pros: Scales to large files, CDN integration, separates blob storage from DB
  - Cons: Infrastructure complexity (bucket, IAM, CDN, signed URL rotation), additional latency, not portable, overkill for small thumbnails
  - Rejected: zero-infrastructure blob handling is preferred at this scale

- **Alternative B: Store binary in `bytea` column, serve via dedicated `/api/blob/:id` endpoint**
  - Pros: Smaller DB size (no base64 overhead), streaming responses
  - Cons: Extra endpoint, cache headers complexity, cannot embed in JSON responses, PWA offline harder
  - Rejected: data URLs embed in API responses natively

- **Alternative C: External image proxy (e.g., imgix, Cloudinary) with upload widget**
  - Pros: Transformations on-demand, CDN, face-detection cropping
  - Cons: Vendor lock-in, cost, external dependency, over-engineered for thumbnails
  - Rejected: Not aligned with the self-hosted, cloud-native Helm deployment model (ADR-0006)

- **Alternative D: Version history for images**
  - Pros: User control, audit trail
  - Cons: Adds API surface, UI complexity, storage growth
  - Rejected: YAGNI — the spec only requires updating the image

## Sources / Prior art

- [`docs/specifications.md`](../specifications.md) §Features — product requirements
- ADR-0004 — PostgreSQL + TypeORM synchronize (schema change mechanism)
- ADR-0003 — Express 5 + TypeORM backend stack
- ADR-0005 — Authentication context on protected routes
- ADR-0013 — Rate limiting inherited by new endpoints
- `sharp` documentation: <https://sharp.pixelplumbing.com/> — normalization pipeline
- `multer` documentation: <https://github.com/expressjs/multer> — multipart handling
- OWASP File Upload Cheat Sheet: <https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html> — validation best practices

## Consequences

- Positive:
  - Zero infrastructure dependencies beyond PostgreSQL
  - Single unified pipeline for shopping list and user images
  - Data URLs embed directly in API responses — no extra round-trip for the frontend
  - PWA offline works naturally (images travel with entity data)
  - `sharp` normalization strips privacy-sensitive metadata automatically

- Negative / trade-offs:
  - Base64 overhead: ~33% size increase in DB and on the wire (mitigated by the 512px cap and WebP compression)
  - Every list response carries every member's and the list's image, which grows payloads as lists gain members
  - No CDN caching — images are served inline with entity data
  - Not suitable for large images or gallery use cases — by design

- Follow-ups:
  - A follow-up ADR on database storage quotas / per-user image size limits if abuse is observed
  - A follow-up ADR on CDN / object storage migration if scale demands it
  - Dish images (spec §Dishes) are expected to reuse this pipeline
