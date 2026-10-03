export interface IClub {
  id: string;
  name: string;
  description: string;
  image: string;
  members: string[];
  category: string;
  activity: string;
  creatorId: string;
  bookOfTheMonth?: IBookOfTheMonth;
  discussions?: IDiscussion[];
  meetUp?: string;
  readingSchedule?: IReadingSchedule;
  discussionPrompts?: IDiscussionPrompt[];
  polls?: IPoll[];
}

/**
 * One row of the club directory, as `GET /v1/book-clubs?view=summary` serves
 * it. `meetUp` is carried for the edit form, which must send the current value
 * back because PATCH replaces every field.
 */
export interface IClubSummary {
  id: string;
  name: string;
  description: string;
  image: string;
  category: string;
  activity: string;
  creatorId: string;
  memberCount: number;
  meetUp?: string;
}

export interface IReadingSchedule {
  startDate: string; // ISO date string
  pacing: {
    type: "chapters-per-week" | "chapters-per-days" | "custom";
    value: number; // e.g., 2 chapters per week, or 3 days per chapter
  };
  chapters: IChapterSchedule[];
  totalChapters?: number; // Total chapters in the book
}

export interface IChapterSchedule {
  chapterNumber: number;
  chapterTitle?: string;
  scheduledDate: string; // ISO date string
  isCompleted?: boolean;
}

export interface IDiscussionPrompt {
  id: string;
  chapterNumber: number;
  question: string;
  description?: string;
  createdAt: string; // ISO date string
  creatorId: string;
  responses?: IPromptResponse[];
  /** @deprecated No longer written — spoiler-blur now compares chapterNumber against the viewer's memberProgress. Kept so old docs typecheck. */
  unlockedFor?: string[];
}

export interface IPromptResponse {
  id: string;
  userId: string;
  username?: string;
  content: string;
  createdAt: string; // ISO date string
}

export interface IPoll {
  id: string;
  type: "book-selection" | "meetup" | "topic" | "other";
  question: string;
  options: IPollOption[];
  votes: Record<string, number>; // userId -> optionIndex
  createdAt: string; // ISO date string
  endDate?: string; // ISO date string
  creatorId: string;
  isActive: boolean;
}

export interface IPollOption {
  text: string;
  bookData?: IBookOfTheMonth; // For book-selection polls
}

export interface IReadingProgress {
  userId: string;
  username?: string;
  currentChapter: number;
  lastUpdated: string; // ISO date string
  notes?: string;
}

export interface ISpoilerTag {
  content: string;
  chapterRange: {
    start: number;
    end?: number; // Optional end chapter
  };
}

export interface IDiscussion {
  id: string;
  title: string;
  content: string;
  creatorId: string;
  comments: IComment[];
  date: string;
}

export interface IComment {
  id: string;
  content: string;
  creatorId: string;
}

export interface IBookOfTheMonth {
  id: string;
  /** Where the book comes from. Legacy docs have no value — treat as "google". */
  source?: "google" | "novelsync";
  /** Set when source === "novelsync"; links to /story/:storyId */
  storyId?: string;
  /** Chapter count snapshot (from Story.chapterCount) used to prefill schedules */
  totalChapters?: number;
  volumeInfo: {
    title: string;
    authors?: string[];
    description?: string;
    imageLinks?: {
      thumbnail: string;
    };
  };
}

export interface IBookClub {
  club: IClub;
}
