// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  initializeFirestore,
  connectFirestoreEmulator,
} from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import { connectAuthEmulator } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGE_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

export const firestore = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
});
export const storage = getStorage(app);
export const functions = getFunctions(app);

// Connect to emulators in development mode
if (
  import.meta.env.MODE === "development" &&
  import.meta.env.VITE_USE_EMULATORS !== "false"
) {
  // Use a flag to prevent double connection (e.g., during hot reload)
  const emulatorsConnected = (window as any).__FIREBASE_EMULATORS_CONNECTED__;

  if (!emulatorsConnected) {
    try {
      console.log("🔧 Connecting to Firebase Emulators...");

      // Connect Firestore emulator (configured in firebase.json)
      connectFirestoreEmulator(firestore, "127.0.0.1", 8080);

      // Connect Functions emulator (configured in firebase.json)
      connectFunctionsEmulator(functions, "127.0.0.1", 5001);

      // Connect Auth emulator (configured in firebase.json)
      connectAuthEmulator(auth, "http://127.0.0.1:9099", {
        disableWarnings: true,
      });

      // Connect Storage emulator (configured in firebase.json)
      connectStorageEmulator(storage, "127.0.0.1", 9199);

      (window as any).__FIREBASE_EMULATORS_CONNECTED__ = true;
      console.log("✅ Firebase Emulators connected successfully");
    } catch (error) {
      console.warn("⚠️ Failed to connect to Firebase Emulators:", error);
      console.warn("Make sure emulators are running: firebase emulators:start");
    }
  }
}
