import { Link } from "react-router-dom";
import { SEOHead } from "@/components/seo/SEOHead";
import { APP_NAME } from "@/config/seo";
import { SUPPORT_EMAIL } from "@/config/legal";

function emailLink(subject: string) {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}

const faqs = [
  [
    "How do I start writing or import a story?",
    "Choose New Story from your story workspace. Before creating, importing, or editing, review the current Terms of Use and Privacy Policy and confirm your age and content rights. For imports, use a supported plain text file. The agreement applies to future contributions, including cover images.",
  ],
  [
    "Do I keep ownership of my writing?",
    "You keep the rights you hold in your work. We receive a limited license to operate the service and provide the features you request. Only upload text and images you own, have permission to use, or otherwise have a lawful basis to use. Crediting the original author does not automatically make copying lawful.",
  ],
  [
    "Does AI guarantee that a story is original?",
    "No. AI can produce errors or passages similar to existing work. Review and edit output and check permissions before publishing. The service does not certify plagiarism checks, copyright ownership, or eligibility for copyright protection.",
  ],
  [
    "Who can see my draft, and what goes to AI providers?",
    "Unpublished stories are not in public story listings. Service infrastructure still processes them, and story indexing and AI features can send relevant content to model or embedding providers. Publishing makes content available to readers. The Privacy Policy explains this processing and public visibility.",
  ],
  [
    "Can I change or remove a published story?",
    "Use your story workspace to edit, unpublish, or delete your stories. Changes cannot recall copies made by readers, search engines, or other services. Keep a separate backup of important work.",
  ],
  [
    "How do I get help with credits, billing, or a wallet transaction?",
    "Email support with the time, feature, error message, and relevant transaction or request ID. Check addresses and the network before approving wallet transactions: on-chain activity may be public and irreversible. Never send passwords, API keys, private keys, or seed phrases.",
  ],
  [
    "How do I appeal a moderation action?",
    "Email support with the affected URL or content ID, your account email, and why you believe the action was mistaken. Include permissions or other relevant evidence without sending unnecessary personal information. Copyright removals may require a formal counter-notice; see the instructions below.",
  ],
];

