import type { storageService } from "@/services/StorageService";

/**
 * Firebase Storage is only needed once an image is uploaded, so the editor
 * loads it then instead of with the chapter.
 */
export const loadStorageService = (): Promise<typeof storageService> =>
  import("@/services/StorageService").then((m) => m.storageService);
