import api, { getApiErrorMessage } from "./index";

export async function reserveStorageUpload(): Promise<void> {
  try {
    await api.post("/reserveStorageUpload", {});
  } catch (error) {
    throw new Error(
      getApiErrorMessage(
        error,
        "Daily image upload limit reached. Try again tomorrow.",
      ),
    );
  }
}
