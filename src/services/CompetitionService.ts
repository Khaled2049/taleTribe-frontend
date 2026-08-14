import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import api, { getApiErrorMessage } from "@/api";
import { firestore } from "@/config/firebase";
import { deriveCompetitionStatus } from "@/lib/competitionPhase";
import { isMinorUnits } from "@/lib/money";
import {
  CompetitionPhase,
  EscrowState,
  ICompetition,
  ICompetitionDraftInput,
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
  published?: boolean;
  escrowState?: EscrowState;
  prizePool?: ITokenAmount;
  entryFee?: ITokenAmount;
  feeBps?: number;
  entryFeesHeld?: string;
  entryFeesSettled?: ICompetition["entryFeesSettled"];
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
    // real pool. Once no stored document carries the old fields, the
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
      // Left undefined rather than synthesized as a zero amount; `getEntryFee`
      // in competitionListing.ts is the single reader and handles absence.
      entryFee: data.entryFee,
      feeBps: typeof data.feeBps === "number" ? data.feeBps : undefined,
      entryFeesHeld: isMinorUnits(data.entryFeesHeld)
        ? data.entryFeesHeld
        : undefined,
      entryFeesSettled: data.entryFeesSettled,
      // Absent on every document written before drafts existed; those were all
      // public, so treat a missing flag as published.
      published: data.published ?? true,
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

  /**
   * Every published competition.
   *
   * The `published` constraint is required, not an optimization: `firestore.rules`
   * denies drafts to everyone but their creator, and Firestore rejects an entire
   * list query if any document it would return fails the rule. An unconstrained
   * read of this collection now errors for everyone.
   */
  async getCompetitions(): Promise<ICompetition[]> {
    const competitionsQuery = query(
      this.competitionsCollection,
      where("published", "==", true),
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

  /** A host's own unpublished drafts. Nobody else can read these. */
  async getMyDrafts(userId: string): Promise<ICompetition[]> {
    const draftsQuery = query(
      this.competitionsCollection,
      where("creatorId", "==", userId),
      where("published", "==", false),
      orderBy("updatedAt", "desc"),
    );

    const snapshot = await getDocs(draftsQuery);
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
   * Create or overwrite an unpublished draft. No money moves.
   *
   * Every field but the title is optional — the server's draft validator is
   * deliberately lenient so a half-written competition can be saved.
   */
  async saveDraft(input: ICompetitionDraftInput): Promise<string> {
    try {
      const { data } = await api.post<{ competitionId: string }>(
        "/saveCompetitionDraft",
        {
          ...(input.competitionId
            ? { competitionId: input.competitionId }
            : {}),
          title: input.title,
          description: input.description ?? "",
          category: input.category ?? "",
          tags: input.tags ?? [],
          maxParticipants: input.maxParticipants ?? null,
          startDate: input.startDate?.toISOString() ?? null,
          deadline: input.deadline?.toISOString() ?? null,
          votingDeadline: input.votingDeadline?.toISOString() ?? null,
          prizeAmount: input.prizeAmount ?? null,
          entryFee: input.entryFee ?? null,
          creatorName: input.creatorName,
        },
      );
      return data.competitionId;
    } catch (error) {
      throw new Error(getApiErrorMessage(error, "Failed to save draft"));
    }
  }

  /**
   * Publish a draft. This is the call that debits the host's TALE into escrow.
   *
   * Takes only an id: the server validates and publishes the stored document,
   * so the terms that go live are exactly the ones the host last saved.
   */
  async publishCompetition(competitionId: string): Promise<CompetitionPhase> {
    try {
      const { data } = await api.post<{ phase: CompetitionPhase }>(
        "/publishCompetition",
        { competitionId },
      );
      return data.phase;
    } catch (error) {
      throw new Error(
        getApiErrorMessage(error, "Failed to publish competition"),
      );
    }
  }

  /** Delete a draft outright. Only legal while unpublished. */
  async discardDraft(competitionId: string): Promise<void> {
    try {
      await api.post("/discardCompetitionDraft", { competitionId });
    } catch (error) {
      throw new Error(getApiErrorMessage(error, "Failed to discard draft"));
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
