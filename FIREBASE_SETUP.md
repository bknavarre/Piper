# Firebase deployment notes

Already configured in `src/firebase.ts` for project `piper-app-4e58f`.

1. Firebase Authentication: Email/Password enabled.
2. Authentication > Settings > Authorized domains: add `bknavarre.github.io`.
3. Firestore Database > Rules: publish `firestore.rules`.
4. To sync imported recipe photos, enable Firebase Storage and publish `storage.rules` in Storage > Rules.
5. Without Storage, Copy Me That recipes still import; signed-in imports omit photos that fail Storage upload so the Firestore kitchen document stays below size limits.

The current visual pages and workflows are preserved. New UI appears only in the existing Account & Sync card and migration/import modals.
