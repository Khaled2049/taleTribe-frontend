/// <reference types="cypress" />
export {};

// Spec B — world-building (characters) and the indexing lifecycle. Characters
// live in story-data since the cutover; each write also enqueues an
// indexing_outbox row that the agent service drains into pgvector chunks.
//
// The old emulator caveat no longer applies to migrated data: indexing is real
// here, not disabled. What is still not asserted is chunk *recall* — the chunks
// table has no HTTP endpoint, so reaching it would need a direct PostgreSQL
// connection from the task layer. The entity lifecycle below is what the UI
// actually depends on.

const EMAIL = "worldbuilding@e2e.local";
const PASSWORD = "e2e-password-123";

describe("World-building & indexing", () => {
  let storyId: string;
  let uid: string;

  beforeEach(() => {
    cy.seedUser({ email: EMAIL, password: PASSWORD }).then((u) => {
      uid = u;
    });
    cy.login(EMAIL, PASSWORD);
    cy.createStory("Atlas of Hollow Names").then((id) => {
      storyId = id;
    });
  });

  it("creates a character and then deletes it", () => {
    // Navigate in-app (the cold-load PrivateRoute bounces to /user-stories
    // while Firebase auth restores). createStory leaves us on the editor. The
    // tab bar is lg:hidden on desktop, but the NavLink still routes client-side
    // when force-clicked (no reload → auth preserved).
    cy.get('[data-cy="tab-characters"]').click({ force: true });
    cy.location("pathname").should("include", "/characters");

    // Create via the Add Character modal.
    cy.get('[data-cy="add-character"]').click();
    cy.get('[data-cy="character-name"]').type("Marlowe Quint");
    cy.get('[data-cy="character-save"]').click();

    cy.then(() =>
      cy
        .pollStoryData(
          `/v1/stories/${storyId}/characters`,
          uid,
          (chars) => chars.length === 1,
        )
        .then((chars) => {
          expect(chars[0].name).to.eq("Marlowe Quint");
        }),
    );

    // The character appears in the roster; delete it via the row action
    // (hover actions are opacity-0 until hover, so force the click).
    cy.contains("Marlowe Quint").should("be.visible");
    cy.get('[aria-label="Delete character"]').first().click({ force: true });

    cy.then(() =>
      cy.pollStoryData(
        `/v1/stories/${storyId}/characters`,
        uid,
        (chars) => chars.length === 0,
      ),
    );
  });
});
