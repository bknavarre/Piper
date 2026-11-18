
// ─── Admins (must match isAdmin() in firestore.rules) ───
export const ADMIN_EMAILS = ['bknavarre@gmail.com'];
export const isAdminEmail = (email?: string | null) =>
  !!email && ADMIN_EMAILS.includes(email.trim().toLowerCase());
