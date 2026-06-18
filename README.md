# Adrián & Alexandra — Wedding Gallery

Mobile-first wedding gallery for guests to share and enjoy photos from Adrián & Alexandra's celebration. The site is static and hosted on GitHub Pages. Uploads and gallery metadata now flow through Supabase Edge Functions, Cloudflare R2, and Supabase PostgreSQL.

## Architecture

GitHub Pages
↓
Supabase Edge Functions
↓
Cloudflare R2
↓
Supabase PostgreSQL

## Files of Interest

- [index.html](index.html) — main entry
- [styles.css](styles.css) — design system and layout
- `scripts/` — frontend modules for app bootstrapping, upload, gallery rendering, utilities, and lightbox
- `supabase/functions/create-upload-url/` — creates presigned R2 upload URLs
- `supabase/functions/complete-upload/` — records uploaded media metadata in Supabase
- `assets/` — placeholder images and decorative assets

## Quick Start

1. Open `index.html` in a browser or serve the folder with any small static server.
2. Set `SUPABASE_PUBLISHABLE_KEY` in [scripts/app.js](scripts/app.js).
3. Deploy the Supabase Edge Functions:

```bash
supabase functions deploy create-upload-url --no-verify-jwt --use-api
supabase functions deploy complete-upload --no-verify-jwt --use-api
```

The upload flow is:

1. Request a presigned URL from `create-upload-url`.
2. Upload the file directly from the browser to Cloudflare R2.
3. Confirm the upload with `complete-upload` so metadata is inserted into `media`.
4. Refresh the gallery from Supabase.

## Media

The gallery reads from the `media` table using the Supabase publishable key. It displays the public R2 URL stored in `media.public_url`, which must be generated from `R2_PUBLIC_URL`.

Accepted upload formats are JPG, JPEG, PNG, WEBP, HEIC and HEIF. The gallery can render image and video rows from Supabase metadata.

## Accessibility

Focus outlines are preserved, form controls are labelled, and live regions are used for upload feedback.

## Next Steps

- Add moderation or review workflows for uploaded media.
- Add pagination and lazy loading for larger galleries.
- Add thumbnail generation for faster gallery rendering.
