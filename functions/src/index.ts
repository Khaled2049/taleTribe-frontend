import { setGlobalOptions } from "firebase-functions/v2";
import * as admin from "firebase-admin";

setGlobalOptions({
  maxInstances: 5,
  memory: "512MiB",
  timeoutSeconds: 540, // Increased for async operations
});

admin.initializeApp();

// Export new agent endpoints
export { generateChapter } from "./generateChapter";
export { generateChapterTask } from "./generateChapterTask";
export { summarizeChapter } from "./summarizeChapter";
export {
  brainstormIdeas,
  brainstormCharacter,
  brainstormPlot,
} from "./brainstormIdeas";
export {
  getJobStatus,
  getStoryJobsEndpoint as getStoryJobs,
} from "./jobEndpoints";
export { authenticate } from "./authenticate";
export { generateNextLines } from "./generateNextLines";
export { generateStoryChoices } from "./generateStoryChoices";
export { searchBooks, getBookDetails } from "./booksApi";
export { generateCoverImage } from "./generateCoverImage";
export { sendChatMessage } from "./sendChatMessage";
export { onChapterWrite } from "./chapterIndexTrigger";
export { onStoryWrite } from "./storyCountTrigger";
export { indexChapterTask } from "./indexChapterTask";
export { indexEntityTask } from "./indexEntityTask";
export {
  onCharacterWrite,
  onPlaceWrite,
  onPlotWrite,
} from "./entityIndexTrigger";
export {
  onCharacterCascade,
  onPlaceCascade,
} from "./entityCascadeTrigger";
export { clearChatSession } from "./clearChatSession";
export { enhanceText } from "./enhanceText";
export { enhanceWizardInput } from "./enhanceWizardInput";
export { onInviteApproved } from "./inviteService";
export { joinCompetition } from "./competitionEndpoints";
export { createUserByAdmin, setUserAdmin } from "./adminUserService";
export { createStoryByAdmin } from "./adminStoryEndpoint";
export {
  saveAiSettings,
  deleteAiSettings,
  validateAiKey,
} from "./aiSettingsEndpoints";
export { reserveStorageUpload } from "./storageUploadEndpoints";
export { getCreditBalance, purchaseCredits } from "./creditEndpoints";
