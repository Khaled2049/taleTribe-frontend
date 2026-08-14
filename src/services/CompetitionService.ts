import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";
import api, { getApiErrorMessage } from "@/api";
import { firestore } from "@/config/firebase";
import { deriveCompetitionStatus } from "@/lib/competitionPhase";
import {
  CompetitionPhase,
  EscrowState,
  ICompetition,
  ICompetitionCreateInput,
  ICompetitionUpdate,
} from "@/types/ICompetition";
import type { ITokenAmount } from "@/types/IToken";
import type {
  ICompetitionBallot,
  ICompetitionSubmission,
} from "@/types/ICompetitionSubmission";

interface CompetitionDoc {
  title?: string;
  description?: string;
  prizeAmount?: number;
  prizeCurrency?: string;
  startDate?: Timestamp;
  deadline?: Timestamp;
  votingDeadline?: Timestamp;
  /** Absent on every document written before the phase model existed. */
  phase?: CompetitionPhase;
  escrowState?: EscrowState;
  prizePool?: ITokenAmount;
  submissionCount?: number;
  ballotCount?: number;
  votingRules?: ICompetition["votingRules"];
  results?: ICompetition["results"];
  resultsDigest?: string;
  settledAt?: Timestamp;
  maxParticipants?: number | null;
  participantsCount?: number;
  participants?: number;
  tags?: string[];
  category?: string;
  creatorId?: string;
  creatorName?: string;
  organizer?: string;
  sponsor?: ICompetition["sponsor"];
  rules?: string[];
  evaluationCriteria?: string;
}

// Status derivation moved to @/lib/competitionPhase so a stored `phase` can take
// precedence over the dates, and so the mapping is unit tested — the explore
// list's tabs and the card's status chip both depend on it.

// Input validation now lives server-side in functions/src/competitionValidation.ts,
// which is the authority — it guards a real balance, so it cannot be a client
// concern. The form does light pre-submit checks for feedback and surfaces the
// server's message for everything else.

class CompetitionService {
  private competitionsCollection = collection(firestore, "competitions");

  private mapCompetition(id: string, data: CompetitionDoc): ICompetition {
    const startDate = data.startDate?.toDate?.() ?? new Date();
    const deadline = data.deadline?.toDate?.() ?? new Date();
    const participantsCount =
      typeof data.participantsCount === "number"
        ? data.participantsCount
        : typeof data.participants === "number"
          ? data.participants
          : 0;

    // Dual-read across the prize migration. Competitions created before TALE
    // existed carry a decorative prizeAmount/prizeCurrency that was never
    // funded, so they are surfaced as a plain label rather than dressed up as a
    // real pool. Once the backfill has run and the old fields are dropped, the
    // `legacyPrizeLabel` branch can go with them.
    const legacyAmount =
      typeof data.prizeAmount === "number" ? data.prizeAmount : 0;
    const legacyPrizeLabel = data.prizePool
      ? undefined
      : legacyAmount > 0
        ? `${legacyAmount.toLocaleString()} ${data.prizeCurrency ?? "USD"}`
        : undefined;

    return {
      id,
      title: data.title ?? "Untitled competition",
      description: data.description ?? "",
      prizeAmount: legacyAmount,
      prizeCurrency: data.prizeCurrency ?? "USD",
      prizePool: data.prizePool,
      escrowState: data.escrowState ?? (data.prizePool ? "funded" : "unfunded"),
      legacyPrizeLabel,
      deadline,
      startDate,
      votingDeadline: data.votingDeadline?.toDate?.(),
      phase: data.phase,
      submissionCount:
        typeof data.submissionCount === "number"
          ? data.submissionCount
          : undefined,
      ballotCount:
        typeof data.ballotCount === "number" ? data.ballotCount : undefined,
      votingRules: data.votingRules,
      results: Array.isArray(data.results) ? data.results : undefined,
      resultsDigest:
        typeof data.resultsDigest === "string" ? data.resultsDigest : undefined,
      settledAt: data.settledAt?.toDate?.(),
      status: deriveCompetitionStatus(data.phase, startDate, deadline),
      participants: participantsCount,
      maxParticipants:
        typeof data.maxParticipants === "number"
          ? data.maxParticipants
          : undefined,
      tags: Array.isArray(data.tags) ? data.tags : [],
      category: data.category ?? "General",
      organizer: data.organizer ?? data.creatorName ?? "Community",
      creatorId: data.creatorId,
      creatorName: data.creatorName,
      rules: data.rules,
      evaluationCriteria: data.evaluationCriteria,
      sponsor: data.sponsor,
    };
  }

  async getCompetitions(): Promise<ICompetition[]> {
    const competitionsQuery = query(
      this.competitionsCollection,
      orderBy("createdAt", "desc"),
    );

    const snapshot = await getDocs(competitionsQuery);
    return snapshot.docs.map((competitionDoc) =>
      this.mapCompetition(
        competitionDoc.id,
        competitionDoc.data() as CompetitionDoc,
      ),
    );
  }

  async getUserJoinedCompetitionIds(userId: string): Promise<Set<string>> {
    const joinsCollection = collection(
      firestore,
      "users",
      userId,
      "competitionJoins",
    );

    const snapshot = await getDocs(joinsCollection);
    return new Set(snapshot.docs.map((joinDoc) => joinDoc.id));
  }

