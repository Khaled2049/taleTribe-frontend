// Recommendation shelves. The service behind these is taleTribe-recs; the
// browser reaches it only through the `recommendStories` /
// `explainRecommendations` Firebase Functions. See
// `recommendation_engine/docs/frontend-integration.md` in that repo for the
// full path, and `runbook.md` there when a shelf is empty or missing.
export { default as RecommendationCollection } from "./RecommendationCollection";
