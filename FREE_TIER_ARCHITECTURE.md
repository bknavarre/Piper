# Piper free-tier architecture

- Firebase Authentication: user identity.
- Firestore `users/{uid}/state/main`: preferences, Planner, Grocery, Pantry, onboarding, budget.
- Firestore `users/{uid}/recipes/{recipeId}`: one document per recipe; local base64 photos are removed before cloud writes.
- Firestore `users/{uid}/imports/{importId}`: import checkpoint and progress state.
- Copy Me That photos are resized to a maximum 640 px and JPEG quality 0.68, then retained on the importing device. They are not written to Firestore.
- If the user opens Piper on another device, recipe text and metadata sync; locally imported photos do not appear until optional OneDrive/Google Drive/Piper Cloud photo storage is implemented.
