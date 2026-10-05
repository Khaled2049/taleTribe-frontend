import React from "react";
import { Helmet } from "react-helmet-async";
import { SEO_CONFIG, getAbsoluteUrl } from "@/config/seo";

export interface OrganizationSchemaProps {
  name?: string;
  url?: string;
  logo?: string;
  description?: string;
  sameAs?: string[]; // Social media URLs
}

export interface WebSiteSchemaProps {
  url?: string;
  name?: string;
  potentialAction?: {
    "@type": "SearchAction";
    target: string;
    "query-input": string;
  };
}

export interface ArticleSchemaProps {
  headline: string;
  description?: string;
  image?: string;
  datePublished: string;
  dateModified?: string;
  author: {
    name: string;
    url?: string;
  };
  publisher?: {
    name: string;
    logo?: string;
  };
  url?: string;
}

export interface BookSchemaProps {
  name: string;
  description?: string;
  author: string | Array<{ name: string }>;
  image?: string;
  datePublished?: string;
  publisher?: string;
  numberOfPages?: number;
  aggregateRating?: {
    ratingValue: number;
    ratingCount: number;
  };
  url?: string;
}

export interface BreadcrumbSchemaProps {
  items: Array<{
    name: string;
    url: string;
  }>;
}

/**
 * Organization Structured Data Component
 */
export const OrganizationSchema: React.FC<OrganizationSchemaProps> = ({
  name = SEO_CONFIG.siteName,
  url = SEO_CONFIG.siteUrl,
  logo = getAbsoluteUrl(SEO_CONFIG.defaultImage),
  description = SEO_CONFIG.defaultDescription,
  sameAs = [],
}) => {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name,
    url,
    logo,
    description,
    ...(sameAs.length > 0 && { sameAs }),
  };

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(schema)}</script>
    </Helmet>
  );
};

/**
 * WebSite Structured Data Component
 * Includes search functionality schema
 */
export const WebSiteSchema: React.FC<WebSiteSchemaProps> = ({
  url = SEO_CONFIG.siteUrl,
  name = SEO_CONFIG.siteName,
  potentialAction,
}) => {
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name,
    url,
    ...(potentialAction && { potentialAction }),
  };

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(schema)}</script>
    </Helmet>
  );
};

/**
 * Article Structured Data Component
 */
export const ArticleSchema: React.FC<ArticleSchemaProps> = ({
  headline,
  description,
  image,
  datePublished,
  dateModified,
  author,
  publisher = {
    name: SEO_CONFIG.siteName,
    logo: getAbsoluteUrl(SEO_CONFIG.defaultImage),
  },
  url,
}) => {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline,
    ...(description && { description }),
    ...(image && { image }),
    datePublished,
    ...(dateModified && { dateModified }),
    author: {
      "@type": "Person",
      name: author.name,
      ...(author.url && { url: author.url }),
    },
    publisher: {
      "@type": "Organization",
      name: publisher.name,
      ...(publisher.logo && {
        logo: {
          "@type": "ImageObject",
          url: publisher.logo,
        },
      }),
    },
    ...(url && { url }),
  };

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(schema)}</script>
    </Helmet>
  );
};

/**
 * Book Structured Data Component
 */
export const BookSchema: React.FC<BookSchemaProps> = ({
  name,
  description,
  author,
  image,
  datePublished,
  publisher,
  numberOfPages,
  aggregateRating,
  url,
}) => {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Book",
    name,
    ...(description && { description }),
    author: Array.isArray(author)
      ? author.map((a) => ({
          "@type": "Person",
          name: typeof a === "string" ? a : a.name,
        }))
      : {
          "@type": "Person",
          name: author,
        },
    ...(image && { image }),
    ...(datePublished && { datePublished }),
    ...(publisher && {
      publisher: {
        "@type": "Organization",
        name: publisher,
      },
    }),
    ...(numberOfPages && { numberOfPages }),
    ...(aggregateRating && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: aggregateRating.ratingValue,
        ratingCount: aggregateRating.ratingCount,
      },
    }),
    ...(url && { url }),
  };

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(schema)}</script>
    </Helmet>
  );
};

/**
 * Breadcrumb Structured Data Component
 */
export const BreadcrumbSchema: React.FC<BreadcrumbSchemaProps> = ({
  items,
}) => {
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: getAbsoluteUrl(item.url),
    })),
  };

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(schema)}</script>
    </Helmet>
  );
};
