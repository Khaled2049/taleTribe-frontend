/**
 * The chat's local command vocabulary. Today there is exactly one command.
 *
 * Matching is exact on purpose. Prose legitimately begins with a slash, and a
 * composer that quietly swallows anything starting with `/` is worse than one
 * that sends a mistyped `/helo` to the model for the price of one cheap call.
 * So `/helo`, `/help me rewrite this` and `please /help` are all ordinary
 * prompts; only a message that is nothing but the command is intercepted.
 */
export type SlashCommand = "help";

const COMMANDS: Readonly<Record<string, SlashCommand>> = {
  "/help": "help",
  "/?": "help",
};

/** The command a message *is*, or null if it is a prompt for the assistant. */
export function parseSlashCommand(text: string): SlashCommand | null {
  return COMMANDS[text.trim().toLowerCase()] ?? null;
}

/** The canonical spelling, for suggestion chips and composer hints. */
export const HELP_COMMAND = "/help";

export const ROOM_COMMAND = "/room";

/**
 * The question after `/room`, `""` for the bare command, or null when the
 * message is not a room request.
 *
 * Unlike `/help` this command takes an argument, so it matches a prefix -- but
 * only as a whole word. `/roommate drama` is prose and stays a prompt.
 */
export function parseRoomCommand(text: string): string | null {
  const match = /^\/room(?:\s+([\s\S]*))?$/i.exec(text.trim());
  return match ? (match[1] ?? "").trim() : null;
}
