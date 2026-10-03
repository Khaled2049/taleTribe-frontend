import type {
  IClub,
  IDiscussionPrompt,
  IPoll,
  IPromptResponse,
} from "@/types/IClub";

// Each of these applies one confirmed write to a cached club, so the page
// does not refetch the whole club to learn what it just did. They mirror the
// order story-data serves: prompts and responses oldest first, polls newest
// first.

export function withMember(club: IClub, uid: string, joined: boolean): IClub {
  if (club.members.includes(uid) === joined) return club;
  return {
    ...club,
    members: joined
      ? [...club.members, uid]
      : club.members.filter((id) => id !== uid),
  };
}

export function withPrompt(club: IClub, prompt: IDiscussionPrompt): IClub {
  const prompts = club.discussionPrompts ?? [];
  if (prompts.some((p) => p.id === prompt.id)) return club;
  return { ...club, discussionPrompts: [...prompts, prompt] };
}

export function withPromptResponse(
  club: IClub,
  promptId: string,
  response: IPromptResponse,
): IClub {
  return {
    ...club,
    discussionPrompts: (club.discussionPrompts ?? []).map((prompt) => {
      const responses = prompt.responses ?? [];
      if (prompt.id !== promptId || responses.some((r) => r.id === response.id))
        return prompt;
      return { ...prompt, responses: [...responses, response] };
    }),
  };
}

export function withPoll(club: IClub, poll: IPoll): IClub {
  const polls = club.polls ?? [];
  if (polls.some((p) => p.id === poll.id)) return club;
  return { ...club, polls: [poll, ...polls] };
}

export function withVote(
  club: IClub,
  pollId: string,
  uid: string,
  optionIndex: number,
): IClub {
  return {
    ...club,
    polls: (club.polls ?? []).map((poll) =>
      poll.id === pollId
        ? { ...poll, votes: { ...poll.votes, [uid]: optionIndex } }
        : poll,
    ),
  };
}

export function withPollClosed(club: IClub, pollId: string): IClub {
  return {
    ...club,
    polls: (club.polls ?? []).map((poll) =>
      poll.id === pollId ? { ...poll, isActive: false } : poll,
    ),
  };
}
