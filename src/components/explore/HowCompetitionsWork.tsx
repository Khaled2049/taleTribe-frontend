import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { SEOHead } from "@/components/seo/SEOHead";
import { APP_NAME } from "@/config/seo";
import PhaseWalkthrough from "./PhaseWalkthrough";

interface Guarantee {
  title: string;
  body: string;
}

/**
 * The claims worth making explicitly, because each is enforced somewhere a
 * reader cannot see: escrow in the ledger, the tally in firestore.rules, the
 * digest at settlement. Keep these honest — every line here is something the
 * backend actually does.
 */
const GUARANTEES: Guarantee[] = [
  {
    title: "The prize exists before you enter",
    body: "Prizes are not pledges. Publishing a competition moves the full pool out of the host's balance and into escrow, and it stays there until the competition ends. Nothing is visible to anyone until that happens, so a host cannot advertise a prize they can't pay for — or change it afterwards.",
  },
  {
    title: "Nobody can see who is winning",
    body: "Vote counts are kept where no reader, host or admin can read them until settlement. That is a property of the database, not just something the interface declines to show you — so voting cannot turn into a bandwagon.",
  },
  {
    title: "The result can be checked",
    body: "When a competition settles, the full standings are published with a SHA-256 digest of exactly what was counted. Anyone can recompute it and confirm the result was not quietly edited afterwards.",
  },
  {
    title: "Nobody wins by default",
    body: "If nothing is entered, or nothing is voted for, no prize is handed out on a technicality — the pool goes back to the host and every entry fee goes back to the entrant who paid it. The same happens if the competition is called off.",
  },
  {
    title: "An entry fee is never at risk",
    body: "Most competitions are free. Where a host does charge, the fee is held in escrow next to the prize rather than paid out on the spot — so withdrawing your entry before the deadline returns it in full, as does a cancellation or a competition nobody voted in. Fees are revenue split between the host and the platform, and they never change the prize the winner receives.",
  },
];

const HowCompetitionsWork = () => {
  return (
    <>
      <SEOHead
        title={`How competitions work - ${APP_NAME}`}
        description={`How ${APP_NAME} competitions move from a private draft through funded entry and blind community voting to a verifiable payout.`}
        url="/competitions/how-it-works"
        canonical="/competitions/how-it-works"
      />
      <div className="container mx-auto px-4 max-w-7xl">

        <div className="flex items-center py-[22px] border-b border-ns-border">
          <Link
            to="/competitions"
            className="inline-flex items-center gap-2 font-ui text-[13px] font-semibold text-ns-ink-secondary hover:text-ns-ink transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            All competitions
          </Link>
        </div>

        {/* Intro */}
        <div className="relative overflow-hidden py-12 border-b border-ns-border">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(80% 120% at 82% 0%, var(--ns-accent-subtle) 0%, transparent 62%), repeating-linear-gradient(105deg, rgba(212,169,74,.05) 0 1px, transparent 1px 13px)",
            }}
          />
          <div className="relative">
            <p className="font-ui text-[10px] font-bold uppercase tracking-[0.22em] text-ns-accent mb-5">
              How competitions work
            </p>
            <h1 className="font-heading font-light text-[2.75rem] lg:text-[4rem] leading-[0.98] tracking-[-0.02em] text-ns-ink max-w-[20ch] text-balance">
              A prize, a deadline, and a fair count
            </h1>
            <p className="font-body text-xl leading-[1.55] text-ns-ink-secondary max-w-[62ch] mt-5">
              Every competition begins as a private draft, then moves through five
              published stages on a clock that runs whether anyone is watching or
              not. Here is what happens at each one — and, at every point, exactly
              where the prize money is sitting.
            </p>
          </div>
        </div>

        {/* The walkthrough */}
        <div className="py-12 border-b border-ns-border">
          <PhaseWalkthrough />
        </div>

        {/* What's guaranteed */}
        <div className="py-12 border-b border-ns-border">
          <div className="flex items-center gap-4 mb-8">
            <h2 className="font-heading text-[32px] text-ns-ink shrink-0">
              What that gets you
            </h2>
            <div className="h-px flex-1 bg-ns-border" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-9">
            {GUARANTEES.map((guarantee) => (
              <div key={guarantee.title}>
                <h3 className="font-heading text-[24px] leading-[1.2] text-ns-ink mb-2.5">
                  {guarantee.title}
                </h3>
                <p className="font-body text-[16px] leading-[1.6] text-ns-ink-secondary max-w-[52ch]">
                  {guarantee.body}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Out */}
        <div className="py-12">
          <h2 className="font-heading text-[32px] text-ns-ink">
            Ready to enter one?
          </h2>
          <p className="font-body text-[17px] leading-[1.6] text-ns-ink-secondary max-w-[52ch] mt-3">
            You'll need a published story to enter, and one to your name before
            you can vote — voting is open to writers.
          </p>
          <Link
            to="/competitions"
            className="inline-flex items-center gap-2 mt-6 rounded-[10px] bg-ns-ink px-[30px] py-[15px] font-ui text-sm font-semibold text-ns-bg hover:opacity-90 transition-opacity"
          >
            Browse open competitions
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </>
  );
};

export default HowCompetitionsWork;
