export { Modal } from "./Modal";
export { ConfirmDialog, UnsavedChangesDialog } from "./ConfirmDialog";
export { default as CollapsibleDiv } from "./CollapsibleDiv";
export { ThemeToggle } from "./ThemeToggle";
export { ThemeToaster } from "./ThemeToaster";
export { SlideOverPanel } from "./SlideOverPanel";
export * as Icons from "./Icons";
export { default as SignInPrompt } from "./SignInPrompt";
export { default as SearchField } from "./SearchField";
export { TagMultiSelect } from "./TagMultiSelect";
export { RouteError } from "./RouteError";
export { AuthorName } from "./AuthorName";
export { default as FollowButton } from "./FollowButton";

// Not re-exported: BookSearch reaches RateLimitService, which opens a
// Firestore collection at module load. Rollup cannot drop that side effect, so
// re-exporting it here puts Firestore in every route that uses this barrel.
// Import it from "./BookSearch" directly.
