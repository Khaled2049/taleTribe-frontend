/// <reference types="cypress" />
export {};

const EMAIL = "assistant-panel@e2e.local";
const PASSWORD = "e2e-password-123";

type Event = Record<string, unknown>;

function sse(events: Event[]): string {
  return events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("");
}

function replyWithEvents(
  req: {
    reply(response: {
      statusCode: number;
      headers: Record<string, string>;
      body: string;
    }): void;
  },
  events: Event[],
) {
  req.reply({
    statusCode: 200,
    headers: { "Content-Type": "text/event-stream; charset=utf-8" },
    body: sse(events),
  });
}

function base(runId: string, seq: number, event: Event): Event {
  return { v: 1, runId, seq, ...event };
}

const textRun = (runId = "run-text") => [
  base(runId, 0, { type: "run.started", provider: "mock", model: "mock-1" }),
  base(runId, 1, {
    type: "text.delta",
    text: "The lighthouse is the story’s central image.",
  }),
  base(runId, 2, {
    type: "text.done",
    part: {
      type: "text",
      text: "The lighthouse is the story’s central image.",
    },
  }),
  base(runId, 3, {
    type: "usage",
    provider: "mock",
    model: "mock-1",
    promptTokens: 40,
    completionTokens: 9,
    credits: 2,
    billing: "mock",
  }),
  base(runId, 4, { type: "run.completed", finishReason: "stop" }),
];

