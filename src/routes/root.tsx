import { Link } from "react-router-dom";
import { SEOHead } from "@/components/seo/SEOHead";
import {
  OrganizationSchema,
  WebSiteSchema,
} from "@/components/seo/StructuredData";
import { APP_NAME, SEO_CONFIG } from "@/config/seo";
import { CoWriteDemo } from "./Home/CoWriteDemo";
import { FeatureDesk } from "./Home/FeatureDesk";
import { StoryShelf } from "./Home/StoryShelf";

const primaryButton =
  "inline-flex items-center justify-center rounded-full bg-ns-accent px-7 py-3.5 font-ui text-sm font-semibold text-[var(--ns-bg)] no-underline shadow-ns-glow transition-colors duration-200 hover:bg-ns-accent-hover hover:text-[var(--ns-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-4 focus-visible:ring-offset-ns-bg";

export default function HomePage() {
  return (
    <>
      <SEOHead
        title={`${APP_NAME} — Write, read and share stories`}
        description={`${APP_NAME} is a place to write stories with an AI assistant that knows your world, enter writing competitions, join book clubs and find your next read.`}
        keywords={[
          "novel writing software",
          "AI story assistant",
          "writing competitions",
          "online book clubs",
          "read stories online",
        ]}
        url="/"
        type="website"
      />
      <WebSiteSchema
        potentialAction={{
          "@type": "SearchAction",
          target: `${SEO_CONFIG.siteUrl}/stories?q={search_term_string}`,
          "query-input": "required name=search_term_string",
        }}
      />
      <OrganizationSchema />

      <div className="min-h-screen bg-ns-bg text-ns-ink transition-colors duration-300">
        <main>
          <section className="overflow-hidden px-5 pb-20 pt-12 sm:px-8 sm:pt-16 lg:pb-24">
            <div className="mx-auto max-w-[1180px]">
              <h1 className="font-heading text-[clamp(2.8rem,6vw,4.6rem)] font-normal leading-[0.95] tracking-[-0.04em] text-ns-ink">
                Write what happens next.
              </h1>
              <p className="mt-3 font-body text-xl leading-[1.5] text-ns-ink-secondary">
                Write stories, read them, and argue about them with friends.
              </p>
              <div className="mt-10 lg:mt-12">
                <StoryShelf />
              </div>
            </div>
          </section>

          <section
            className="border-y border-ns-border bg-ns-bg px-5 py-20 sm:px-8 lg:py-28"
            aria-labelledby="features-title"
          >
            <div className="mx-auto max-w-[1180px]">
              <h2
                id="features-title"
                className="mb-10 font-heading text-[clamp(2.2rem,4.5vw,3.4rem)] font-normal leading-none tracking-[-0.03em] text-ns-ink lg:mb-14"
              >
                Everything a story needs.
              </h2>
              <FeatureDesk />
            </div>
          </section>

          <section
            className="px-5 py-20 sm:px-8 lg:py-28"
            aria-labelledby="cowrite-title"
          >
            <div className="mx-auto grid max-w-[1180px] items-center gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-20">
              <div>
                <h2
                  id="cowrite-title"
                  className="font-heading text-[clamp(2.2rem,4.5vw,3.4rem)] font-normal leading-none tracking-[-0.03em] text-ns-ink"
                >
                  Stuck? Pick a path.
                </h2>
                <p className="mt-4 max-w-[30ch] font-body text-lg leading-relaxed text-ns-ink-secondary">
                  The story assistant suggests what could happen next. You
                  choose, or write your own.
                </p>
              </div>
              <CoWriteDemo />
            </div>
          </section>

          <section className="bg-ns-ink px-5 py-20 text-center sm:px-8 sm:py-28">
            <p className="mx-auto max-w-[16ch] font-heading text-[clamp(2.6rem,6vw,4.8rem)] font-normal leading-[0.98] tracking-[-0.035em] text-ns-bg">
              The next line is yours.
            </p>
            <Link to="/sign-up" className={`${primaryButton} mt-10`}>
              Create your free account
            </Link>
          </section>
        </main>

        <footer className="border-t border-ns-border">
          <div className="mx-auto flex max-w-[1240px] flex-col gap-6 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-ui text-xs text-ns-ink-secondary">
              <span>
                © {new Date().getFullYear()} {APP_NAME}
              </span>
              <Link
                to="/privacy-policy"
                className="text-inherit no-underline transition-colors hover:text-ns-accent"
              >
                Privacy
              </Link>
              <Link
                to="/terms-of-use"
                className="text-inherit no-underline transition-colors hover:text-ns-accent"
              >
                Terms
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
