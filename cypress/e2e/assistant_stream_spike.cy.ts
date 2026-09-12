/// <reference types="cypress" />
export {};

// Opt in with --env assistantSpike=true and the Phase 0 stack flags from the ADR.
const spikeSuite = Cypress.env("assistantSpike") ? describe : describe.skip;
spikeSuite("Phase 0 authenticated assistant stream", () => {
  beforeEach(() => {
    cy.seedUser({
      email: "assistant-spike@e2e.local",
      password: "e2e-password-123",
    });
    cy.login("assistant-spike@e2e.local", "e2e-password-123");
    cy.createStory("Phase Zero Fixture");
    cy.get('[data-cy="open-chat"]').click();
    cy.get('[data-cy="assistant-spike"]').should("be.visible");
  });

  it("renders incremental text before the stream completes", () => {
    cy.get('[data-cy="spike-input"]').type("Run transport proof");
    cy.get('[data-cy="spike-send"]').click();
    cy.get('[data-cy="spike-message"]').should("contain.text", "Mock");
    cy.get('[data-cy="spike-cancel"]').should("not.be.disabled");
    cy.get('[data-cy="spike-message"]').should(
      "contain.text",
      "Mock streaming works.",
    );
    cy.get('[data-cy="spike-cancel"]').should("be.disabled");
  });

  it("cancels a stream on panel close", () => {
    cy.get('[data-cy="spike-input"]').type("Close this run");
    cy.get('[data-cy="spike-send"]').click();
    cy.get('[data-cy="spike-message"]').should("contain.text", "Mock");
    cy.get('[data-cy="spike-cancel"]').should("not.be.disabled");
    cy.get('[aria-label="Close assistant preview"]').click({ force: true });
    cy.get('[data-cy="assistant-spike"]').should("not.exist");
    cy.get('[data-cy="open-chat"]').click();
    cy.get('[data-cy="spike-message"]').should("not.exist");
  });

  it("stops a stream without completing its reply", () => {
    cy.get('[data-cy="spike-input"]').type("Stop this run");
    cy.get('[data-cy="spike-send"]').click();
    cy.get('[data-cy="spike-message"]').should("contain.text", "Mock");
    cy.get('[data-cy="spike-cancel"]').click();
    cy.get('[data-cy="spike-cancel"]').should("be.disabled");
    cy.get('[data-cy="spike-message"]').should("not.contain.text", "Mock streaming works.");
  });
});
