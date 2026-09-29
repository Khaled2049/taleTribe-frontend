import { connectStorageEmulator, getStorage } from "firebase/storage";
import { app, connectEmulatorOnce } from "./firebase";

export const storage = getStorage(app);

connectEmulatorOnce("storage", () =>
  connectStorageEmulator(storage, "127.0.0.1", 9199),
);
