import { connectStorageEmulator, getStorage } from "firebase/storage";
import { getPlatformAuth, connectEmulatorOnce } from "./firebase.js";
const { app, options } = getPlatformAuth();
export const storage = getStorage(app);
if (options.emulators?.storage) {
  const { host, port } = options.emulators.storage;
  connectEmulatorOnce("storage", () =>
    connectStorageEmulator(storage, host, port),
  );
}
