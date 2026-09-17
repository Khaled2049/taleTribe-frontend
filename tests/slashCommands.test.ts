import { describe, expect, it } from "vitest";
import {
  HELP_COMMAND,
  parseSlashCommand,
} from "@/components/chat/slashCommands";

describe("parseSlashCommand", () => {
  it("recognizes the help command however it is typed", () => {
    expect(parseSlashCommand("/help")).toBe("help");
    expect(parseSlashCommand("  /HELP  ")).toBe("help");
    expect(parseSlashCommand("/?")).toBe("help");
    expect(parseSlashCommand(HELP_COMMAND)).toBe("help");
  });

  it("leaves anything that is not exactly a command to the assistant", () => {
    for (const text of [
      "",
      "   ",
      "help",
      "/helo",
      "/helpme",
      "//help",
      "/help me tighten this paragraph",
      "please /help",
      "/ help",
    ]) {
      expect(parseSlashCommand(text), text).toBeNull();
    }
  });
});
