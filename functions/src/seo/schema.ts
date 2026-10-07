/** schema.org JSON-LD for public pages. */
import { absoluteUrl, siteName, siteUrl } from "./site";
import { chapterPath, profilePath, storyPath } from "./paths";
import type { PublicChapter, PublicProfile, PublicStory } from "./storyData";

const CONTEXT = "https://schema.org";
const BCP47 = /^[a-z]{2,3}(-[a-z0-9]{2,8})*$/i;
const MAX_LISTED_PARTS = 100;

export interface Crumb {
  name: string;
  path: string;
}

export const breadcrumbs = (crumbs: Crumb[]) => ({
  "@context": CONTEXT,
  "@type": "BreadcrumbList",
  itemListElement: crumbs.map((crumb, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: crumb.name,
    item: absoluteUrl(crumb.path),
  })),
});

const publisher = () => ({ "@type": "Organization", name: siteName(), url: siteUrl() });

const author = (story: PublicStory) => ({
  "@type": "Person",
  name: story.authorName,
  url: absoluteUrl(profilePath(story.authorId)),
});

const storyUrl = (story: PublicStory) => absoluteUrl(storyPath(story.id, story.title));

export function book(story: PublicStory, chapters: PublicChapter[], image: string) {
  return {
    "@context": CONTEXT,
    "@type": "Book",
    "@id": storyUrl(story),
    url: storyUrl(story),
    name: story.title,
    ...(story.description && { description: story.description }),
    image,
    author: author(story),
    publisher: publisher(),
    datePublished: story.createdAt,
    dateModified: story.updatedAt,
    bookFormat: "https://schema.org/EBook",
    isAccessibleForFree: true,
    ...(story.category && { genre: story.category }),
    ...(story.tags.length > 0 && { keywords: story.tags.join(", ") }),
    ...(BCP47.test(story.language) && { inLanguage: story.language }),
    // Google rejects an aggregateRating with no ratings behind it.
    ...(story.averageRating && story.ratingsCount > 0 && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: story.averageRating,
        ratingCount: story.ratingsCount,
        bestRating: 5,
        worstRating: 1,
      },
    }),
    interactionStatistic: [
      { "@type": "InteractionCounter", interactionType: "https://schema.org/ReadAction", userInteractionCount: story.views },
      { "@type": "InteractionCounter", interactionType: "https://schema.org/LikeAction", userInteractionCount: story.likeCount },
    ],
    ...(chapters.length > 0 && {
      hasPart: chapters.slice(0, MAX_LISTED_PARTS).map((chapter, index) => ({
        "@type": "Chapter",
        name: chapter.title,
        position: index + 1,
        url: absoluteUrl(chapterPath(story.id, story.title, chapter.id)),
      })),
    }),
  };
}

export function chapter(story: PublicStory, item: PublicChapter, position: number) {
  return {
    "@context": CONTEXT,
    "@type": "Chapter",
    url: absoluteUrl(chapterPath(story.id, story.title, item.id)),
    name: item.title,
    position,
    author: author(story),
    publisher: publisher(),
    dateModified: item.updatedAt,
    isAccessibleForFree: true,
    isPartOf: { "@type": "Book", "@id": storyUrl(story), name: story.title, url: storyUrl(story) },
  };
}

/** storyCount is omitted when the listing was truncated and the total is unknown. */
export function profilePage(profile: PublicProfile, storyCount?: number) {
  const url = absoluteUrl(profilePath(profile.userId));
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(" ");
  return {
    "@context": CONTEXT,
    "@type": "ProfilePage",
    url,
    dateCreated: profile.createdAt,
    dateModified: profile.updatedAt,
    mainEntity: {
      "@type": "Person",
      "@id": url,
      name: fullName || profile.username,
      alternateName: profile.username,
      identifier: profile.userId,
      url,
      ...(profile.bio && { description: profile.bio }),
      ...(profile.photoUrl && { image: absoluteUrl(profile.photoUrl) }),
      interactionStatistic: [
        { "@type": "InteractionCounter", interactionType: "https://schema.org/FollowAction", userInteractionCount: profile.followerCount },
      ],
      ...(storyCount !== undefined && {
        agentInteractionStatistic: {
          "@type": "InteractionCounter",
          interactionType: "https://schema.org/WriteAction",
          userInteractionCount: storyCount,
        },
      }),
    },
  };
}

export function collectionPage(name: string, description: string, path: string, stories: PublicStory[]) {
  return {
    "@context": CONTEXT,
    "@type": "CollectionPage",
    url: absoluteUrl(path),
    name,
    description,
    isPartOf: { "@type": "WebSite", name: siteName(), url: siteUrl() },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: stories.length,
      itemListElement: stories.map((story, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: story.title,
        url: storyUrl(story),
      })),
    },
  };
}