  /**
   * Create a competition and fund its prize pool.
   *
   * Server-side: creating one debits the caller's TALE into escrow and
   * requires the `admin` claim, neither of which a client write could enforce.
   * `firestore.rules` denies all client writes to `competitions`.
   */
  async createCompetition(input: ICompetitionCreateInput): Promise<string> {
    try {
      const { data } = await api.post<{ competitionId: string }>(
        "/createCompetition",
        {
          title: input.title,
          description: input.description,
          category: input.category,
          tags: input.tags,
          maxParticipants: input.maxParticipants ?? null,
          startDate: input.startDate.toISOString(),
          deadline: input.deadline.toISOString(),
          votingDeadline: input.votingDeadline.toISOString(),
          prizeAmount: input.prizeAmount,
          creatorName: input.creatorName,
        },
      );
      return data.competitionId;
    } catch (error) {
      throw new Error(
        getApiErrorMessage(error, "Failed to create competition"),
      );
    }
  }

  /** Edit details. The prize is immutable once funded — the server rejects it. */
  async updateCompetition(
    competitionId: string,
    updates: ICompetitionUpdate,
  ): Promise<void> {
    try {
      await api.post("/updateCompetition", {
        competitionId,
        ...updates,
        ...(updates.startDate
          ? { startDate: updates.startDate.toISOString() }
          : {}),
        ...(updates.deadline
          ? { deadline: updates.deadline.toISOString() }
          : {}),
        ...(updates.votingDeadline
          ? { votingDeadline: updates.votingDeadline.toISOString() }
          : {}),
      });
    } catch (error) {
      throw new Error(
        getApiErrorMessage(error, "Failed to update competition"),
      );
    }
  }

  /**
   * Cancel and refund. Replaces deletion: a competition holding escrow cannot
   * be removed, because the tokens have to go somewhere.
   */
  async cancelCompetition(
    competitionId: string,
    reason?: string,
  ): Promise<void> {
    try {
      await api.post("/cancelCompetition", { competitionId, reason });
    } catch (error) {
      throw new Error(
        getApiErrorMessage(error, "Failed to cancel competition"),
      );
    }
  }

  async joinCompetition(competitionId: string): Promise<void> {
    try {
      await api.post("/joinCompetition", { competitionId });
    } catch (error) {
      throw new Error(getApiErrorMessage(error, "Failed to join competition"));
    }
  }

  async getCompetition(competitionId: string): Promise<ICompetition | null> {
    const snapshot = await getDoc(
      doc(this.competitionsCollection, competitionId),
    );
    if (!snapshot.exists()) return null;
    return this.mapCompetition(snapshot.id, snapshot.data() as CompetitionDoc);
  }

  /**
   * Whether one user has joined one competition.
   *
   * A single document read against the denormalized index that joinCompetition
   * maintains — the detail page needs this for exactly one competition, so
   * fetching the caller's whole join set would be wasteful.
   */
  async hasJoinedCompetition(
    competitionId: string,
    userId: string,
  ): Promise<boolean> {
    const snapshot = await getDoc(
      doc(firestore, "users", userId, "competitionJoins", competitionId),
    );
    return snapshot.exists();
  }

  /** Public gallery of entries. Carries no vote counts until settlement. */
  async getSubmissions(
    competitionId: string,
  ): Promise<ICompetitionSubmission[]> {
    const snapshot = await getDocs(
      collection(firestore, "competitions", competitionId, "submissions"),
    );

    return snapshot.docs
      .map((submissionDoc) => {
        const data = submissionDoc.data();
        return {
          id: submissionDoc.id,
          userId: data.userId ?? submissionDoc.id,
          storyId: data.storyId ?? "",
          storyTitle: data.storyTitle ?? "Untitled story",
          storyAuthorName: data.storyAuthorName ?? null,
          coverImageUrl: data.coverImageUrl ?? null,
          status: data.status ?? "submitted",
          submittedAt: (data.submittedAt as Timestamp | undefined)?.toDate?.(),
          voteCount:
            typeof data.voteCount === "number" ? data.voteCount : undefined,
        } satisfies ICompetitionSubmission;
      })
      .filter((submission) => submission.status === "submitted");
  }

  /**
   * The caller's own ballot. Rules allow a `get` on your own document only —
   * listing the collection is denied, because that would reconstruct the
   * standings the voting phase exists to hide.
   */
  async getMyBallot(
    competitionId: string,
    userId: string,
  ): Promise<ICompetitionBallot | null> {
    const snapshot = await getDoc(
      doc(firestore, "competitions", competitionId, "votes", userId),
    );
    if (!snapshot.exists()) return null;

    const data = snapshot.data();
    return {
      voterId: data.voterId ?? userId,
      submissionIds: Array.isArray(data.submissionIds)
        ? data.submissionIds
        : [],
      castAt: (data.castAt as Timestamp | undefined)?.toDate?.(),
      updatedAt: (data.updatedAt as Timestamp | undefined)?.toDate?.(),
    };
  }

  async submitStory(competitionId: string, storyId: string): Promise<void> {
    try {
      await api.post("/submitToCompetition", { competitionId, storyId });
    } catch (error) {
      throw new Error(getApiErrorMessage(error, "Failed to submit your entry"));
    }
  }

  async withdrawSubmission(competitionId: string): Promise<void> {
    try {
      await api.post("/withdrawSubmission", { competitionId });
    } catch (error) {
      throw new Error(getApiErrorMessage(error, "Failed to withdraw entry"));
    }
  }

  /** Replaces the caller's whole ballot — pass every entry they back. */
  async castVote(
    competitionId: string,
    submissionIds: string[],
  ): Promise<void> {
    try {
      await api.post("/castCompetitionVote", { competitionId, submissionIds });
    } catch (error) {
      throw new Error(getApiErrorMessage(error, "Failed to record your vote"));
    }
  }
}

export const competitionService = new CompetitionService();
