import { Link } from "react-router-dom";
import { SEOHead } from "@/components/seo/SEOHead";
import { APP_NAME } from "@/config/seo";
import {
  LEGAL_UPDATED,
  LEGAL_VERSION,
  SUPPORT_EMAIL,
  type LegalSection,
} from "@/config/legal";

export function LegalDocument({
  title,
  path,
  introduction,
  sections,
}: {
  title: string;
  path: string;
  introduction: string;
  sections: LegalSection[];
}) {
  return (
    <main className="min-h-screen bg-neutral-50 dark:bg-black text-black dark:text-white px-4 py-10">
      <SEOHead
        title={`${title} - ${APP_NAME}`}
        description={introduction}
        url={path}
        canonical={path}
      />
      <article className="max-w-3xl mx-auto space-y-8">
        <header className="space-y-4">
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="text-sm text-black/60 dark:text-white/60">
            Last updated: {LEGAL_UPDATED} · Version {LEGAL_VERSION}
          </p>
          <p className="text-lg leading-relaxed">{introduction}</p>
          <nav
            aria-label="Legal and support pages"
            className="flex flex-wrap gap-4 text-sm underline"
          >
            <Link to="/terms-of-use">Terms of Use</Link>
            <Link to="/privacy-policy">Privacy Policy</Link>
            <Link to="/help#copyright">Copyright reports</Link>
            <Link to="/help#privacy">Privacy requests</Link>
          </nav>
        </header>
        <nav
          aria-label="On this page"
          className="rounded-xl border border-black/10 dark:border-white/10 p-5"
        >
          <h2 className="font-semibold mb-3">On this page</h2>
          <ol className="list-decimal pl-5 space-y-2 text-sm">
            {sections.map((section, i) => (
              <li key={section.title}>
                <a className="underline" href={`#section-${i + 1}`}>
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        {sections.map((section, i) => (
          <section
            id={`section-${i + 1}`}
            key={section.title}
            className="scroll-mt-24 space-y-3"
          >
            <h2 className="text-xl font-semibold">
              {i + 1}. {section.title}
            </h2>
            {section.paragraphs.map((paragraph) => (
              <p
                key={paragraph}
                className="leading-relaxed text-black/80 dark:text-white/80"
              >
                {paragraph}
              </p>
            ))}
          </section>
        ))}
        <footer className="border-t border-black/10 dark:border-white/10 pt-6">
          Questions or requests?{" "}
          <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>
        </footer>
      </article>
    </main>
  );
}
