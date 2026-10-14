export {
  configureStoryData,
  getStoryDataConfig,
  type StoryDataAuthContext,
  type StoryDataConfig,
} from "./config.js";
export {
  isNotFound,
  StoryDataAuthError,
  StoryDataConflictError,
  StoryDataError,
} from "./errors.js";
export { request, type AuthMode, type RequestOptions } from "./request.js";

export type { Character, CharacterRelationship } from "./types/ICharacter.js";
export type { Comment } from "./types/IComment.js";
export type {
  GuestbookDate,
  IGuestbookEntry,
} from "./types/IGuestbookEntry.js";
export type { IGuestbookReply } from "./types/IGuestbookReply.js";
export type { Place } from "./types/IPlace.js";
export type {
  EventDependency,
  PacingType,
  PlotEvent,
  PlotLine,
  StoryBeatType,
  TimeConstraint,
} from "./types/IPlot.js";
export type { IReadingProgress } from "./types/IReadingProgress.js";
export type {
  Chapter,
  ChapterSummary,
  CompletionStatus,
  ILikes,
  ParagraphStyle,
  ReaderUpdate,
  Story,
  StoryMetadata,
} from "./types/IStory.js";

export {
  guestbookRepo,
  type GuestbookReplyPage,
} from "./repos/GuestbookRepo.js";
export {
  assistantThreadRepo,
  AssistantThreadRepo,
  type AssistantMessage,
  type AssistantMessagePage,
  type AssistantMessageStatus,
  type AssistantThread,
  type AssistantThreadPage,
} from "./repos/AssistantThreadRepo.js";
export {
  PEOPLE_PAGE_SIZE,
  profileRepo,
  type ProfileUpdate,
  type PublicProfile,
  type RecentFollower,
} from "./repos/ProfileRepo.js";
export {
  publicStoryRepo,
  type PublicStoryAuthor,
  type PublicStoryPage,
} from "./repos/PublicStoryRepo.js";
export { readingHistoryRepo } from "./repos/ReadingHistoryRepo.js";
export {
  storySocialRepo,
  type StorySocialMe,
  type StorySocialSummary,
} from "./repos/StorySocialRepo.js";
export {
  storyWorkspaceRepo,
  StoryWorkspaceRepo,
  type OwnerStoryPage,
} from "./repos/StoryWorkspaceRepo.js";
export {
  storyWorldbuildingRepo,
  StoryWorldbuildingRepo,
} from "./repos/StoryWorldbuildingRepo.js";
