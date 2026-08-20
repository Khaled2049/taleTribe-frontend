import { useSyncExternalStore } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";

export interface AuthIdentity {
  uid: string | null;
  email: string | null;
  isAdmin: boolean;
  /** True until the first auth callback resolves — not "a request is running". */
  loading: boolean;
  isSignedIn: boolean;
}

const SIGNED_OUT: AuthIdentity = {
  uid: null,
  email: null,
  isAdmin: false,
  loading: false,
  isSignedIn: false,
};

/**
 * Deliberately not a zustand store. The Firebase SDK is already the single
 * source of truth for identity, so mirroring it into a second store would give
 * a federated remote two things to disagree about. `useSyncExternalStore` reads
 * the SDK directly, and the cached snapshot below is what keeps the reference
 * stable between renders.
 */
let snapshot: AuthIdentity = { ...SIGNED_OUT, loading: true };
const listeners = new Set<() => void>();

function publish(next: AuthIdentity) {
  if (
    next.uid === snapshot.uid &&
    next.email === snapshot.email &&
    next.isAdmin === snapshot.isAdmin &&
    next.loading === snapshot.loading
  ) {
    return;
  }
  snapshot = next;
  listeners.forEach((listener) => listener());
}

let unsubscribe: (() => void) | null = null;

function start() {
  unsubscribe = onAuthStateChanged(auth, (user) => {
    if (!user) {
      publish(SIGNED_OUT);
      return;
    }
    // Claims need a token round-trip, so identity lands in two steps. Publishing
    // the uid first keeps `loading` short for the 60%+ of callers that only
    // want the uid; isAdmin follows a tick later.
    publish({
      uid: user.uid,
      email: user.email,
      isAdmin: snapshot.uid === user.uid ? snapshot.isAdmin : false,
      loading: false,
      isSignedIn: true,
    });
    user
      .getIdTokenResult()
      .then((result) => {
        if (auth.currentUser?.uid !== user.uid) return;
        publish({ ...snapshot, isAdmin: result.claims["admin"] === true });
      })
      .catch(() => {
        /* A failed claims read leaves isAdmin false, which is the safe default. */
      });
  });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!unsubscribe) start();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  };
}

const getSnapshot = () => snapshot;

/**
 * Identity only — uid, email, admin claim. Anything that needs the user's
 * profile (username, bio, follow graph) wants the app's `useAuthContext`
 * instead; keeping those apart is what lets this package stay free of
 * story-data and React Query.
 */
export function useAuthIdentity(): AuthIdentity {
  return useSyncExternalStore(subscribe, getSnapshot);
}
