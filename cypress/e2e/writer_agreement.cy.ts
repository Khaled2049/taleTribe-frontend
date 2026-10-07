/// <reference types="cypress" />
import "../support/commands";

// Can also run against dev-new.sh without clearing local emulator data:
// cypress run --config supportFile=false --spec cypress/e2e/writer_agreement.cy.ts
it("requires explicit writer agreement and preserves it across editor reloads", () => {
  const email = `writer-agreement-${Date.now()}@e2e.local`;
  const password = "e2e-password-123";
  let uid: string;
  cy.seedUser({ email, password }).then((value) => {
    uid = value;
  });
  cy.login(email, password);
  cy.visit("/user-stories");
  cy.get('[data-cy="new-story"]').click();
  cy.get("#writer-agreement-title").should("be.visible");
  cy.get("#writer-terms").should("not.be.checked");
  cy.get("#writer-rights").should("not.be.checked");
  cy.get("#writer-adult").should("not.be.checked");
  cy.get('[data-cy="wizard-title"]').should("not.exist");
  cy.contains("button", "Agree and continue").should("be.disabled");
  cy.get("#writer-agreement-title")
    .parent()
    .find('a[href="/terms-of-use"]')
    .should("have.attr", "target", "_blank");
  cy.get("#writer-terms").check();
  cy.get("#writer-rights").check();
  cy.contains("button", "Agree and continue").should("be.disabled");
  cy.get("#writer-adult").check();
  cy.contains("button", "Agree and continue").click();
  cy.get('[data-cy="wizard-title"]').type("An Original Tale");
  cy.get('[data-cy="wizard-create"]').click();
  cy.location("pathname", { timeout: 20000 }).should("include", "/create/");
  cy.get("#writer-agreement-title").should("not.exist");
  cy.reload();
  cy.get('[data-cy="chapter-editor"]', { timeout: 20000 }).should("be.visible");
  cy.get("#writer-agreement-title").should("not.exist");
  cy.then(() =>
    cy.task<Record<string, unknown>>("storyData", {
      path: "/v1/me/writer-agreement",
      uid,
    }),
  ).then((agreement) => {
    expect(agreement.accepted).to.eq(true);
    expect(agreement.acceptedAt).to.be.a("string");
    expect(agreement.termsVersion).to.eq("2026-10-07");
  });
});
