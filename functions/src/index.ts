import { setGlobalOptions } from "firebase-functions/v2";
import * as admin from "firebase-admin";

setGlobalOptions({
  maxInstances: 5,
  memory: "512MiB",
  timeoutSeconds: 540, // Increased for async operations
});

admin.initializeApp();

// Export new agent endpoints
export { summarizeChapter } from "./summarizeChapter";
export { brainstormIdeas } from "./brainstormIdeas";
export { generateNextLines } from "./generateNextLines";
export { generateStoryChoices } from "./generateStoryChoices";
export { searchBooks } from "./booksApi";
export { generateCoverImage } from "./generateCoverImage";
export { sendChatMessage } from "./sendChatMessage";
export { clearChatSession } from "./clearChatSession";
export { enhanceText } from "./enhanceText";
export { enhanceWizardInput } from "./enhanceWizardInput";
export { onInviteApproved } from "./inviteService";
export { createUserByAdmin, setUserAdmin } from "./adminUserService";
export {
  saveAiSettings,
  deleteAiSettings,
  validateAiKey,
} from "./aiSettingsEndpoints";
export { reserveStorageUpload } from "./storageUploadEndpoints";
export { getCreditBalance, purchaseCredits } from "./creditEndpoints";
