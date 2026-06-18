# Adrián & Alexandra — Wedding Gallery (MVP)

This is a mobile-first, elegant gallery for guests to share and enjoy photos from Adrián & Alexandra's wedding. The site is static and ready for GitHub Pages; image storage and uploads are handled via Google Drive + Google Apps Script (sample included).

Files of interest:

- [index.html](index.html) — main entry
- [styles.css](styles.css) — design system and layout
- `scripts/` — modular ES modules (`app.js`, `gallery.js`, `uploader.js`, `utils.js`)
- `assets/` — placeholder images and decorative assets
- `google-apps-script/upload.gs` — sample Apps Script endpoint (needs deployment)


Quick start (local preview):

1. Open `index.html` in a browser (or use a small static server).

2. To enable real uploads:
   - Create a Google Apps Script web app (see `google-apps-script/upload.gs`).
   - Deploy as a Web App and set "Who has access" appropriately for your privacy needs.
   - Update `scripts/app.js` constants `APPS_SCRIPT_UPLOAD_URL` and `GALLERY_API_URL` with your endpoints.

Notes on Apps Script integration:

- The example script expects a POST with a file field named `file` and returns JSON with minimal metadata: `{ id, src, alt, caption }`.
- Serving images from Google Drive to a public gallery may require making files viewable via link and ensuring the returned `src` is embeddable in an <img> tag.
- If you prefer stricter controls, deploy the Web App with restricted access and route uploads through a simple authenticated proxy.
- This gallery is for photos only. Accepted formats are JPG, JPEG, PNG, WEBP, HEIC and HEIF. Videos are not supported to keep uploads fast and reliable for guests.

Design
- The visual language (fonts, colors, spacing) follows the invitation site to feel like a natural companion experience. Use the Playfair Display for headings and Inter for body.

Accessibility
- Focus outlines are preserved, form controls are labelled, and live regions are used for feedback.

Next steps (suggested):

- Implement server-side moderation or auto-moderation for images.
- Connect the gallery endpoint to list images from Drive metadata.
- Add pagination and lazy-loading for performance.
 - Add pagination and lazy-loading for performance.
 - Images are resized in the browser before upload (max width 2048px, JPEG 85%) to reduce upload time and storage usage. See `scripts/utils.js` for the implementation.
 - EXIF orientation is handled client-side for JPEG images so iPhone photos display and upload with the correct rotation. The orientation-aware resizing and thumbnail generation live in `scripts/utils.js`.
 - For HEIC and some vendor-specific formats, browsers vary in how they expose orientation metadata; the app attempts best-effort handling and falls back gracefully.
