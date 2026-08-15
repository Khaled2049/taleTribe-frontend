import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { motion, useInView } from "framer-motion";
import { ArrowRight, BookOpen } from "lucide-react";
import { SEOHead } from "@/components/seo/SEOHead";
import {
  WebSiteSchema,
  OrganizationSchema,
} from "@/components/seo/StructuredData";
import { APP_NAME, SEO_CONFIG } from "@/config/seo";

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const values = [
  {
    num: "01",
    heading: "Your work, your audience.",
    body: "Publish stories directly to readers who discover and follow your writing. No gatekeepers. No algorithms deciding your worth.",
  },
  {
    num: "02",
    heading: "A community of craft.",
    body: "Connect with writers and readers who take independent storytelling seriously. Critique, encourage, and grow together.",
  },
  {
    num: "03",
    heading: "Earn from your words.",
    body: "Readers can tip the stories that move them — supporting the writers they love, directly and immediately.",
  },
];

const experience = [
  {
    label: "Write",
    heading: "A canvas as serious as your ambition.",
    body: "Draft chapters in a focused editor built for long-form storytelling. Keep your characters, places, and plot notes always within reach.",
  },
  {
    label: "Share",
    heading: "Stories find their readers here.",
    body: "Publish chapters as you write. Build a following chapter by chapter. Your audience grows with your work.",
  },
  {
    label: "Belong",
    heading: "Independent doesn't mean alone.",
    body: "Join a community that reads, writes, and talks about craft. Competitions, book clubs, and feedback loops for every stage of your work.",
  },
];

/* ------------------------------------------------------------------ */
/*  Animation variants                                                 */
/* ------------------------------------------------------------------ */

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.75,
      delay: i * 0.1,
      ease: [0.16, 1, 0.3, 1],
    },
  }),
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: (i: number = 0) => ({
    opacity: 1,
    transition: {
      duration: 0.9,
      delay: i * 0.12,
      ease: [0.4, 0, 0.2, 1],
    },
  }),
};

/* ------------------------------------------------------------------ */
/*  Scroll-triggered section wrapper                                   */
/* ------------------------------------------------------------------ */

