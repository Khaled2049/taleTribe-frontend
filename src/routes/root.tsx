import { ArrowRight, Cloud, GitBranch, Moon, PenLine, Sun } from "lucide-react";
import { Link } from "react-router-dom";
import { SEOHead } from "@/components/seo/SEOHead";
import {
  OrganizationSchema,
  WebSiteSchema,
} from "@/components/seo/StructuredData";
import { APP_NAME, SEO_CONFIG } from "@/config/seo";
import { useTheme } from "@/contexts/ThemeContext";

const features = [
  {
    icon: PenLine,
    number: "01",
    title: "Immersive focus mode",
    description:
      "A quiet, uncluttered canvas that keeps the page in front of you and every distraction out of sight.",
    accent:
      "border-ns-accent bg-ns-accent-subtle text-ns-accent group-hover:bg-ns-accent group-hover:text-[var(--ns-bg)]",
  },
  {
    icon: Cloud,
    number: "02",
    title: "Cloud sync & Markdown",
    description:
      "Your work is saved as you write and ready wherever inspiration finds you. Import, export, and stay portable.",
    accent:
      "border-ns-teal-border bg-ns-teal-subtle text-ns-teal group-hover:border-ns-teal group-hover:bg-ns-teal group-hover:text-[var(--ns-bg)]",
  },
  {
    icon: GitBranch,
    number: "03",
    title: "Organized plotlines",
    description:
      "Keep chapters, characters, places, and story beats connected without leaving your manuscript behind.",
    accent:
      "border-ns-border-strong bg-ns-surface text-ns-gold group-hover:border-ns-gold group-hover:bg-ns-gold group-hover:text-[var(--ns-bg)]",
  },
] as const;

function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, toggleTheme } = useTheme();
  const nextTheme = theme === "light" ? "dark" : "light";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="group inline-flex items-center gap-2 font-ui text-xs font-medium text-ns-ink-secondary transition-colors duration-200 hover:text-ns-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-4 focus-visible:ring-offset-ns-bg"
      aria-label={`Switch to ${nextTheme} mode`}
      title={`Switch to ${nextTheme} mode`}
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-full border border-ns-border-strong bg-ns-surface transition-colors group-hover:border-ns-accent group-hover:text-ns-accent">
        {theme === "light" ? (
          <Moon className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <Sun className="h-3.5 w-3.5" aria-hidden="true" />
        )}
      </span>
      {!compact && <span>{theme === "light" ? "Dark" : "Light"} mode</span>}
    </button>
  );
}

