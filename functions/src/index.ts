import { setGlobalOptions } from "firebase-functions/v2";
import * as admin from "firebase-admin";

setGlobalOptions({
  maxInstances: 5,
  memory: "512MiB",
  timeoutSeconds: 540, // Increased for async operations
});

admin.initializeApp();

// Export new agent endpoints
export { summarizeChapter } from "./endpoints/summarizeChapter";
export { brainstormIdeas } from "./endpoints/brainstormIdeas";
export { generateNextLines } from "./endpoints/generateNextLines";
export { generateStoryChoices } from "./endpoints/generateStoryChoices";
export { searchBooks } from "./endpoints/searchBooks";
export { generateCoverImage } from "./endpoints/generateCoverImage";
export { sendChatMessage } from "./endpoints/sendChatMessage";
export { clearChatSession } from "./endpoints/clearChatSession";
export { enhanceText } from "./endpoints/enhanceText";
export { enhanceWizardInput } from "./endpoints/enhanceWizardInput";
export { onInviteApproved } from "./endpoints/onInviteApproved";
export {
  saveAiSettings,
  deleteAiSettings,
  validateAiKey,
} from "./endpoints/aiSettingsEndpoints";
export { reserveStorageUpload } from "./endpoints/storageUploadEndpoints";
export { getCreditBalance, purchaseCredits } from "./endpoints/creditEndpoints";