function Section({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.section
      ref={ref}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      className={className}
    >
      {children}
    </motion.section>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuthContext();

  return (
    <>
      <SEOHead
        title={`${APP_NAME} — Where Your Stories Live`}
        description="TheTaleTribe is where writers write, publish, and build a presence around their work. Join a community of writers and readers who take independent storytelling seriously."
        keywords={[
          "indie authors",
          "story writing platform",
          "author community",
          "independent publishing",
          "writing community",
          "novel writing",
          "storytelling",
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

      <div className="min-h-screen bg-ns-bg text-ns-ink ns-grain overflow-x-hidden">
        {/* ============================================================ */}
        {/*  HERO                                                         */}
        {/* ============================================================ */}
        <section className="relative min-h-[92svh] flex flex-col justify-center">
          {/* Brand accent line — the singular visual signature */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-ns-accent" />

          <div className="max-w-5xl mx-auto px-5 sm:px-8 lg:px-12 w-full py-24">
            {/* Overline */}
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.6,
                delay: 0.15,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="font-ui text-overline text-ns-ink-muted mb-8"
            >
              For independent authors
            </motion.p>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.9,
                delay: 0.3,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="font-heading text-[clamp(3.2rem,8vw,6.5rem)] leading-[0.92] tracking-tight mb-8 max-w-4xl"
            >
              Where your
              <br />
              <span className="italic text-ns-accent">stories live.</span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.7,
                delay: 0.5,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="font-body text-body-lg text-ns-ink-secondary max-w-md leading-relaxed mb-12"
            >
              Write your stories. Publish to readers who care.
              <br />
              Build a presence that's entirely yours.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.6,
                delay: 0.68,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="flex flex-wrap gap-4 items-center"
            >
              {!user && (
                <button
                  onClick={() => navigate("/sign-up")}
                  className="group inline-flex items-center gap-2.5 rounded-full bg-ns-accent hover:bg-ns-accent-hover text-white px-8 py-3.5 font-ui font-semibold transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                >
                  Start Writing
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                </button>
              )}
              <button
                onClick={() => navigate("/stories")}
                className="inline-flex items-center gap-2.5 rounded-full border border-ns-border-strong bg-transparent hover:bg-ns-surface px-8 py-3.5 font-ui font-semibold text-ns-ink transition-all duration-300"
              >
                Explore Stories
                <BookOpen className="h-4 w-4" />
              </button>
            </motion.div>
          </div>

          {/* Scroll hint */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.4, duration: 1 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center"
          >
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              className="w-[1px] h-8 bg-gradient-to-b from-ns-ink-muted to-transparent"
            />
          </motion.div>
        </section>

        {/* ============================================================ */}
        {/*  BRAND / VALUE — Three numbered statements, no cards         */}
        {/* ============================================================ */}
        <Section className="border-t border-ns-border">
          <div className="max-w-5xl mx-auto px-5 sm:px-8 lg:px-12 py-24 sm:py-32">
            <motion.p
              variants={fadeIn}
              className="font-ui text-overline text-ns-ink-muted mb-16"
            >
              What we're about
            </motion.p>

            <div>
              {values.map((item, i) => (
                <motion.div
                  key={item.num}
                  variants={fadeUp}
                  custom={i}
                  className="group grid grid-cols-[5rem_1fr] sm:grid-cols-[8rem_1fr] gap-6 sm:gap-12 py-10 sm:py-12 border-t border-ns-border first:border-t-0"
                >
                  {/* Ghost number */}
                  <span
                    aria-hidden
                    className="font-heading text-[3.5rem] sm:text-[5.5rem] leading-none text-ns-ink/[0.05] select-none tabular-nums pt-1 transition-colors duration-500 group-hover:text-ns-ink/[0.1]"
                  >
                    {item.num}
                  </span>

                  {/* Content */}
                  <div className="pt-1 sm:pt-3">
                    <h3 className="font-heading text-[clamp(1.4rem,3vw,2rem)] leading-tight tracking-tight mb-3">
                      {item.heading}
                    </h3>
                    <p className="font-body text-body text-ns-ink-secondary leading-relaxed max-w-prose">
                      {item.body}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </Section>

        {/* ============================================================ */}
        {/*  EXPERIENCE — Alternating editorial text blocks, no cards    */}
        {/* ============================================================ */}
        <Section className="border-t border-ns-border bg-ns-surface/30">
          <div className="max-w-5xl mx-auto px-5 sm:px-8 lg:px-12 py-24 sm:py-32">
            <motion.p
              variants={fadeIn}
              className="font-ui text-overline text-ns-ink-muted mb-20"
            >
              The experience
            </motion.p>

            {experience.map((item, i) => {
              const isRight = i % 2 !== 0;
              return (
                <motion.div
                  key={item.label}
                  variants={fadeUp}
                  custom={i * 0.4}
                  className={`py-14 sm:py-20 border-t border-ns-border flex ${
                    isRight ? "justify-end" : "justify-start"
                  }`}
                >
                  <div className={`max-w-lg ${isRight ? "text-right" : ""}`}>
                    <p
                      className={`font-ui text-overline text-ns-accent mb-5 ${
                        isRight ? "text-right" : ""
                      }`}
                    >
                      {item.label}
                    </p>
                    <h3 className="font-heading text-[clamp(1.8rem,4vw,2.75rem)] italic leading-tight tracking-tight mb-5 text-ns-ink">
                      {item.heading}
                    </h3>
                    <p className="font-body text-body text-ns-ink-secondary leading-relaxed">
                      {item.body}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </Section>

        {/* ============================================================ */}
        {/*  SOCIAL PROOF — Pull-quote, no cards                         */}
        {/* ============================================================ */}
        <Section className="border-t border-b border-ns-border">
          <div className="max-w-5xl mx-auto px-5 sm:px-8 lg:px-12 py-24 sm:py-32 text-center">
            <motion.blockquote
              variants={fadeUp}
              className="font-heading text-[clamp(1.6rem,4vw,2.75rem)] italic leading-snug tracking-tight text-ns-ink max-w-3xl mx-auto mb-10"
            >
              "For writers who publish without permission.
              <br className="hidden sm:block" /> For readers who want something
              real."
            </motion.blockquote>

            <motion.div
              variants={fadeIn}
              custom={1}
              className="flex items-center justify-center gap-4"
            >
              <div className="h-px w-10 bg-ns-border-strong" />
              <p className="font-ui text-overline text-ns-ink-muted">
                Thousands of stories. One community.
              </p>
              <div className="h-px w-10 bg-ns-border-strong" />
            </motion.div>
          </div>
        </Section>

        {/* ============================================================ */}
        {/*  FINAL CTA                                                   */}
        {/* ============================================================ */}
        <Section className="relative">
          <div className="max-w-5xl mx-auto px-5 sm:px-8 lg:px-12 py-28 sm:py-36 text-center">
            <motion.h2
              variants={fadeUp}
              className="font-heading text-[clamp(2.5rem,6vw,5rem)] leading-[0.95] tracking-tight mb-6"
            >
              Your story
              <br />
              <span className="italic text-ns-accent">belongs here.</span>
            </motion.h2>

            <motion.p
              variants={fadeUp}
              custom={1}
              className="font-body text-body-lg text-ns-ink-secondary mb-12 max-w-xs mx-auto leading-relaxed"
            >
              Start writing today.
              <br />
              Your first chapter is waiting.
            </motion.p>

            <motion.div variants={fadeUp} custom={2}>
              <button
                onClick={() => navigate("/sign-up")}
                className="group inline-flex items-center gap-2.5 rounded-full bg-ns-ink text-[var(--ns-bg)] hover:opacity-85 px-10 py-4 font-ui font-semibold transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
              >
                Join {APP_NAME}
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
              </button>
            </motion.div>
          </div>

          {/* Bottom accent mirror */}
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-ns-accent opacity-25" />
        </Section>
      </div>
    </>
  );
}
