/// <reference types="cypress" />

/**
 * Custom commands for the NovelSync E2E suite.
 *
 * `login` drives the real sign-in form (most faithful to a user) — the seeded
 * user already has a `completed` invite so the invite gate passes. The job
 * helpers poll Firestore via the `getDoc` Node task instead of sleeping.
 */

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /** Seed an invited user, returns its uid (yielded). */
      seedUser(args: {
        email: string;
        password: string;
        user?: Record<string, unknown>;
      }): Chainable<string>;
      /** Sign in through the real /sign-in form and land on the app. */
      login(email: string, password: string): Chainable<void>;
      /** Create a story through the New Story wizard; yields its storyId and
       *  leaves the browser on the editor route (/create/<storyId>). */
      createStory(title: string): Chainable<string>;
      /** Poll a story-data collection until `predicate(rows)` is true. Same
       *  shape as pollDocs, but for the PostgreSQL-backed domains. */
      pollStoryData(
        path: string,
        uid: string,
        predicate: (rows: Record<string, unknown>[]) => boolean,
        opts?: { tries?: number; intervalMs?: number }
      ): Chainable<Record<string, unknown>[]>;
      /** Poll a Firestore doc until `predicate(doc)` is true; yields the doc.
       *  Handles eventual consistency (e.g. trigger-maintained counters). */
      pollDoc(
        path: string,
        predicate: (doc: Record<string, unknown> | null) => boolean,
        opts?: { tries?: number; intervalMs?: number }
      ): Chainable<Record<string, unknown> | null>;
      /** Poll a (sub)collection until `predicate(docs)` is true; yields docs. */
      pollDocs(
        path: string,
        predicate: (docs: Record<string, unknown>[]) => boolean,
        opts?: { tries?: number; intervalMs?: number }
      ): Chainable<Record<string, unknown>[]>;
    }
  }
}

Cypress.Commands.add("seedUser", (args) =>
  cy.task<{ uid: string }>("seedUser", args).then((r) => r.uid)
);

Cypress.Commands.add("login", (email: string, password: string) => {
  cy.visit("/sign-in");

  // signin() navigates to "/" on success; on the rare failed attempt it clears
  // the form and stays on /sign-in, so a retry must re-type. Bounded retry with
  // a settle window so we don't re-type mid-navigation on the happy path.
  const attempt = (remaining: number): void => {
    cy.get('[data-cy="email"]').clear().type(email);
    cy.get('[data-cy="password"]').clear().type(password, { log: false });
    cy.get('[data-cy="signin-submit"]').click();
    // eslint-disable-next-line cypress/no-unnecessary-waiting
    cy.wait(3000); // allow signInWithEmailAndPassword + navigate to settle
    cy.location("pathname").then((pathname) => {
      if (pathname.includes("/sign-in")) {
        if (remaining <= 0) {
          throw new Error("login did not navigate away from /sign-in");
        }
        attempt(remaining - 1);
      }
    });
  };

  attempt(3);
  cy.location("pathname", { timeout: 12000 }).should("not.include", "/sign-in");
});

Cypress.Commands.add("createStory", (title: string) => {
  cy.visit("/user-stories");
  cy.get('[data-cy="new-story"]').click();
  cy.get('[data-cy="wizard-title"]').type(title);
  cy.get('[data-cy="wizard-create"]').click();
  cy.location("pathname", { timeout: 20000 }).should("include", "/create/");
  return cy.location("pathname").then((p) => p.split("/")[2]);
});

Cypress.Commands.add(
  "pollDoc",
  (
    path: string,
    predicate: (doc: Record<string, unknown> | null) => boolean,
    opts?: { tries?: number; intervalMs?: number }
  ) => {
    const tries = opts?.tries ?? 30;
    const intervalMs = opts?.intervalMs ?? 500;

    const poll = (
      remaining: number
    ): Cypress.Chainable<Record<string, unknown> | null> =>
      cy
        .task<Record<string, unknown> | null>("getDoc", path)
        .then((doc) => {
          if (predicate(doc)) return cy.wrap(doc);
          if (remaining <= 0) {
            throw new Error(
              `pollDoc(${path}) predicate never satisfied. Last: ${JSON.stringify(
                doc
              )}`
            );
          }
          // eslint-disable-next-line cypress/no-unnecessary-waiting
          return cy.wait(intervalMs).then(() => poll(remaining - 1));
        });

    return poll(tries);
  }
);

Cypress.Commands.add(
  "pollStoryData",
  (
    path: string,
    uid: string,
    predicate: (rows: Record<string, unknown>[]) => boolean,
    opts?: { tries?: number; intervalMs?: number }
  ) => {
    const tries = opts?.tries ?? 30;
    const intervalMs = opts?.intervalMs ?? 500;

    const poll = (
      remaining: number
    ): Cypress.Chainable<Record<string, unknown>[]> =>
      cy
        .task<Record<string, unknown>[] | null>("storyData", { path, uid })
        .then((rows) => {
          const list = Array.isArray(rows) ? rows : [];
          if (predicate(list)) return cy.wrap(list);
          if (remaining <= 0) {
            throw new Error(
              `pollStoryData(${path}) predicate never satisfied. Count: ${list.length}`
            );
          }
          // eslint-disable-next-line cypress/no-unnecessary-waiting
          return cy.wait(intervalMs).then(() => poll(remaining - 1));
        });

    return poll(tries);
  }
);

Cypress.Commands.add(
  "pollDocs",
  (
    path: string,
    predicate: (docs: Record<string, unknown>[]) => boolean,
    opts?: { tries?: number; intervalMs?: number }
  ) => {
    const tries = opts?.tries ?? 30;
    const intervalMs = opts?.intervalMs ?? 500;

    const poll = (
      remaining: number
    ): Cypress.Chainable<Record<string, unknown>[]> =>
      cy
        .task<Record<string, unknown>[]>("listDocs", path)
        .then((docs) => {
          if (predicate(docs)) return cy.wrap(docs);
          if (remaining <= 0) {
            throw new Error(
              `pollDocs(${path}) predicate never satisfied. Count: ${docs.length}`
            );
          }
          // eslint-disable-next-line cypress/no-unnecessary-waiting
          return cy.wait(intervalMs).then(() => poll(remaining - 1));
        });

    return poll(tries);
  }
);

export {};
