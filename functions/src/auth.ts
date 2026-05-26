import { CallableRequest, HttpsError } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions/v2'

// Allowlist of UIDs permitted to call any AI feature in this project.
// This is a single-tenant personal app — strangers signing in with Google
// would otherwise burn Anthropic tokens against the owner's bill.
//
// UIDs are stable, exact-match identifiers issued by Firebase Auth on first
// sign-in; immune to email casing, scope, or provider quirks. To grant a new
// user, add their UID here AND mirror it in firestore.rules's isOwner().
const ALLOWED_UIDS = new Set<string>([
  'AIQaz8Iafob2TeMk1ebMSfcp1mA2',
])

// Throws if the request is unauthenticated or the UID isn't on the allowlist.
// Call this at the top of every callable before doing any work that could
// cost money or expose data.
//
// The `asserts` return signature narrows request.auth to non-null in callers
// after a successful return, so they can safely access request.auth.uid.
export function requireAllowedUser(
  request: CallableRequest,
): asserts request is CallableRequest & { auth: NonNullable<CallableRequest['auth']> } {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in required.')
  }
  // TEMP diagnostic: dump the actual token claims so we can compare what the
  // function sees against what the Firebase Auth Users tab says. Remove once
  // we've confirmed the UID check is working.
  const token = request.auth.token as Record<string, unknown> | undefined
  const firebaseClaim = token?.firebase as { sign_in_provider?: string } | undefined
  logger.info('auth-check', {
    uid: request.auth.uid,
    email: token?.email ?? null,
    emailVerified: token?.email_verified ?? null,
    provider: firebaseClaim?.sign_in_provider ?? null,
  })
  if (!ALLOWED_UIDS.has(request.auth.uid)) {
    throw new HttpsError('permission-denied', 'This account is not authorised.')
  }
}
