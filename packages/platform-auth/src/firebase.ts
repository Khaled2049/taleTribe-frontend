import { initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  connectAuthEmulator,
  getAuth,
  indexedDBLocalPersistence,
  initializeAuth,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGE_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const app = initializeApp(firebaseConfig);
// getAuth() also installs the popup/redirect resolver, whose start-up never
// settles inside the mobile app's embedded webview, so the first auth callback
// never fires. The app signs in with email and password only and needs none of it.
export const auth =
  import.meta.env.VITE_PLATFORM === "mobile"
    ? initializeAuth(app, {
        persistence: [indexedDBLocalPersistence, browserLocalPersistence],
      })
    : getAuth(app);

const usesEmulators =
  import.meta.env.MODE === "development" &&
  import.meta.env.VITE_USE_EMULATORS !== "false";

type EmulatorFlags = Window & {
  __FIREBASE_EMULATORS_CONNECTED__?: Record<string, boolean>;
};

export function connectEmulatorOnce(service: string, connect: () => void) {
  if (!usesEmulators) return;
  const flags = ((window as EmulatorFlags).__FIREBASE_EMULATORS_CONNECTED__ ??=
    {});
  if (flags[service]) return;
  try {
    connect();
    flags[service] = true;
  } catch (error) {
    console.warn(`⚠️ Failed to connect to the ${service} emulator:`, error);
    console.warn("Make sure emulators are running: firebase emulators:start");
  }
}

connectEmulatorOnce("auth", () =>
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true }),
);
