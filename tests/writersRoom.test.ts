import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { ChatModelRunResult, ThreadMessage } from "@assistant-ui/react";
import { buildRunRequest } from "@novelsync/assistant-contracts";
import { createAssistantAdapter } from "@/components/chat/assistantRuntime";
import { EditorActionLedger } from "@/components/chat/editorActionLedger";
import { parseRoomCommand } from "@/components/chat/slashCommands";
import { specialistView } from "@/components/chat/specialistView";

describe("/room command", () => {
  it("takes the question after the command and nothing else", () => {
    expect(parseRoomCommand("/room why is the ending weak?")).toBe(
      "why is the ending weak?",
    );
    expect(parseRoomCommand("  /ROOM   Is Mina consistent?  ")).toBe(
      "Is Mina consistent?",
    );
    expect(parseRoomCommand("/room")).toBe("");
    expect(parseRoomCommand("/room\nline two")).toBe("line two");
  });

  it("leaves prose that merely starts like the command alone", () => {
    for (const text of [
      "/roommate drama in chapter 2",
      "please /room this",
      "room for improvement?",
      "/rooms",
    ]) {
      expect(parseRoomCommand(text)).toBeNull();
    }
  });
});

function userMessage(text: string): ThreadMessage {
  return {
    role: "user",
    content: [{ type: "text", text }],
    metadata: { custom: {} },
  } as unknown as ThreadMessage;
}

function streamOf(frames: string[]) {
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const frame of frames) {
          controller.enqueue(new TextEncoder().encode(`data: ${frame}\n\n`));
        }
        controller.close();
      },
    }),
    { status: 200 },
  );
}

const DONE = [
  '{"v":1,"runId":"run-1","seq":0,"type":"run.started"}',
  '{"v":1,"runId":"run-1","seq":1,"type":"run.completed","finishReason":"stop"}',
];

async function send(text: string) {
  const fetcher = vi.fn(async () => streamOf(DONE)) as unknown as typeof fetch;
  const adapter = createAssistantAdapter({
    storyId: "story-1",
    activeRequest: { current: null },
    actionLedger: new EditorActionLedger(),
    editsEnabled: true,
    transport: {
      endpoint: "/assistant",
      getIdToken: async () => "token",
      fetcher,
      createClientMessageId: () => "message-1",
    },
  });
  const message = userMessage(text);
  const results: ChatModelRunResult[] = [];
  const run = adapter.run({
    abortSignal: new AbortController().signal,
    messages: [message],
    unstable_getMessage: () =>
      ({
        role: "assistant",
        content: [],
        metadata: { custom: {} },
      }) as unknown as ThreadMessage,
  } as unknown as Parameters<typeof adapter.run>[0]);
  for await (const result of run as AsyncGenerator<ChatModelRunResult>) {
    results.push(result);
  }
  const calls = (fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls;
  const body = calls.length
    ? JSON.parse((calls[0][1] as RequestInit).body as string)
    : null;
  return { body, results };
}

describe("room mode on the wire", () => {
  it("sends the question without the command, flagged as a room run", async () => {
    const { body } = await send("/room why is the ending weak?");
    expect(body.mode).toBe("room");
    expect(body.message.parts[0].text).toBe("why is the ending weak?");
  });

  it("answers a bare /room locally instead of spending a run", async () => {
    const { body, results } = await send("/room");
    expect(body).toBeNull();
    const part = results.at(-1)?.content?.[0];
    expect(part?.type === "text" && part.text).toContain("after /room");
  });

  it("sends prose that only starts like the command as ordinary text", async () => {
    const { body } = await send("/roommate drama in chapter 2");
    expect(body.mode).toBeUndefined();
    expect(body.message.parts[0].text).toBe("/roommate drama in chapter 2");
  });

  it("never marks an ordinary message as a room run", async () => {
    const { body } = await send("why is the ending weak?");
    expect(body.mode).toBeUndefined();
  });

  it("rejects an unknown mode before it leaves the browser", () => {
    expect(() =>
      buildRunRequest({
        storyId: "s",
        text: "t",
        clientMessageId: "m",
        mode: "debate" as "room",
      }),
    ).toThrow();
  });
});

describe("a specialist's view", () => {
  const fixture = JSON.parse(
    readFileSync(
      path.resolve(
        __dirname,
        "../packages/assistant-contracts/fixtures/writers-room.json",
      ),
      "utf8",
    ),
  ) as { events: { type: string; part?: { result?: unknown } }[] };
  const results = fixture.events
    .filter((event) => event.type === "tool.completed")
    .map((event) => event.part?.result);

  it("is read from a room-mode consult result", () => {
    const views = results.map(specialistView);
    expect(views.map((view) => view?.name)).toEqual([
      "Story Architect",
      "Critic",
    ]);
    expect(views[1]?.reviewed).toBe(true);
    expect(views[0]?.recommendations[0]?.title).toBe("Pay off the lamp");
  });

  it("is not shown for an ordinary, declined or malformed consult", () => {
    const room = results[0] as Record<string, unknown>;
    for (const result of [
      { ...room, room: false },
      { ...room, accepted: false },
      { ...room, findings: { analysis: "  " } },
      { ...room, findings: "prose" },
      { accepted: false, reason: "No consults are left." },
      null,
      "text",
    ]) {
      expect(specialistView(result)).toBeNull();
    }
  });

  it("drops malformed list entries rather than rendering them", () => {
    const view = specialistView({
      accepted: true,
      room: true,
      name: "Critic",
      findings: {
        analysis: "Flat.",
        recommendations: [{ title: "" }, "x", { title: "Cut it", detail: 3 }],
        risks: ["", 4, "Thin"],
        suggestedChanges: [{ target: "Mina" }, { change: "Raise tension." }],
      },
    });
    expect(view?.recommendations).toEqual([{ title: "Cut it", detail: "" }]);
    expect(view?.risks).toEqual(["Thin"]);
    expect(view?.suggestedChanges).toEqual([
      { target: "", change: "Raise tension." },
    ]);
  });
});