export default function HomePage() {
  return (
    <>
      <SEOHead
        title={`${APP_NAME} — A quiet place to write`}
        description={`${APP_NAME} is a calm, focused writing workspace for drafting stories, organizing plotlines, and keeping every chapter in sync.`}
        keywords={[
          "distraction-free writing app",
          "novel writing software",
          "story organizer",
          "focus writing mode",
          "creative writing platform",
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
          <section className="relative isolate overflow-hidden px-5 pb-24 pt-24 text-center sm:px-8 sm:pb-32 sm:pt-32 lg:pb-40 lg:pt-40">
            <div
              className="pointer-events-none absolute left-1/2 top-[12%] -z-10 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-ns-accent-subtle blur-3xl sm:h-[38rem] sm:w-[38rem]"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute -right-28 bottom-12 -z-10 h-72 w-72 rounded-full bg-ns-teal-subtle blur-3xl sm:right-[3%]"
              aria-hidden="true"
            />

            <div className="mx-auto max-w-[970px]">
              <p className="mb-7 inline-flex items-center gap-3 font-ui text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-ns-accent sm:mb-9">
                <span className="h-px w-7 bg-ns-accent" aria-hidden="true" />
                A writing room of your own
                <span className="h-px w-7 bg-ns-accent" aria-hidden="true" />
              </p>
              <h1 className="font-heading text-[clamp(3.8rem,9vw,7.6rem)] font-normal leading-[0.88] tracking-[-0.055em] text-ns-ink">
                Write until the world
                <br className="hidden sm:block" /> goes{" "}
                <em className="font-normal text-ns-accent">quiet.</em>
              </h1>
              <p className="mx-auto mt-8 max-w-[610px] font-body text-lg leading-[1.7] text-ns-ink-secondary sm:mt-10 sm:text-xl">
                A calm, considered workspace for turning loose ideas into
                finished stories—without the noise that gets between you and the
                page.
              </p>

              <div className="mt-10 flex flex-col items-center justify-center gap-5 sm:mt-12 sm:flex-row">
                <Link
                  to="/sign-up"
                  className="group inline-flex min-w-[210px] items-center justify-center gap-3 rounded-full bg-ns-accent px-7 py-4 font-ui text-sm font-semibold text-[var(--ns-bg)] no-underline shadow-ns-glow transition-all duration-200 hover:-translate-y-0.5 hover:bg-ns-accent-hover hover:text-[var(--ns-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-4 focus-visible:ring-offset-ns-bg active:translate-y-0"
                >
                  Start writing free
                  <ArrowRight
                    className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </Link>
                <Link
                  to="/try"
                  className="group inline-flex items-center gap-2 border-b border-ns-border-strong pb-1 font-ui text-sm font-medium text-ns-ink-secondary no-underline transition-colors duration-200 hover:border-ns-teal hover:text-ns-teal"
                >
                  Explore the editor
                  <span
                    className="transition-transform duration-200 group-hover:translate-x-0.5"
                    aria-hidden="true"
                  >
                    ↗
                  </span>
                </Link>
              </div>

              <p className="mt-6 font-ui text-[0.7rem] tracking-wide text-ns-ink-muted">
                Your words remain yours.
              </p>
            </div>
          </section>

          <section
            id="features"
            className="scroll-mt-8 border-y border-ns-border bg-ns-surface"
            aria-labelledby="features-title"
          >
            <div className="mx-auto max-w-[1240px] px-5 sm:px-8 lg:px-10">
              <div className="flex flex-col gap-5 border-b border-ns-border py-12 sm:flex-row sm:items-end sm:justify-between sm:py-14">
                <div>
                  <p className="font-ui text-[0.66rem] font-semibold uppercase tracking-[0.22em] text-ns-teal">
                    Everything in its place
                  </p>
                  <h2
                    id="features-title"
                    className="mt-3 font-heading text-[clamp(2.3rem,5vw,3.8rem)] font-normal leading-none tracking-[-0.035em] text-ns-ink"
                  >
                    Tools that know when to disappear.
                  </h2>
                </div>
                <p className="max-w-[340px] font-body text-base leading-relaxed text-ns-ink-secondary">
                  Just enough structure to hold a whole world. Never enough to
                  interrupt the sentence you are writing.
                </p>
              </div>

              <div className="grid md:grid-cols-3">
                {features.map((feature, index) => {
                  const Icon = feature.icon;
                  return (
                    <article
                      key={feature.title}
                      className={`group py-12 md:min-h-[330px] md:px-9 md:py-14 lg:px-12 ${
                        index > 0
                          ? "border-t border-ns-border md:border-l md:border-t-0"
                          : ""
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`flex h-10 w-10 items-center justify-center rounded-full border transition-colors duration-300 ${feature.accent}`}
                        >
                          <Icon
                            className="h-[17px] w-[17px]"
                            aria-hidden="true"
                          />
                        </span>
                        <span className="font-ui text-[0.65rem] font-medium tracking-[0.16em] text-ns-ink-muted">
                          {feature.number}
                        </span>
                      </div>
                      <h3 className="mt-12 font-heading text-[1.85rem] font-medium leading-tight tracking-[-0.025em] text-ns-ink">
                        {feature.title}
                      </h3>
                      <p className="mt-4 max-w-[310px] font-body text-base leading-[1.7] text-ns-ink-secondary">
                        {feature.description}
                      </p>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="relative overflow-hidden px-5 py-24 text-center sm:px-8 sm:py-32">
            <div
              className="pointer-events-none absolute bottom-[-8rem] left-1/2 h-64 w-[38rem] -translate-x-1/2 rounded-full bg-ns-accent-subtle blur-3xl"
              aria-hidden="true"
            />
            <p className="relative mx-auto max-w-2xl font-heading text-[clamp(2.4rem,5vw,4.25rem)] font-normal leading-[1.03] tracking-[-0.035em] text-ns-ink">
              The blank page is waiting.
              <br />
              <span className="italic text-ns-gold">
                Meet it without the clutter.
              </span>
            </p>
            <Link
              to="/sign-up"
              className="group relative mt-9 inline-flex items-center gap-3 font-ui text-sm font-semibold text-ns-accent no-underline transition-colors hover:text-ns-accent-hover"
            >
              Begin your first chapter
              <ArrowRight
                className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1"
                aria-hidden="true"
              />
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

            <div className="sm:hidden">
              <ThemeToggle compact />
            </div>
            <div className="hidden sm:block">
              <ThemeToggle />
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
