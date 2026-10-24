import { request } from "@novelsync/story-data-client";
import type {
  CompetitionPhase,
  ICompetitionResult,
} from "@/types/ICompetition";
import type { ITokenAmount } from "@/types/IToken";

export interface AdminCompetition {
  id: string;
  title: string;
  description: string;
  creatorId: string;
  creatorName: string;
  phase: CompetitionPhase;
  category: string;
  tags: string[];
  startDate: string | null;
  deadline: string | null;
  votingDeadline: string | null;
  participants: number;
  submissionCount: number;
  ballotCount: number;
  prizePool: ITokenAmount;
  entryFee: ITokenAmount;
  results?: ICompetitionResult[];
}

const base = "/v1/admin/competitions";
const options = { auth: "required", devAdmin: true } as const;

export const adminCompetitionService = {
  list(search: string, phase: string, cursor: string, signal?: AbortSignal) {
    const params = new URLSearchParams({
      q: search,
      phase,
      cursor,
      limit: "24",
    });
    return request<{ competitions: AdminCompetition[]; nextCursor?: string }>(
      `${base}?${params}`,
      { ...options, signal },
    );
  },
  get(id: string, signal?: AbortSignal) {
    return request<AdminCompetition>(`${base}/${id}`, { ...options, signal });
  },
  deleteDraft(id: string) {
    return request<void>(`${base}/${id}`, { ...options, method: "DELETE" });
  },
  settle(id: string) {
    return request<AdminCompetition>(`${base}/${id}/settle`, {
      ...options,
      method: "POST",
    });
  },
  /** Settles every competition past its voting deadline; failures are ids only. */
  settleDue() {
    return request<{ settled: string[]; failed: string[] }>(
      `${base}/settle-due`,
      { ...options, method: "POST" },
    );
  },
};
