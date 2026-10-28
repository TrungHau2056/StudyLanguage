import { FirebaseError, initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider, getAuth, getRedirectResult, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut, type User,
} from 'firebase/auth';
import {
  Timestamp, collection, deleteDoc, doc, getDoc, getDocs, initializeFirestore, persistentLocalCache, setDoc, writeBatch,
} from 'firebase/firestore';

/** Web config from the Firebase console (not secret). Without it the app runs local-only. */
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const cloudEnabled = Boolean(config.apiKey && config.projectId);

const app = cloudEnabled ? initializeApp(config) : undefined;
const auth = app && getAuth(app);
// Offline cache: reviews made without network are queued and uploaded later.
const firestore = app && initializeFirestore(app, { localCache: persistentLocalCache() });

export function watchUser(cb: (user: User | null) => void) {
  if (!auth) return () => {};
  getRedirectResult(auth).catch(console.error); // completes a redirect sign-in started below
  return onAuthStateChanged(auth, cb);
}

/**
 * Popup sign-in; when the app runs installed on the home screen (iOS) popups can be blocked,
 * so fall back to a full-page redirect.
 */
export async function signInWithGoogle() {
  if (!auth) return;
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    const code = e instanceof FirebaseError ? e.code : '';
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment' || code === 'auth/web-storage-unsupported') {
      await signInWithRedirect(auth, provider);
    } else if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') throw e;
  }
}

export async function signOutUser() {
  if (auth) await signOut(auth);
}

/** Firestore returns Timestamps where we stored Dates; convert them back recursively (one level is enough here). */
function revive<T>(data: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) out[k] = v instanceof Timestamp ? v.toDate() : v;
  return out as T;
}

// Firestore rejects `undefined` fields (e.g. a new card's last_review).
const clean = (o: object) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

export async function pushDoc(uid: string, path: string[], data: object) {
  if (!firestore) return;
  await setDoc(doc(firestore, 'users', uid, ...path), clean(data));
}

export async function removeDoc(uid: string, path: string[]) {
  if (!firestore) return;
  await deleteDoc(doc(firestore, 'users', uid, ...path));
}

export async function pullCollection<T>(uid: string, name: string): Promise<T[]> {
  if (!firestore) return [];
  const snap = await getDocs(collection(firestore, 'users', uid, name));
  return snap.docs.map((d) => revive<T>(d.data()));
}

export async function pullProfile<T>(uid: string): Promise<T | undefined> {
  if (!firestore) return undefined;
  const snap = await getDoc(doc(firestore, 'users', uid));
  return snap.exists() ? (snap.data() as T) : undefined;
}

export async function pushProfile(uid: string, data: object) {
  if (!firestore) return;
  await setDoc(doc(firestore, 'users', uid), clean(data), { merge: true });
}

/** Upload many docs, in Firestore's 500-writes-per-batch chunks. */
export async function pushMany(uid: string, name: string, items: { id: string; data: object }[]) {
  if (!firestore) return;
  for (let i = 0; i < items.length; i += 500) {
    const batch = writeBatch(firestore);
    for (const it of items.slice(i, i + 500)) batch.set(doc(firestore, 'users', uid, name, it.id), clean(it.data));
    await batch.commit();
  }
}
