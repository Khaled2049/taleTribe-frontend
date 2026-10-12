import {
  connectFirestoreEmulator,
  initializeFirestore,
} from "firebase/firestore";
import { getPlatformAuth, connectEmulatorOnce } from "./firebase.js";
const { app, options } = getPlatformAuth();
export const firestore = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
});
if (options.emulators?.firestore) {
  const { host, port } = options.emulators.firestore;
  connectEmulatorOnce("firestore", () =>
    connectFirestoreEmulator(firestore, host, port),
  );
}
