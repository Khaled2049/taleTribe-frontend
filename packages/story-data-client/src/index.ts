export {
  configureStoryData,
  getStoryDataConfig,
  type StoryDataAuthContext,
  type StoryDataConfig,
} from "./config";
export {
  isNotFound,
  StoryDataAuthError,
  StoryDataConflictError,
  StoryDataError,
} from "./errors";
export { request, type AuthMode, type RequestOptions } from "./request";

export type { Character, CharacterRelationship } from "./types/ICharacter";
export type { Comment } from "./types/IComment";
export type { GuestbookDate, IGuestbookEntry } from "./types/IGuestbookEntry";
export type { IGuestbookReply } from "./types/IGuestbookReply";
export type { Place } from "./types/IPlace";
export type {
  EventDependency,
  PacingType,
  PlotEvent,
  PlotLine,
  StoryBeatType,
  TimeConstraint,
} from "./types/IPlot";
export type { IReadingProgress } from "./types/IReadingProgress";
export type { Chapter, ILikes, Story, StoryMetadata } from "./types/IStory";

export { guestbookRepo } from "./repos/GuestbookRepo";
export { PEOPLE_PAGE_SIZE, profileRepo, type ProfileUpdate, type PublicProfile } from "./repos/ProfileRepo";
export { publicStoryRepo, type PublicStoryPage } from "./repos/PublicStoryRepo";
export { readingHistoryRepo } from "./repos/ReadingHistoryRepo";
export {
  storySocialRepo,
  type StorySocialMe,
  type StorySocialSummary,
} from "./repos/StorySocialRepo";
export { storyWorkspaceRepo, StoryWorkspaceRepo } from "./repos/StoryWorkspaceRepo";
export {
  storyWorldbuildingRepo,
  StoryWorldbuildingRepo,
} from "./repos/StoryWorldbuildingRepo";