export default function HelpSupport() {
  return (
    <main className="min-h-screen bg-neutral-50 dark:bg-black text-black dark:text-white px-4 py-10">
      <SEOHead
        title={`Help & Support - ${APP_NAME}`}
        description="Help with writing, account privacy, copyright reports, safety, and billing."
        url="/help"
        canonical="/help"
      />
      <div className="max-w-3xl mx-auto space-y-10">
        <header className="space-y-4">
          <h1 className="text-3xl font-bold">Help & Support</h1>
          <p className="text-lg">
            Get help with your writing, report a rights or safety concern, or
            make a privacy request.
          </p>
          <p>
            Email{" "}
            <a className="underline" href={emailLink("TheTaleTribe support")}>
              {SUPPORT_EMAIL}
            </a>
            . This is a small independently operated service; support is handled
            by email.
          </p>
          <nav
            aria-label="Support topics"
            className="flex flex-wrap gap-4 text-sm underline"
          >
            <a href="#copyright">Copyright reports</a>
            <a href="#safety">Safety reports</a>
            <a href="#privacy">Privacy & deletion</a>
            <Link to="/terms-of-use">Terms of Use</Link>
            <Link to="/privacy-policy">Privacy Policy</Link>
          </nav>
        </header>
        <section aria-labelledby="faq-title" className="space-y-3">
          <h2 id="faq-title" className="text-2xl font-semibold">
            Common questions
          </h2>
          {faqs.map(([question, answer]) => (
            <details
              key={question}
              className="rounded-lg border border-black/10 dark:border-white/10 p-4"
            >
              <summary className="font-semibold cursor-pointer">
                {question}
              </summary>
              <p className="mt-3 leading-relaxed text-black/75 dark:text-white/75">
                {answer}
              </p>
            </details>
          ))}
        </section>
        <section id="copyright" className="scroll-mt-24 space-y-4">
          <h2 className="text-2xl font-semibold">
            Report copyright infringement
          </h2>
          <p>
            If you own a copyright or are authorized to act for its owner, send
            a notice to{" "}
            <a
              className="underline"
              href={emailLink("Copyright infringement notice")}
            >
              {SUPPORT_EMAIL}
            </a>{" "}
            with the subject “Copyright infringement notice.” Include:
          </p>
          <ol className="list-decimal pl-6 space-y-2">
            <li>
              Your physical or electronic signature and whether you are the
              owner or an authorized representative.
            </li>
            <li>
              Identification of the copyrighted work, or a representative list
              if multiple works are involved.
            </li>
            <li>
              The specific URLs or other information sufficient to locate each
              item you claim is infringing.
            </li>
            <li>
              Your name, mailing address, telephone number, and email address.
            </li>
            <li>
              A statement that you have a good-faith belief that the use is not
              authorized by the copyright owner, its agent, or the law.
            </li>
            <li>
              A statement that the information is accurate and, under penalty of
              perjury, that you are authorized to act for the owner of the
              exclusive right allegedly infringed.
            </li>
          </ol>
          <p>
            Consider whether the use is authorized or permitted by law,
            including fair use, before reporting. Knowingly misrepresenting
            infringement can have legal consequences. An authorship or
            plagiarism concern can also be reported with source links and
            evidence; it is not automatically a valid copyright notice.
          </p>
          <p>
            We review reports, may request clarification, and remove or disable
            access when appropriate. We may share relevant notice details with
            the affected contributor so they can respond; avoid unnecessary
            sensitive information. Accounts of repeat copyright infringers may
            be terminated in appropriate circumstances.
          </p>
          <h3 className="text-lg font-semibold">
            If your content was removed by mistake
          </h3>
          <p>
            Email support with the removed content’s URL or ID and your
            explanation. If the removal was handled under the U.S. DMCA, a
            formal counter-notice must include your signature; identification of
            the removed material and its former location; a statement under
            penalty of perjury that you have a good-faith belief it was removed
            because of mistake or misidentification; and your name, address, and
            telephone number.
          </p>
          <p>
            A DMCA counter-notice must also state that you consent to the
            jurisdiction of the federal district court for your address (or, if
            outside the U.S., any judicial district in which the service
            provider may be found), and will accept service of process from the
            original notifier or their agent. A counter-notice is a legal
            statement and its identifying details may be forwarded to the
            original notifier. Consider legal advice before submitting one.
          </p>
          <p>
            Where the DMCA procedure applies, eligible material may be restored
            after 10–14 business days following receipt of a valid
            counter-notice, unless the original notifier informs us that they
            filed an action seeking a court order, or another lawful basis
            requires the material to remain unavailable.
          </p>
        </section>
        <section id="safety" className="scroll-mt-24 space-y-4">
          <h2 className="text-2xl font-semibold">
            Report abuse or a security issue
          </h2>
          <p>
            For harassment, impersonation, privacy violations, unlawful content,
            or account compromise,{" "}
            <a
              className="underline"
              href={emailLink("Safety or security report")}
            >
              email a safety report
            </a>
            . Include the URL or content ID, a short description, relevant
            dates, and evidence you can lawfully share. Do not forward illegal
            imagery or expose other people’s private information unnecessarily.
          </p>
          <p>
            If there is an immediate threat to someone’s safety, contact local
            emergency services. Email support is not an emergency response
            channel.
          </p>
        </section>
        <section id="privacy" className="scroll-mt-24 space-y-4">
          <h2 className="text-2xl font-semibold">
            Privacy, data access, and account deletion
          </h2>
          <p>
            <a
              className="underline"
              href={emailLink("Privacy or account deletion request")}
            >
              Send a privacy request
            </a>{" "}
            with your account email or user ID, what you want to access,
            correct, export, or delete, and your country or state if relevant.
            We may verify your identity through your account before acting. Do
            not email passwords or identity documents in your initial request.
          </p>
          <p>
            You can delete stories using available workspace controls. For
            deletion of the account and associated personal information, contact
            support. We may need to retain some records for legal obligations,
            security, billing, or disputes; backups and public or third-party
            copies may persist as described in the{" "}
            <Link className="underline" to="/privacy-policy">
              Privacy Policy
            </Link>
            . We will explain relevant exceptions and respond within applicable
            legal deadlines.
          </p>
        </section>
        <section className="space-y-4 border-t border-black/10 dark:border-white/10 pt-6">
          <h2 className="text-2xl font-semibold">Technical and billing help</h2>
          <p>
            Include what you were doing, the time and timezone, your browser,
            and any error or request ID. Redact secrets and unrelated personal
            information from screenshots or logs.
          </p>
          <a
            className="inline-block rounded-lg bg-dark-green text-white px-5 py-3"
            href={emailLink("TheTaleTribe support")}
          >
            Email support
          </a>
        </section>
      </div>
    </main>
  );
}
