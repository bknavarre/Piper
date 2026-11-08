# Cloud photo sync
Cloudinary cloud: `zb8g2chy`
Unsigned preset: `piper_recipe_photos`
Folder: `piper/recipe-photos`

Copy Me That photos are compressed by Piper, uploaded to Cloudinary, and the returned HTTPS URL is stored with the recipe in Firestore. Re-import the same ZIP to repair existing recipes whose photos are currently local-only; matching titles reuse the existing recipe ID.
