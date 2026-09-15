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
