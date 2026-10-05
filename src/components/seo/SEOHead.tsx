import React from "react";
import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";
import { SEO_CONFIG, truncateDescription, getAbsoluteUrl } from "@/config/seo";

export interface SEOHeadProps {
  title?: string;
  description?: string;
  keywords?: string[];
  image?: string;
  /** Canonical path. Defaults to the current path without its query string. */
  url?: string;
  type?: "website" | "article" | "book" | "profile";
  author?: string;
  publishedTime?: string;
  modifiedTime?: string;
  noindex?: boolean;
  nofollow?: boolean;
  /** Overrides `url` when the canonical is a different page than this one. */
  canonical?: string;
  structuredData?: object | object[];
}

/**
 * SEOHead Component
 * Manages meta tags, Open Graph, and Twitter Cards for SEO.
 *
 * For story, profile and listing routes the seoRender Function has already
 * written these tags into the document; Helmet adopts them (they carry
 * data-rh) and keeps them current across client-side navigation.
 */
export const SEOHead: React.FC<SEOHeadProps> = ({
  title,
  description,
  keywords,
  image,
  url,
  type = "website",
  author,
  publishedTime,
  modifiedTime,
  noindex = false,
  nofollow = false,
  canonical,
  structuredData,
}) => {
  const { pathname } = useLocation();

  const pageTitle = !title
    ? SEO_CONFIG.defaultTitle
    : title.includes(SEO_CONFIG.siteName)
      ? title
      : `${title} | ${SEO_CONFIG.siteName}`;
  const pageDescription = description
    ? truncateDescription(description)
    : SEO_CONFIG.defaultDescription;
  const pageKeywords = keywords
    ? [...SEO_CONFIG.defaultKeywords, ...keywords].join(", ")
    : SEO_CONFIG.defaultKeywords.join(", ");
  const pageImage = getAbsoluteUrl(image || SEO_CONFIG.defaultImage);
  const canonicalUrl = getAbsoluteUrl(
    canonical || url || pathname.replace(/(.)\/+$/, "$1"),
  );

  const robotsContent = [
    noindex ? "noindex" : "index",
    nofollow ? "nofollow" : "follow",
    ...(noindex ? [] : ["max-image-preview:large"]),
  ].join(", ");

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{pageTitle}</title>
      <meta name="description" content={pageDescription} />
      <meta name="keywords" content={pageKeywords} />
      <meta name="author" content={author || SEO_CONFIG.author} />
      <meta name="robots" content={robotsContent} />
      {/* A noindex page names no canonical: the two signals contradict. */}
      {!noindex && <link rel="canonical" href={canonicalUrl} />}
      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={pageDescription} />
      <meta property="og:image" content={pageImage} />
      <meta property="og:site_name" content={SEO_CONFIG.siteName} />
      <meta property="og:locale" content={SEO_CONFIG.locale} />
      {publishedTime && (
        <meta property="article:published_time" content={publishedTime} />
      )}
      {modifiedTime && (
        <meta property="article:modified_time" content={modifiedTime} />
      )}
      {SEO_CONFIG.facebookAppId && (
        <meta property="fb:app_id" content={SEO_CONFIG.facebookAppId} />
      )}
      {/* A caller's image is a portrait cover or avatar, which the large card crops. */}
      <meta
        name="twitter:card"
        content={image ? "summary" : "summary_large_image"}
      />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={pageDescription} />
      <meta name="twitter:image" content={pageImage} />
      {SEO_CONFIG.twitterHandle && (
        <meta name="twitter:site" content={`@${SEO_CONFIG.twitterHandle}`} />
      )}
      {/* Structured Data (JSON-LD) */}
      {structuredData && (
        <script type="application/ld+json">
          {JSON.stringify(
            Array.isArray(structuredData) ? structuredData : [structuredData],
          )}
        </script>
      )}
    </Helmet>
  );
};
