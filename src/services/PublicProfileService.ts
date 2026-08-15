import {
  DocumentData,
  QueryDocumentSnapshot,
  collection,
  doc,
  endAt,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  startAt,
} from "firebase/firestore";
import { firestore } from "@/config/firebase";
import { GuestbookPolicy } from "@/lib/guestbookPolicy";

/** Must stay at or below the `limit` ceiling the rules enforce on `list`. */
export const PEOPLE_PAGE_SIZE = 20;

export interface PublicProfile {
  username: string;
  /** Search key. Derived from `username` here — never accepted from a caller. */
  usernameLower: string;
  photoURL?: string;
  bio?: string;
  occupation?: string;
  location?: string;
  createdAt?: string;
  updatedAt: string;
  guestbookPolicy?: GuestbookPolicy;
}

export interface PublicProfileWithId extends PublicProfile {
  uid: string;
}

const toProfileWithId = (
  snapshot: QueryDocumentSnapshot<DocumentData>,
): PublicProfileWithId => ({
  ...(snapshot.data() as PublicProfile),
  uid: snapshot.id,
});

class PublicProfileService {
  async upsertPublicProfile(
    userId: string,
    data: {
      username: string;
      photoURL?: string;
      bio?: string;
      occupation?: string;
      location?: string;
      createdAt?: string;
    },
  ): Promise<void> {
    const profileRef = doc(firestore, "publicProfiles", userId);
    await setDoc(
      profileRef,
      {
        username: data.username,
        // Derived, never passed in: the rules require it to equal
        // username.lower(), so the search index cannot drift from the display
        // name. Every client write path funnels through here.
        usernameLower: data.username.trim().toLowerCase(),
        ...(data.photoURL ? { photoURL: data.photoURL } : {}),
        // !== undefined (not truthiness) so fields can be cleared to ""
        ...(data.bio !== undefined ? { bio: data.bio } : {}),
        ...(data.occupation !== undefined ? { occupation: data.occupation } : {}),
        ...(data.location !== undefined ? { location: data.location } : {}),
        ...(data.createdAt ? { createdAt: data.createdAt } : {}),
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
  }

  async getPublicProfile(userId: string): Promise<PublicProfile | null> {
    const profileRef = doc(firestore, "publicProfiles", userId);
    const profileSnap = await getDoc(profileRef);

    if (!profileSnap.exists()) {
      return null;
    }

    return profileSnap.data() as PublicProfile;
  }

  /**
   * Prefix search over usernames. `` is above every character usable in a
   * username (validation restricts them to `[a-zA-Z0-9_]`), so it closes the
   * range. Orders and filters on one field, which Firestore indexes
   * automatically — no firestore.indexes.json entry.
   */
  async searchByUsernamePrefix(
    prefix: string,
    max = PEOPLE_PAGE_SIZE,
  ): Promise<PublicProfileWithId[]> {
    const term = prefix.trim().toLowerCase();
    if (!term) return [];

    const snapshot = await getDocs(
      query(
        collection(firestore, "publicProfiles"),
        orderBy("usernameLower"),
        startAt(term),
        endAt(`${term}`),
        limit(Math.min(max, PEOPLE_PAGE_SIZE)),
      ),
    );
    return snapshot.docs.map(toProfileWithId);
  }

  /** The directory's resting state, before anything is typed. */
  async listRecent(max = PEOPLE_PAGE_SIZE): Promise<PublicProfileWithId[]> {
    const snapshot = await getDocs(
      query(
        collection(firestore, "publicProfiles"),
        orderBy("createdAt", "desc"),
        limit(Math.min(max, PEOPLE_PAGE_SIZE)),
      ),
    );
    return snapshot.docs.map(toProfileWithId);
  }

  /**
   * `username` and `usernameLower` ride along because the rules validate the
   * whole resulting document, not just the changed field.
   */
  async setGuestbookPolicy(
    userId: string,
    username: string,
    guestbookPolicy: GuestbookPolicy,
  ): Promise<void> {
    await setDoc(
      doc(firestore, "publicProfiles", userId),
      {
        username,
        usernameLower: username.trim().toLowerCase(),
        guestbookPolicy,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
  }

  async getPublicProfiles(userIds: string[]): Promise<Map<string, PublicProfile>> {
    const uniqueIds = [...new Set(userIds)].filter(Boolean);
    const profileMap = new Map<string, PublicProfile>();

    await Promise.all(
      uniqueIds.map(async (userId) => {
        const profile = await this.getPublicProfile(userId);
        if (profile) {
          profileMap.set(userId, profile);
        }
      }),
    );

    return profileMap;
  }
}

export const publicProfileService = new PublicProfileService();
