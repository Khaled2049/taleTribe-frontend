/// <reference types="cypress" />
export {};

// The reader-only mobile app (src/mobile), driven in a phone-sized browser.
//
// Runs through `yarn cy:mobile`, not `yarn cy:run`: it needs the mobile dev
// server (`yarn mobile:dev`, port 5174) and runs WITHOUT the shared support
// file, so it never resets the emulators. It relies on what ./dev-new.sh
// seeds: the dev user and the published story "The Long Crossing".

const EMAIL = "dev@novelsync.local";
const PASSWORD = "dev123456";
const STORY = "The Long Crossing";

Cypress.on("uncaught:exception", () => false);

const openStory = () => {
  cy.visit("/mobile.html#/stories");
  cy.contains(STORY, { timeout: 20000 }).filter(":visible").first().click();
  cy.location("hash").should("match", /^#\/story\//);
  cy.contains("Read Now", { timeout: 20000 }).should("be.visible");
};

describe(
  "Mobile reader app",
  { viewportWidth: 390, viewportHeight: 844 },
  () => {
    it("lets a guest discover a story and read across chapters", () => {
      openStory();
      cy.get('nav[aria-label="Primary"]').should("be.visible");

      cy.contains("Read Now").click();
      cy.location("hash").should("match", /\/read\/[0-9a-f-]+$/);
      // The reader replaces the shell chrome with its own bars.
      cy.get('nav[aria-label="Primary"]').should("not.exist");
      cy.contains("1 / 6").should("be.visible");

      cy.get('button[aria-label="Next chapter"]')
        .filter(":visible")
        .last()
        .click();
      cy.contains("2 / 6").should("be.visible");

      cy.get('button[aria-label="Settings"]').click();
      cy.contains("Reader Settings").should("be.visible");

      cy.get('button[aria-label="Back to story details"]').click({
        force: true,
      });
      cy.contains("Read Now").should("be.visible");
    });

    it("sends web-only links to the website instead of a dead end", () => {
      cy.visit("/mobile.html#/stories", {
        onBeforeLoad(win) {
          cy.stub(win, "open").as("open");
        },
      });
      cy.contains(STORY, { timeout: 20000 });
      cy.window().then((win) => {
        win.location.hash = "#/profile/someone";
      });
      cy.get("@open").should(
        "have.been.calledWithMatch",
        /thetaletribe\.com\/profile\/someone$|\/profile\/someone$/,
      );
      cy.location("hash").should("eq", "#/stories");
    });

    it("signs in, syncs progress to the shelf and resumes after a reload", () => {
      cy.visit("/mobile.html#/shelf");
      cy.contains("Keep your place").should("be.visible");
      cy.contains("a", "Sign in").click();

      cy.get("#email").type(EMAIL);
      cy.get("#password").type(PASSWORD);
      cy.contains("button", "Sign in").click();
      cy.location("hash", { timeout: 20000 }).should("eq", "#/shelf");

      // The dev user may already have progress, so read the position rather
      // than assume chapter 1, then move it somewhere that is not the default.
      cy.intercept("GET", "**/v1/me/reading-progress/*").as("loadProgress");
      cy.intercept("PUT", "**/v1/me/reading-progress/*").as("saveProgress");
      openStory();
      cy.wait("@loadProgress");
      cy.contains("Read Now").click();
      cy.wait("@saveProgress");
      cy.contains(/^\d \/ 6$/, { timeout: 20000 })
        .invoke("text")
        .then((label) => {
          const current = Number(label.trim()[0]);
          const forward = current < 6;
          const target = forward ? current + 1 : current - 1;
          cy.get(
            `button[aria-label="${forward ? "Next" : "Previous"} chapter"]`,
          )
            .filter(":visible")
            .last()
            .click();
          cy.wait("@saveProgress");
          cy.contains(`${target} / 6`).should("be.visible");

          // Returning to the tab must show the new position, not a cached one.
          cy.get('button[aria-label="Back to story details"]').click({
            force: true,
          });
          cy.contains("a", "Shelf").click();
          cy.contains(`Ch. ${target} of 6`, { timeout: 20000 }).should(
            "be.visible",
          );

          // A full reload proves the Firebase session and the server-side
          // progress both survive.
          cy.reload();
          cy.contains(STORY, { timeout: 20000 }).should("be.visible");
          cy.contains(`Ch. ${target} of 6`).should("be.visible");

          cy.contains("button", "Continue").first().click();
          cy.wait("@loadProgress");
          cy.contains("Read Now", { timeout: 20000 }).click();
          cy.contains(`${target} / 6`, { timeout: 20000 }).should("be.visible");
        });

      cy.visit("/mobile.html#/account");
      cy.contains(EMAIL, { timeout: 20000 }).should("be.visible");
      cy.contains("button", "Sign out").click();
      cy.contains("reading as a guest").should("be.visible");
    });
  },
);
