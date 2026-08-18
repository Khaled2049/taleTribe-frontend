/// <reference types="cypress" />
export {};

// Spec D — chapter comments. Comments moved to story-data in the cutover, so
// what this spec covers is the part the Go API tests cannot reach: the Firebase
// token surviving the Vite proxy into story-data, and the React Query cache the
// thread actually renders from.
//
// The story and chapter are seeded through the API rather than the wizard —
// story_lifecycle already covers the wizard, and repeating it here would just
// make this spec fail for someone else's reason.

const EMAIL = "comments@e2e.local";
const PASSWORD = "e2e-password-123";

type Row = Record<string, unknown>;

describe("Chapter comments", () => {
  let uid: string;
  let storyId: string;
  let chapterId: string;

  const seedComment = (message: string) =>
    cy.task("storyData", {
      method: "POST",
      path: `/v1/stories/${storyId}/chapters/${chapterId}/comments`,
      uid,
      body: { message, parentId: "" },
    });

  beforeEach(() => {
    cy.seedUser({ email: EMAIL, password: PASSWORD }).then((u) => {
      uid = u;
      cy.task<Row>("storyData", {
        method: "POST",
        path: "/v1/stories",
        uid,
        body: {
          title: "The Salt Road",
          description: "A caravan story.",
          authorName: "e2e",
          tags: [],
          published: true,
        },
      }).then((story) => {
        storyId = story.id as string;
        // Creating a story opens it with a first chapter, and the reader lands
        // on that one — so it is the chapter the comment thread hangs off.
        cy.task<Row[]>("storyData", {
          path: `/v1/stories/${storyId}/chapters`,
          uid,
        }).then((chapters) => {
          chapterId = chapters[0].id as string;
        });
      });
    });
    cy.login(EMAIL, PASSWORD);
  });

  it("posts a comment and renders it without a refetch", () => {
    cy.visit(`/story/${storyId}`);

    // The thread sits below the synopsis and author bio, so scroll to it the
    // way a reader would before interacting.
    cy.get('[data-cy="comment-input"]', { timeout: 20000 })
      .scrollIntoView()
      .should("be.visible")
      .type("The salt flats detail landed for me.");
    cy.get('[data-cy="comment-submit"]').click();

    // The mutation response is written straight into the cached thread, so the
    // comment appears without waiting on the 30s stale window.
    cy.get('[data-cy="comment"]')
      .should("have.length", 1)
      .and("contain", "The salt flats detail landed for me.");

    // And it really reached PostgreSQL, not just local state.
    cy.then(() =>
      cy.pollStoryData(
        `/v1/public/stories/${storyId}/chapters/${chapterId}/comments`,
        uid,
        (rows) => rows.length === 1,
      ),
    );
  });

  it("renders a thread longer than five comments", () => {
    // Regression: the list replaced any thread past five top-level comments
    // with the literal words "Comments disabled", so a busy chapter showed
    // nothing at all.
    for (let i = 1; i <= 6; i += 1) {
      seedComment(`Thought number ${i}`);
    }

    cy.visit(`/story/${storyId}`);
    cy.get('[data-cy="comment"]', { timeout: 20000 }).should("have.length", 6);
    cy.get('[data-cy="comment"]').first().scrollIntoView();
    cy.contains("Comments disabled").should("not.exist");
    cy.contains("Thought number 6").should("be.visible");
  });

  it("likes and unlikes a comment", () => {
    seedComment("Worth a like.");
    cy.visit(`/story/${storyId}`);

    cy.get('[data-cy="comment-like"]', { timeout: 20000 })
      .scrollIntoView()
      .should("have.attr", "aria-pressed", "false");
    cy.get('[data-cy="comment-like"]').click();
    cy.get('[data-cy="comment-like"]').should(
      "have.attr",
      "aria-pressed",
      "true",
    );

    cy.then(() =>
      cy.pollStoryData(
        `/v1/public/stories/${storyId}/chapters/${chapterId}/comments`,
        uid,
        (rows) => rows.length === 1 && rows[0].likeCount === 1,
      ),
    );

    cy.get('[data-cy="comment-like"]').click();
    cy.then(() =>
      cy.pollStoryData(
        `/v1/public/stories/${storyId}/chapters/${chapterId}/comments`,
        uid,
        (rows) => rows[0].likeCount === 0,
      ),
    );
  });
});
