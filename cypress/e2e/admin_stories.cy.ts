/// <reference types="cypress" />
import "../support/commands";

// Also runs against dev-new.sh without clearing the developer's emulator:
// yarn cy:run --config supportFile=false --spec cypress/e2e/admin_stories.cy.ts
describe("admin story moderation", () => {
  const password = "e2e-password-123";
  let adminEmail: string;
  let authorEmail: string;
  let authorId: string;
  let storyId: string;
  let storyTitle: string;

  beforeEach(() => {
    const run = `${Date.now()}-${Cypress._.random(100000)}`;
    adminEmail = `moderator-${run}@e2e.local`;
    authorEmail = `reported-author-${run}@e2e.local`;
    storyTitle = `Moderation fixture ${run}`;
    cy.seedUser({ email: adminEmail, password }).then((uid) => {
      // Emulator only: production roles are assigned by a trusted operator.
      cy.request({
        method: "POST",
        url: `${Cypress.env("authRest")}/accounts:update?key=emulator`,
        headers: { Authorization: "Bearer owner" },
        body: {
          localId: uid,
          customAttributes: JSON.stringify({ admin: true }),
        },
      });
    });
    cy.seedUser({ email: authorEmail, password }).then((uid) => {
      authorId = uid;
      cy.task("seedStoryDataStories", {
        uid,
        count: 1,
        titlePrefix: storyTitle,
      });
      cy.task<Record<string, unknown>[]>("storyData", {
        path: "/v1/stories",
        uid,
      }).then((stories) => {
        storyId = stories[0].id as string;
        storyTitle = stories[0].title as string;
        cy.task<Record<string, unknown>[]>("storyData", {
          path: `/v1/stories/${storyId}/chapters`,
          uid,
        }).then((chapters) => {
          cy.request({
            method: "PATCH",
            url: `${Cypress.env("storyDataUrl")}/v1/stories/${storyId}/chapters/${chapters[0].id}`,
            headers: {
              "X-User-ID": uid,
              "If-Match": String(chapters[0].revision),
            },
            body: {
              title: "Private draft chapter",
              content: "<p>Private draft text for report investigation.</p>",
            },
          });
        });
      });
    });
  });

  it("gates the route and blocks direct API access for ordinary authors", () => {
    cy.visit("/admin");
    cy.location("pathname").should("eq", "/sign-in");
    cy.location("search").should("include", "redirect=%2Fadmin");
    cy.login(authorEmail, password);
    cy.visit("/admin");
    cy.contains("h1", "Admin access required").should("be.visible");
    cy.then(() => {
      cy.visit(`/admin/stories/${storyId}`);
      cy.contains("h1", "Admin access required").should("be.visible");
      cy.request({
        url: `${Cypress.env("storyDataUrl")}/v1/admin/stories`,
        headers: { "X-User-ID": authorId },
        failOnStatusCode: false,
      })
        .its("status")
        .should("eq", 403);
    });
  });

  it("reviews another author's private chapters and confirms permanent deletion", () => {
    cy.login(adminEmail, password);
    cy.visit("/admin");
    cy.contains("h1", "Story moderation").should("be.visible");
    cy.get(
      'input[placeholder="Title, author name, story ID or author ID"]',
    ).type(storyId);
    cy.contains("button", "Search").click();
    cy.contains("a", storyTitle).click();
    cy.contains("h1", storyTitle).should("be.visible");
    cy.contains("h2", "Private draft chapter").should("be.visible");
    cy.contains("Private draft text for report investigation.").should(
      "be.visible",
    );
    cy.screenshot("admin-story-review-desktop");
    cy.viewport(390, 844);
    cy.contains("h1", storyTitle).should("be.visible");
    cy.contains("button", "Delete story").click();
    cy.get('[role="dialog"]').contains("button", "Cancel").click();
    cy.contains("h1", storyTitle).should("be.visible");
    cy.screenshot("admin-story-review-mobile");
    cy.contains("button", "Delete story").click();
    cy.get('[role="dialog"]').contains("button", "Delete story").click();
    cy.contains('[role="status"]', "Story deleted.").should("be.visible");
    cy.request({
      url: `${Cypress.env("storyDataUrl")}/v1/stories/${storyId}`,
      headers: { "X-User-ID": authorId },
      failOnStatusCode: false,
    })
      .its("status")
      .should("eq", 404);
    cy.contains("a", "Return to all stories").click();
    cy.get(
      'input[placeholder="Title, author name, story ID or author ID"]',
    ).type(storyId);
    cy.contains("button", "Search").click();
    cy.contains("No stories found.").should("be.visible");
  });
});
