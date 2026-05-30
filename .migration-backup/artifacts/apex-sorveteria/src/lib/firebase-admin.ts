/**
 * Firebase Admin SDK — Server-side only
 *
 * The Admin SDK bypasses Firestore security rules and has full access.
 * Requires GOOGLE_APPLICATION_CREDENTIALS env var with service account key.
 * Falls back to Client SDK (src/lib/firebase.ts) for local dev without credentials.
 */

let _adminDb: import('firebase-admin/firestore').Firestore | null = null
let _adminInitAttempted = false

export async function getAdminDb() {
  if (_adminDb) return _adminDb
  if (_adminInitAttempted) return null
  _adminInitAttempted = true

  try {
    const admin = await import('firebase-admin/app')
    const { getFirestore } = await import('firebase-admin/firestore')

    if (admin.getApps().length === 0) {
      admin.initializeApp({
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      })
    }

    _adminDb = getFirestore()
    // Verify it works with a simple operation
    return _adminDb
  } catch {
    return null
  }
}

/**
 * Get the server-side Firestore instance.
 * Tries Admin SDK first (full access, bypasses rules).
 * Falls back to Client SDK if Admin SDK credentials aren't configured.
 */
export async function getServerDb() {
  const adminDb = await getAdminDb()
  if (adminDb) return adminDb

  // Fallback to Client SDK
  const { db } = await import('@/lib/firebase')
  return db
}
