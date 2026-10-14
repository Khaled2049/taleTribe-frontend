import { initializePlatformAuth } from "@novelsync/platform-auth/core";
initializePlatformAuth({
  firebase: {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGE_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  },
  platform: "web",
  emulators:
    import.meta.env.MODE === "development" &&
    import.meta.env.VITE_USE_EMULATORS !== "false"
      ? {
          authUrl: "http://127.0.0.1:9099",
          firestore: { host: "127.0.0.1", port: 8080 },
          storage: { host: "127.0.0.1", port: 9199 },
        }
      : undefined,
});
export * from "@novelsync/platform-auth/core";
