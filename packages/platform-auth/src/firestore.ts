import { connectFirestoreEmulator, initializeFirestore } from "firebase/firestore";
import { app, connectEmulatorOnce } from "./firebase";

export const firestore = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
});

connectEmulatorOnce("firestore", () =>
  connectFirestoreEmulator(firestore, "127.0.0.1", 8080),
);
