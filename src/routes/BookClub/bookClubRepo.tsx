import { isNotFound, request } from "@novelsync/story-data-client";
import {
  IBookOfTheMonth,
  IClub,
  IDiscussionPrompt,
  IPoll,
  IPollOption,
  IReadingProgress,
  IReadingSchedule,
  IPromptResponse,
} from "@/types/IClub";

/**
 * The write body the API accepts for create and update. The server rejects
 * unknown fields outright, so an `IClub` cannot be sent as-is: `id`,
 * `creatorId` and `members` are all assigned server-side (from the new uuid,
 * the authenticated uid, and an owner membership row), and the nested
 * collections have their own endpoints.
 */
interface ClubInput {
  name: string;
  description: string;
  image: string;
  category: string;
  activity: string;
  meetUp: string;
}

export interface DiscussionPromptInput {
  chapterNumber: number;
  question: string;
  description: string;
}

export interface PromptResponseInput {
  content: string;
}

export interface PollInput {
  type: IPoll["type"];
  question: string;
  options: IPollOption[];
  endDate?: string;
}

export const clubInput = (club: IClub): ClubInput => ({
  name: club.name,
  description: club.description,
  image: club.image,
  category: club.category,
  activity: club.activity,
  meetUp: club.meetUp ?? "",
});

class BookClubRepo {
  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    required = false,
  ): Promise<T> {
    const result = await request<T>(path, {
      method,
      body,
      auth: required ? "required" : "optional",
      label: "Book club request",
    });
    if (method !== "GET") window.dispatchEvent(new Event("book-club-changed"));
    return result;
  }

  createBookClub(club: IClub): Promise<IClub> {
    return this.request<IClub>("POST", "/v1/book-clubs", clubInput(club), true);
  }
  getBookClubs(): Promise<IClub[]> {
    return this.request<IClub[]>("GET", "/v1/book-clubs");
  }
  getBookClub(id: string): Promise<IClub | undefined> {
    return this.request<IClub>("GET", `/v1/book-clubs/${id}`).catch((e) => {
      if (isNotFound(e)) return undefined;
      throw e;
    });
  }
  updateBookClub(id: string, club: IClub) {
    return this.request<IClub>(
      "PATCH",
      `/v1/book-clubs/${id}`,
      clubInput(club),
      true,
    );
  }
  updateMeetUp(id: string, meetUp: string) {
    return this.settings(id, { meetUp });
  }
  updateBookOfTheMonth(id: string, book: IBookOfTheMonth) {
    return this.settings(id, { bookOfTheMonth: book });
  }
  private settings(id: string, body: object) {
    return this.request<IClub>(
      "PATCH",
      `/v1/book-clubs/${id}/settings`,
      body,
      true,
    );
  }
  deleteBookClub(id: string) {
    return this.request<void>(
      "DELETE",
      `/v1/book-clubs/${id}`,
      undefined,
      true,
    );
  }
  joinBookClub(id: string, _userId: string) {
    return this.request<void>(
      "PUT",
      `/v1/book-clubs/${id}/members/me`,
      undefined,
      true,
    );
  }
  leaveBookClub(id: string, _userId: string) {
    return this.request<void>(
      "DELETE",
      `/v1/book-clubs/${id}/members/me`,
      undefined,
      true,
    );
  }

  createReadingSchedule(id: string, schedule: IReadingSchedule) {
    return this.settings(id, { readingSchedule: schedule });
  }
  updateReadingSchedule(id: string, schedule: IReadingSchedule) {
    return this.settings(id, { readingSchedule: schedule });
  }
  createDiscussionPrompt(id: string, prompt: DiscussionPromptInput) {
    return this.request<IDiscussionPrompt>(
      "POST",
      `/v1/book-clubs/${id}/prompts`,
      prompt,
      true,
    ).then((x) => x.id);
  }
  addPromptResponse(
    id: string,
    promptId: string,
    response: PromptResponseInput,
  ) {
    return this.request<IPromptResponse>(
      "POST",
      `/v1/book-clubs/${id}/prompts/${promptId}/responses`,
      response,
      true,
    ).then((x) => x.id);
  }
  createPoll(id: string, poll: PollInput) {
    return this.request<IPoll>(
      "POST",
      `/v1/book-clubs/${id}/polls`,
      poll,
      true,
    ).then((x) => x.id);
  }
  voteOnPoll(id: string, pollId: string, _userId: string, optionIndex: number) {
    return this.request<void>(
      "PUT",
      `/v1/book-clubs/${id}/polls/${pollId}/vote`,
      { optionIndex },
      true,
    );
  }
  closePoll(id: string, pollId: string) {
    return this.request<void>(
      "PUT",
      `/v1/book-clubs/${id}/polls/${pollId}/close`,
      undefined,
      true,
    );
  }
  updateReadingProgress(
    id: string,
    _userId: string,
    currentChapter: number,
    notes?: string,
  ) {
    return this.request<IReadingProgress>(
      "PUT",
      `/v1/book-clubs/${id}/progress/me`,
      { currentChapter, notes: notes || null },
      true,
    );
  }
  getMemberProgress(id: string) {
    return this.request<IReadingProgress[]>(
      "GET",
      `/v1/book-clubs/${id}/progress`,
      undefined,
      true,
    );
  }
}
export const bookClubRepo = new BookClubRepo();
