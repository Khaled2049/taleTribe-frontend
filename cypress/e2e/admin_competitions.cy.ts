/// <reference types="cypress" />
import "../support/commands";

// Run against dev-new.sh without clearing existing local emulator data:
// yarn cy:run --config supportFile=false --spec cypress/e2e/admin_competitions.cy.ts
it("navigates between admin lists and reviews and deletes another host's draft", () => {
  const run = `${Date.now()}`;
  const email = `competition-moderator-${run}@e2e.local`;
  const password = "e2e-password-123";
  const title = `Competition moderation fixture ${run}`;
  let competitionId: string;
  let creatorId: string;
  cy.seedUser({ email, password }).then((uid) => {
    cy.request({
      method: "POST",
      url: `${Cypress.env("authRest")}/accounts:update?key=emulator`,
      headers: { Authorization: "Bearer owner" },
      body: { localId: uid, customAttributes: JSON.stringify({ admin: true }) },
    });
  });
  cy.seedUser({ email: `competition-host-${run}@e2e.local`, password }).then(
    (uid) => {
      creatorId = uid;
      cy.request({
        method: "POST",
        url: `${Cypress.env("storyDataUrl")}/v1/competition-drafts`,
        headers: { "X-User-ID": uid },
        body: {
          title,
          description: "Private competition description for admin review.",
          creatorName: "Host fixture",
          prizeAmount: "0",
          entryFee: "0",
        },
      }).then((response) => {
        competitionId = response.body.id;
      });
    },
  );
  cy.visit("/admin/competitions");
  cy.location("pathname").should("eq", "/sign-in");
  cy.login(email, password);
  cy.visit("/admin");
  cy.location("pathname").should("eq", "/admin/stories");
  cy.contains("h1", "Story moderation").should("be.visible");
  cy.get('nav[aria-label="Admin sections"]')
    .contains("a", "Competitions")
    .click();
  cy.location("pathname").should("eq", "/admin/competitions");
  cy.contains("h1", "Competition moderation").should("be.visible");
  cy.then(() =>
    cy
      .get('input[placeholder="Title, username, competition ID or user ID"]')
      .type(competitionId),
  );
  cy.contains("button", "Search").click();
  cy.contains("a", title).click();
  cy.contains("h1", title).should("be.visible");
  cy.contains("Private competition description for admin review.")
    .should("exist")
    .scrollIntoView()
    .should("be.visible");
  cy.then(() =>
    cy.contains("dd", creatorId).scrollIntoView().should("be.visible"),
  );
  cy.contains("a", "All competitions").click();
  cy.get("select").select("draft");
  cy.then(() =>
    cy
      .get('input[placeholder="Title, username, competition ID or user ID"]')
      .clear()
      .type(competitionId),
  );
  cy.contains("button", "Search").click();
  cy.contains("tr", title)
    .find('button[title="Delete draft competition"]')
    .click();
  cy.get('[role="dialog"]').contains("button", "Cancel").click();
  cy.contains("tr", title).should("exist");
  cy.screenshot("admin-competitions-desktop");
  cy.viewport(390, 844);
  cy.screenshot("admin-competitions-mobile");
  cy.contains("tr", title)
    .find('button[title="Delete draft competition"]')
    .scrollIntoView()
    .click();
  cy.get('[role="dialog"]').contains("button", "Delete draft").click();
  cy.contains("No competitions found.").should("be.visible");
  cy.then(() => {
    cy.request({
      url: `${Cypress.env("storyDataUrl")}/v1/admin/competitions`,
      headers: { "X-User-ID": creatorId },
      failOnStatusCode: false,
    })
      .its("status")
      .should("eq", 403);
    cy.request({
      url: `${Cypress.env("storyDataUrl")}/v1/admin/competitions/${competitionId}`,
      headers: { "X-User-ID": creatorId, "X-Admin": "true" },
      failOnStatusCode: false,
    })
      .its("status")
      .should("eq", 404);
  });
});
