export type SubmissionStatus = "submitted" | "withdrawn" | "disqualified";

/**
 * One entry in a competition. The document id is the entrant's uid, which
 * structurally enforces one entry per person.
 *
 * Story fields are denormalized by the server at submit time so the gallery
 * costs no extra reads and does not break if the author later unpublishes or
 * deletes the story.
 */
export interface ICompetitionSubmission {
  id: string;
  userId: string;
  storyId: string;
  storyTitle: string;
  storyAuthorName?: string | null;
  coverImageUrl?: string | null;
  status: SubmissionStatus;
  submittedAt?: Date;
  /**
   * Only present once a competition is settled. During voting there is
   * deliberately no readable count anywhere — see the private/tally rule.
   */
  voteCount?: number;
}

/**
 * A voter's complete ballot: the set of entries they back, not a single vote.
 * Readable only by the voter who cast it.
 */
export interface ICompetitionBallot {
  voterId: string;
  submissionIds: string[];
  castAt?: Date;
  updatedAt?: Date;
}
