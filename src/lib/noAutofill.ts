// Story fields (a plot line's "Name") look like contact forms to password
// managers. autoComplete="off" is ignored by most extensions, so each one's
// own opt-out is listed: 1Password, LastPass, Bitwarden, Dashlane, Proton Pass.
export const NO_AUTOFILL = {
  autoComplete: "off",
  "data-1p-ignore": "true",
  "data-lpignore": "true",
  "data-bwignore": "true",
  "data-form-type": "other",
  "data-protonpass-ignore": "true",
} as const;
