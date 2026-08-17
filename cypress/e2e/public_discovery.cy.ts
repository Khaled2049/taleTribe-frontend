/// <reference types="cypress" />
export {};

// Spec E — public discovery. The listing at /stories is the one surface an
// anonymous visitor sees, so the assertion that matters is negative: an
// unpublished draft must never reach it.
//
// Everything is seeded through the API. The browser's job here is only to
// prove the anonymous read path works end to end — no Firebase token, through
// the Vite proxy, into story-data.

const EMAIL = "discovery@e2e.local";
const PASSWORD = "e2e-password-123";

type Row = Record<string, unknown>;

describe("Public discovery", () => {
  let uid: string;

  const seedStory = (title: string, published: boolean) =>
    cy.task<Row>("storyData", {
      method: "POST",
      path: "/v1/stories",
      uid,
      body: {
        title,
        description: "Seeded for discovery.",
        authorName: "e2e",
        tags: [],
        published,
      },
    });

  beforeEach(() => {
    cy.seedUser({ email: EMAIL, password: PASSWORD }).then((u) => {
      uid = u;
    });
  });

  it("lists published stories to a signed-out visitor and hides drafts", () => {
    cy.then(() => {
      seedStory("The Lamplighter's Ledger", true);
      seedStory("Unfinished Business", false);
    });

    // No login: this is the anonymous path.
    cy.visit("/stories");

    cy.contains("The Lamplighter's Ledger", { timeout: 20000 }).should(
      "be.visible",
    );
    cy.contains("Unfinished Business").should("not.exist");
  });

  it("opens a published story and refuses a draft", () => {
    cy.then(() => {
      seedStory("The Lamplighter's Ledger", true).then((published) => {
        cy.visit(`/story/${published.id}`);
        cy.contains("The Lamplighter's Ledger", { timeout: 20000 }).should(
          "be.visible",
        );
      });

      seedStory("Unfinished Business", false).then((draft) => {
        // The public reader has no notion of a caller, so the author's own
        // draft is as invisible here as anyone else's.
        cy.task<Row | null>("storyData", {
          path: `/v1/public/stories/${draft.id}`,
          uid,
        }).should("be.null");
      });
    });
  });

  it("counts a view when a story is opened", () => {
    cy.then(() => {
      seedStory("The Lamplighter's Ledger", true).then((story) => {
        cy.visit(`/story/${story.id}`);
        cy.contains("The Lamplighter's Ledger", { timeout: 20000 }).should(
          "be.visible",
        );

        // pollStoryData coerces anything non-array to [], and the detail read
        // is an object — so this one is asserted directly.
        cy.task<Row>("storyData", {
          path: `/v1/public/stories/${story.id}`,
          uid,
        }).then((detail) => {
          const inner = detail.story as Row;
          expect(inner.views as number).to.be.at.least(1);
        });
      });
    });
  });
});