describe("story assistant panel", () => {
  let storyId: string;

  beforeEach(() => {
    cy.seedUser({ email: EMAIL, password: PASSWORD });
    cy.login(EMAIL, PASSWORD);
    cy.createStory("Saltmarsh").then((id) => {
      storyId = id;
    });
  });

  const editIt = Cypress.env("ASSISTANT_EDIT_E2E") ? it : it.skip;

  editIt("reviews, applies, and saves one selected-text revision", () => {
    cy.get(".ProseMirror")
      .click()
      .type("Brass polish.", { force: true })
      .type("{selectall}");
    cy.get('[data-cy="open-chat"]').click();
    cy.get('[data-cy="assistant-input"]').type(
      "Tighten this selection. __script: editor-rewrite{enter}",
    );

    cy.get('[data-cy="assistant-edit-review"]', { timeout: 20000 })
      .should("contain.text", "Manuscript suggestion")
      .and("contain.text", "Brass polish.");
    cy.get('[data-cy="assistant-edit-apply"]').click();
    cy.get('[data-cy="assistant-edit-review"]')
      .should("contain.text", "Applied and saved")
      .and("contain.text", "Undo remains available");
    cy.get(".ProseMirror").should("contain.text", "Tightened: Brass polish.");
    cy.get('[data-cy="assistant-message"]').should(
      "contain.text",
      "Applied and saved in the current chapter.",
    );
  });

  it("opens at a mobile width, answers, and preserves settled messages on reopen", () => {
    cy.viewport(390, 740);

    cy.get('[data-cy="open-chat"]').click();
    cy.get('[data-cy="assistant-panel"]')
      .should("be.visible")
      .and("have.css", "width", "390px");
    cy.get('[data-cy="assistant-input"]')
      .should("be.focused")
      .type("What image anchors this story? __script: text-only");
    cy.get('[data-cy="assistant-send"]').click();
    cy.get('[data-cy="assistant-message"]').should(
      "contain.text",
      "lighthouse had been dark",
    );
    cy.get('[data-cy="assistant-usage"]').should("contain.text", "421 tokens");

    cy.get('[data-cy="assistant-close"]').click();
    cy.get('[data-cy="open-chat"]').click();
    cy.get('[data-cy="assistant-user-message"]').should(
      "contain.text",
      "What image anchors this story? __script: text-only",
    );
    cy.get('[data-cy="assistant-message"]').should(
      "contain.text",
      "lighthouse had been dark",
    );
  });

  it("completes a real tool-then-answer run through the local gateway", () => {
    cy.get('[data-cy="open-chat"]').click();
    cy.get('[data-cy="assistant-input"]').type(
      "How many chapters? __script: tool-then-answer{enter}",
    );

    cy.get('[data-cy="assistant-tool-get_story_overview"]')
      .should("contain.text", "Story overview")
      .and("have.attr", "aria-label", "Story overview: complete");
    cy.get('[data-cy="assistant-message"]').should(
      "contain.text",
      "lighthouse had been dark",
    );
    cy.get('[data-cy="assistant-usage"]')
      .should("contain.text", "958 tokens")
      .and("contain.text", "11 credits")
      .and("contain.text", "2 model calls");
  });

  it("renders a completed read tool and a bounded story reference", () => {
    const events = [
      base("run-tool", 0, {
        type: "run.started",
        provider: "mock",
        model: "mock-1",
      }),
      base("run-tool", 1, {
        type: "tool.started",
        toolCallId: "call-1",
        name: "read_chapter",
      }),
      base("run-tool", 2, {
        type: "tool.args.delta",
        toolCallId: "call-1",
        delta: '{"chapterId":"chapter-1"}',
      }),
      base("run-tool", 3, {
        type: "tool.completed",
        part: {
          type: "tool_call",
          toolCallId: "call-1",
          name: "read_chapter",
          arguments: { chapterId: "chapter-1" },
          result: {
            chapter_id: "chapter-1",
            title: "Low Tide",
            truncated: true,
          },
        },
      }),
      base("run-tool", 4, {
        type: "reference.emitted",
        part: {
          type: "source",
          sourceId: "chapter-1",
          kind: "story",
          title: "Chapter 1: Low Tide",
          snippet: "The lamp room smelled of brass polish.",
        },
      }),
      base("run-tool", 5, {
        type: "text.done",
        part: { type: "text", text: "Low Tide introduces the keeper." },
      }),
      base("run-tool", 6, { type: "run.completed", finishReason: "stop" }),
    ];
    cy.intercept("POST", "**/assistantRun", (req) =>
      replyWithEvents(req, events),
    );

    cy.get('[data-cy="open-chat"]').click();
    cy.get('[data-cy="assistant-input"]').type("Read chapter one{enter}");
    cy.get('[data-cy="assistant-tool-read_chapter"]')
      .should("contain.text", "Chapter reading")
      .and("contain.text", "Open chapter")
      .and("contain.text", "Partial result");
    cy.contains("Chapter 1: Low Tide").should("be.visible");
  });

  it("shows cumulative usage and an honest max-steps partial state", () => {
    const events = [
      base("run-max", 0, {
        type: "run.started",
        provider: "mock",
        model: "mock-1",
      }),
      base("run-max", 1, {
        type: "text.delta",
        text: "The keeper appears in chapter two",
      }),
      base("run-max", 2, {
        type: "text.done",
        part: { type: "text", text: "The keeper appears in chapter two" },
      }),
      base("run-max", 3, {
        type: "usage",
        provider: "mock",
        model: "mock-1",
        promptTokens: 10,
        completionTokens: 2,
        credits: 1,
        billing: "mock",
      }),
      base("run-max", 4, {
        type: "usage",
        provider: "mock",
        model: "mock-1",
        promptTokens: 20,
        completionTokens: 4,
        credits: 3,
        billing: "mock",
      }),
      base("run-max", 5, { type: "run.completed", finishReason: "max_steps" }),
    ];
    cy.intercept("POST", "**/assistantRun", (req) =>
      replyWithEvents(req, events),
    );

    cy.get('[data-cy="open-chat"]').click();
    cy.get('[data-cy="assistant-input"]').type("Find the keeper{enter}");
    cy.get('[data-cy="assistant-notice-max_steps"]').should(
      "contain.text",
      "Stopped early",
    );
    cy.get('[data-cy="assistant-usage"]')
      .should("contain.text", "36 tokens")
      .and("contain.text", "4 credits");
  });

  it("retries with a fresh request after a safe provider failure", () => {
    let calls = 0;
    cy.intercept("POST", "**/assistantRun", (req) => {
      calls += 1;
      if (calls === 1) {
        replyWithEvents(req, [
          base("run-fail", 0, { type: "run.started" }),
          base("run-fail", 1, {
            type: "run.failed",
            code: "provider_unavailable",
            message:
              "The AI service is unreachable right now. Try again shortly.",
          }),
        ]);
      } else {
        replyWithEvents(req, textRun("run-retry"));
      }
    }).as("assistantRun");

    cy.get('[data-cy="open-chat"]').click();
    cy.get('[data-cy="assistant-input"]').type("Try this response{enter}");
    cy.wait("@assistantRun");
    cy.get('[data-cy="assistant-error-provider_unavailable"]').should(
      "be.visible",
    );
    cy.contains("The assistant connection failed safely").should("not.exist");
    cy.get('[data-cy="assistant-retry"]').click();
    cy.wait("@assistantRun");
    cy.get('[data-cy="assistant-message"]').should(
      "contain.text",
      "central image",
    );
    cy.then(() => expect(calls).to.eq(2));
  });

  it("shows quota refusal without exposing the upstream response body", () => {
    cy.intercept("POST", "**/assistantRun", {
      statusCode: 402,
      body: "private upstream diagnostic",
    });

    cy.get('[data-cy="open-chat"]').click();
    cy.get('[data-cy="assistant-input"]').type("Summarize the plot{enter}");
    cy.get('[data-cy="assistant-error-quota_exceeded"]')
      .should("contain.text", "used up your assistant allowance")
      .and("not.contain.text", "private upstream diagnostic");
  });

  it("stops an active run and retains an honest cancelled state", () => {
    cy.get('[data-cy="open-chat"]').click();
    cy.get('[data-cy="assistant-input"]').type(
      "Keep waiting __script: hang{enter}",
    );
    cy.get('[data-cy="assistant-metadata"][data-run-id]').should("exist");
    cy.get('[data-cy="assistant-working"]')
      .should("be.visible")
      .and("contain.text", "Gathering the threads")
      .and("contain.text", "Reading your story");
    cy.get('[data-cy="assistant-stop"]').should("be.visible").click();
    cy.get('[data-cy="assistant-working"]').should("not.exist");
    cy.get('[data-cy="assistant-notice-run.cancelled"]').should(
      "contain.text",
      "Stopped",
    );
  });

  it("aborts a hanging run when the panel closes", () => {
    cy.get('[data-cy="open-chat"]').click();
    cy.get('[data-cy="assistant-input"]').type(
      "Keep waiting __script: hang{enter}",
    );
    cy.get('[data-cy="assistant-metadata"][data-run-id]').should("exist");
    cy.get('[data-cy="assistant-stop"]').should("be.visible");
    cy.get('[data-cy="assistant-close"]').click();
    cy.get('[data-cy="open-chat"]').click();
    cy.get('[data-cy="assistant-notice-run.cancelled"]').should(
      "contain.text",
      "Stopped",
    );
  });

  it("closes the panel and cancels its run when authentication is lost", () => {
    cy.get('[data-cy="open-chat"]').click();
    cy.get('[data-cy="assistant-input"]').type(
      "Keep waiting __script: hang{enter}",
    );
    cy.get('[data-cy="assistant-metadata"][data-run-id]').should("exist");
    cy.get('[data-cy="assistant-stop"]').should("be.visible");

    cy.window().then((appWindow) =>
      appWindow.eval(
        'import("/packages/platform-auth/src/index.ts").then(({ auth }) => auth.signOut())',
      ),
    );
    cy.get('[data-cy="assistant-panel"]').should("not.exist");
  });

  it("clears the local transcript synchronously when the story changes", () => {
    cy.intercept("POST", "**/assistantRun", (req) =>
      replyWithEvents(req, textRun()),
    );
    cy.get('[data-cy="open-chat"]').click();
    cy.get('[data-cy="assistant-input"]').type("Only for Saltmarsh{enter}");
    cy.get('[data-cy="assistant-message"]').should(
      "contain.text",
      "central image",
    );
    cy.get('[data-cy="assistant-close"]').click();

    cy.createStory("North Window").then((nextStoryId) => {
      expect(nextStoryId).not.to.eq(storyId);
    });
    cy.get('[data-cy="open-chat"]').click();
    cy.get('[data-cy="assistant-user-message"]').should("not.exist");
    cy.contains("Only for Saltmarsh").should("not.exist");
  });
});
