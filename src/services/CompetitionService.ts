import { isNotFound, request } from "@novelsync/story-data-client";
import { deriveCompetitionStatus } from "@/lib/competitionPhase";
import type {
  ICompetition,
  ICompetitionDraftInput,
  ICompetitionUpdate,
} from "@/types/ICompetition";
import type {
  ICompetitionBallot,
  ICompetitionSubmission,
} from "@/types/ICompetitionSubmission";

type ApiCompetition = Omit<
  ICompetition,
  "startDate" | "deadline" | "votingDeadline" | "settledAt" | "status"
> & {
  startDate?: string;
  deadline?: string;
  votingDeadline?: string;
  settledAt?: string;
};

class CompetitionService {
  private request<T>(
    method: string,
    path: string,
    body?: unknown,
    required = false,
  ): Promise<T> {
    return request<T>(path, {
      method,
      body,
      auth: required ? "required" : "optional",
      devAdmin: true,
      label: "Competition request",
    });
  }
  private map(x: ApiCompetition): ICompetition {
    const startDate = x.startDate ? new Date(x.startDate) : new Date();
    const deadline = x.deadline ? new Date(x.deadline) : new Date();
    return {
      ...x,
      startDate,
      deadline,
      votingDeadline: x.votingDeadline ? new Date(x.votingDeadline) : undefined,
      settledAt: x.settledAt ? new Date(x.settledAt) : undefined,
      status: deriveCompetitionStatus(x.phase, startDate, deadline),
      prizeAmount: 0,
      prizeCurrency: "TALE",
      organizer: x.organizer || x.creatorName || "Community",
    } as ICompetition;
  }
  getCompetitions() {
    return this.request<ApiCompetition[]>("GET", "/v1/competitions").then((x) =>
      x.map((v) => this.map(v)),
    );
  }
  getMyDrafts(_user: string) {
    return this.request<ApiCompetition[]>(
      "GET",
      "/v1/me/competitions/drafts",
      undefined,
      true,
    ).then((x) => x.map((v) => this.map(v)));
  }
  async getUserJoinedCompetitionIds(_user: string) {
    return new Set(
      (await this.getCompetitions()).filter((x) => x.isJoined).map((x) => x.id),
    );
  }
  saveDraft(input: ICompetitionDraftInput) {
    const body = {
      ...input,
      startDate: input.startDate?.toISOString(),
      deadline: input.deadline?.toISOString(),
      votingDeadline: input.votingDeadline?.toISOString(),
      prizeAmount: input.prizeAmount,
      entryFee: input.entryFee,
    };
    const id = input.competitionId
      ? `?competitionId=${input.competitionId}`
      : "";
    return this.request<ICompetition>(
      "POST",
      `/v1/competition-drafts${id}`,
      body,
      true,
    ).then((x) => x.id);
  }
  publishCompetition(id: string) {
    return this.request<ICompetition>(
      "POST",
      "/v1/competition-publish",
      { competitionId: id },
      true,
    ).then((x) => x.phase!);
  }
  discardDraft(id: string) {
    return this.request<void>(
      "DELETE",
      `/v1/competitions/${id}`,
      undefined,
      true,
    );
  }
  updateCompetition(id: string, updates: ICompetitionUpdate) {
    return this.request<void>(
      "PATCH",
      `/v1/competitions/${id}`,
      {
        ...updates,
        startDate: updates.startDate?.toISOString(),
        deadline: updates.deadline?.toISOString(),
        votingDeadline: updates.votingDeadline?.toISOString(),
      },
      true,
    );
  }
  cancelCompetition(id: string, reason?: string) {
    return this.request<void>(
      "POST",
      `/v1/competitions/${id}/cancel`,
      { reason },
      true,
    );
  }
  joinCompetition(id: string) {
    return this.request<void>(
      "PUT",
      `/v1/competitions/${id}/join`,
      undefined,
      true,
    );
  }
  getCompetition(id: string) {
    return this.request<ApiCompetition>("GET", `/v1/competitions/${id}`)
      .then((x) => this.map(x))
      .catch((e) => (isNotFound(e) ? null : Promise.reject(e)));
  }
  async hasJoinedCompetition(id: string, _user: string) {
    return (await this.getCompetition(id))?.isJoined ?? false;
  }
  getSubmissions(id: string) {
    return this.request<(ICompetitionSubmission & { submittedAt: string })[]>(
      "GET",
      `/v1/competitions/${id}/submissions`,
      undefined,
      true,
    ).then((x) =>
      x.map((v) => ({ ...v, submittedAt: new Date(v.submittedAt) })),
    );
  }
  getMyBallot(id: string, _user: string) {
    return this.request<
      ICompetitionBallot & { castAt?: string; updatedAt?: string }
    >("GET", `/v1/competitions/${id}/ballots/me`, undefined, true).then(
      (x) => ({
        ...x,
        castAt: x.castAt ? new Date(x.castAt) : undefined,
        updatedAt: x.updatedAt ? new Date(x.updatedAt) : undefined,
      }),
    );
  }
  submitStory(id: string, storyId: string) {
    return this.request<void>(
      "POST",
      `/v1/competitions/${id}/submissions/me`,
      { storyId },
      true,
    );
  }
  withdrawSubmission(id: string) {
    return this.request<void>(
      "DELETE",
      `/v1/competitions/${id}/submissions/me`,
      undefined,
      true,
    );
  }
  castVote(id: string, submissionIds: string[]) {
    return this.request<void>(
      "PUT",
      `/v1/competitions/${id}/ballots/me`,
      { submissionIds },
      true,
    );
  }
}
export const competitionService = new CompetitionService();
