/// <reference types="cypress" />
export {};

const EMAIL = "story-lifecycle@e2e.local";
const PASSWORD = "e2e-password-123";

// Stories live in story-data (PostgreSQL) since the cutover, so these assert
// against its API rather than Firestore docs. Auth is still Firebase; the Node
// task reads back as the same uid via AUTH_MODE=dev's X-User-ID.
describe("Story lifecycle", () => {
  let uid: string;

  beforeEach(() => {
    cy.seedUser({ email: EMAIL, password: PASSWORD }).then((u) => {
      uid = u;
    });
    cy.login(EMAIL, PASSWORD);
  });

  it("creates a story owned by the signed-in user", () => {
    cy.visit("/user-stories");
    cy.get('[data-cy="new-story"]').click();

    cy.get('[data-cy="wizard-title"]').type("The Glass Cartographer");
    cy.get('[data-cy="wizard-create"]').click();

    // On success the wizard navigates to the editor at /create/<storyId>.
    cy.location("pathname", { timeout: 20000 }).should("include", "/create/");
    cy.location("pathname")
      .then((p) => p.split("/")[2])
      .then((storyId) => {
        expect(storyId, "storyId from URL").to.be.a("string").and.not.be.empty;

        cy.task<Record<string, unknown> | null>("storyData", {
          path: `/v1/stories/${storyId}`,
          uid,
        }).then((story) => {
          expect(story, "story row exists").to.not.be.null;
          expect(story!.ownerId, "story.ownerId").to.eq(uid);
          expect(story!.title).to.eq("The Glass Cartographer");
          // CreateStory opens every story with an empty first chapter.
          expect(story!.revision, "story.revision").to.eq(1);
        });
      });
  });

  it("rejects story creation once the per-user cap (100) is reached", () => {
    // The cap is a real count in story-data now, not a denormalized counter, so
    // it has to be reached with real rows rather than by setting a field.
    cy.task("seedStoryDataStories", { uid, count: 100 });

    cy.visit("/user-stories");
    cy.get('[data-cy="new-story"]').click();
    cy.get('[data-cy="wizard-title"]').type("One Story Too Many");
    cy.get('[data-cy="wizard-create"]').click();

    // story-data answers 422, so the wizard never navigates to the editor.
    cy.wait(2000);
    cy.location("pathname").should("not.include", "/create/");

    cy.task<Record<string, unknown>[]>("storyData", {
      path: "/v1/stories",
      uid,
    }).then((stories) => {
      expect(stories, "cap holds").to.have.length(100);
      expect(
        stories.some((s) => s.title === "One Story Too Many"),
        "the 101st story was not created",
      ).to.be.false;
    });
  });
});
