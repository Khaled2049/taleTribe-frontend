import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  Compass,
  MapPin,
  MessageCircle,
  Trophy,
  User,
  Users,
} from "lucide-react";

interface Feature {
  id: string;
  tab: string;
  icon: typeof Compass;
  title: string;
  blurb: string;
  link?: { to: string; label: string };
  panel: ReactNode;
}

function AssistantDemo() {
  return (
    <div className="space-y-3 font-ui text-sm">
      <p className="ml-auto max-w-[80%] rounded-2xl rounded-br-sm bg-ns-ink px-4 py-2.5 text-ns-bg">
        Who else has touched the letter?
      </p>
      <div className="max-w-[88%] rounded-2xl rounded-bl-sm border border-ns-border-strong bg-ns-elevated px-4 py-3 text-ns-ink">
        <p className="font-body text-base leading-relaxed">
          Only Tomas. He carried the mail up the stairs in chapter 4, the night
          before Ines found it.
        </p>
        <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-ns-accent-subtle px-2.5 py-1 text-xs text-ns-accent">
          <BookOpen className="h-3 w-3" aria-hidden="true" />
          Chapter 4, The Mail Boat
        </span>
      </div>
      <p className="ml-auto max-w-[80%] rounded-2xl rounded-br-sm bg-ns-ink px-4 py-2.5 text-ns-bg">
        Draft the scene where she asks him.
      </p>
    </div>
  );
}

const WORLD = {
  ines: {
    kind: "Character",
    icon: User,
    name: "Ines Varga",
    note: "Keeper of the Narrows light. Counts the stairs out loud.",
  },
  tomas: {
    kind: "Character",
    icon: User,
    name: "Tomas",
    note: "Mail boat pilot. Knows more than he delivers.",
  },
  narrows: {
    kind: "Place",
    icon: MapPin,
    name: "The Narrows",
    note: "A lighthouse on a rock, 112 steps from door to lamp.",
  },
} as const;

type WorldKey = keyof typeof WORLD;

const BEATS = ["The letter", "The dark lamp", "The ship", "The answer"];

function WorldDemo() {
  const [active, setActive] = useState<WorldKey>("ines");
  const entry = WORLD[active];
  const Icon = entry.icon;

  const mention = (key: WorldKey, text: string) => (
    <button
      type="button"
      onClick={() => setActive(key)}
      onMouseEnter={() => setActive(key)}
      onFocus={() => setActive(key)}
      aria-pressed={active === key}
      className={`rounded-sm border-b-2 px-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ns-accent ${
        active === key
          ? "border-ns-accent bg-ns-accent-subtle text-ns-accent"
          : "border-ns-border-strong hover:border-ns-accent"
      }`}
    >
      {text}
    </button>
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
        <p className="font-body text-lg leading-[1.8] text-ns-ink">
          {mention("ines", "Ines")} counted the steps of{" "}
          {mention("narrows", "the Narrows")} twice. Forty-one. Below,{" "}
          {mention("tomas", "Tomas")} was already untying the boat, and he did
          not look up.
        </p>
        <div
          key={active}
          className="self-start rounded-sm border border-ns-border-strong bg-ns-elevated p-4 font-ui animate-in fade-in-0 slide-in-from-left-1 duration-200"
          aria-live="polite"
        >
          <span className="inline-flex items-center gap-1.5 text-xs text-ns-ink-muted">
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {entry.kind}
          </span>
          <p className="mt-1 font-heading text-xl font-semibold text-ns-ink">
            {entry.name}
          </p>
          <p className="mt-1 text-sm leading-snug text-ns-ink-secondary">
            {entry.note}
          </p>
        </div>
      </div>
      <ol className="flex items-center gap-1 font-ui text-xs" aria-label="Plot">
        {BEATS.map((beat, i) => (
          <li key={beat} className="flex flex-1 flex-col gap-1.5">
            <span
              className={`h-1.5 rounded-full ${i < 2 ? "bg-ns-accent" : "bg-ns-border-strong"}`}
              aria-hidden="true"
            />
            <span className={i === 1 ? "text-ns-ink" : "text-ns-ink-muted"}>
              {beat}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function CompetitionDemo() {
  return (
    <div className="relative rounded-sm border-2 border-ns-gold bg-ns-elevated p-5 sm:p-6">
      <Trophy
        className="absolute -right-3 -top-3 h-10 w-10 rotate-12 rounded-full bg-ns-gold p-2 text-ns-bg"
        aria-hidden="true"
      />
      <p className="font-ui text-xs text-ns-gold">This week's prompt</p>
      <p className="mt-2 font-heading text-[1.9rem] font-medium leading-tight text-ns-ink">
        A story under 1,000 words that begins with a knock.
      </p>
      <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-ns-border pt-4 font-ui">
        {[
          ["Entries", "42"],
          ["Closes in", "2d 14h"],
          ["Prize pool", "500 TALE"],
        ].map(([term, value]) => (
          <div key={term}>
            <dt className="text-xs text-ns-ink-muted">{term}</dt>
            <dd className="mt-0.5 text-base font-semibold text-ns-ink">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const CLUB_MESSAGES = [
  { who: "Priya", text: "I did NOT expect the lamp to go out." },
  { who: "Sam", text: "Tomas knew. Chapter 4, second page. Go look." },
  { who: "Ade", text: "Next week: chapters 6 to 9. No spoilers in here." },
];

function BookClubDemo() {
  return (
    <div className="rounded-sm border border-ns-border-strong bg-ns-elevated">
      <div className="flex items-center justify-between border-b border-ns-border px-4 py-3 font-ui">
        <span className="font-semibold text-ns-ink">Slow Burners</span>
        <span className="text-xs text-ns-ink-muted">Reading The Narrows</span>
      </div>
      <ul className="space-y-3 p-4 font-ui text-sm">
        {CLUB_MESSAGES.map((m) => (
          <li key={m.who} className="flex gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-ns-teal-border bg-ns-teal-subtle text-xs font-semibold text-ns-teal">
              {m.who[0]}
            </span>
            <p className="pt-1.5 text-ns-ink">
              <span className="mr-2 font-semibold">{m.who}</span>
              {m.text}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

const PICKS = [
  { title: "Salt Ledger", why: "Another keeper with a secret" },
  { title: "Nine Bells", why: "Same slow-burning dread" },
  { title: "The Mail Boat", why: "Readers of The Narrows finished it" },
];

function RecsDemo() {
  return (
    <div>
      <p className="font-ui text-sm text-ns-ink-secondary">
        Because you finished <span className="text-ns-ink">The Narrows</span>
      </p>
      <ul className="mt-4 grid grid-cols-3 gap-3 sm:gap-4">
        {PICKS.map((pick, i) => (
          <li key={pick.title}>
            <div
              className={`flex aspect-[2/3] items-end rounded-sm p-3 font-heading text-lg font-semibold leading-tight text-ns-bg shadow-ns ${
                ["bg-ns-teal", "bg-ns-ink", "bg-ns-accent"][i]
              }`}
            >
              {pick.title}
            </div>
            <p className="mt-2 font-ui text-xs leading-snug text-ns-ink-secondary">
              {pick.why}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

const FEATURES: Feature[] = [
  {
    id: "assistant",
    tab: "Story assistant",
    icon: MessageCircle,
    title: "Ask your own story questions.",
    blurb:
      "The assistant has read every chapter, so it remembers what you forgot and drafts the scene you're stuck on.",
    panel: <AssistantDemo />,
  },
  {
    id: "world",
    tab: "Characters & places",
    icon: MapPin,
    title: "Your whole world, beside the page.",
    blurb:
      "Characters, places and plot beats live next to the chapter you're writing.",
    panel: <WorldDemo />,
  },
  {
    id: "competitions",
    tab: "Competitions",
    icon: Trophy,
    title: "Write to a prompt. Win the pot.",
    blurb: "Enter a challenge, read the other entries, vote for a winner.",
    link: { to: "/competitions", label: "See competitions" },
    panel: <CompetitionDemo />,
  },
  {
    id: "clubs",
    tab: "Book clubs",
    icon: Users,
    title: "Read along with people.",
    blurb: "Pick a story, set a pace, talk about it chapter by chapter.",
    link: { to: "/book-clubs", label: "Find a club" },
    panel: <BookClubDemo />,
  },
  {
    id: "recs",
    tab: "Picks for you",
    icon: Compass,
    title: "Recommendations that say why.",
    blurb: "The more you read, the better your shelf gets.",
    panel: <RecsDemo />,
  },
];

export function FeatureDesk() {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const feature = FEATURES[active];

  const onKeyDown = (event: KeyboardEvent) => {
    const delta = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[
      event.key
    ];
    if (!delta) return;
    event.preventDefault();
    const next = (active + delta + FEATURES.length) % FEATURES.length;
    setActive(next);
    tabs.current[next]?.focus();
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[16rem_1fr] lg:gap-14">
      <div
        role="tablist"
        aria-orientation="vertical"
        aria-label="Features"
        onKeyDown={onKeyDown}
        className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0"
      >
        {FEATURES.map((f, i) => {
          const Icon = f.icon;
          const selected = i === active;
          return (
            <button
              key={f.id}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              id={`feature-tab-${f.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`feature-panel-${f.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(i)}
              className={`flex shrink-0 items-center gap-3 rounded-full px-4 py-2.5 text-left font-ui text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ns-accent lg:rounded-sm lg:py-3 ${
                selected
                  ? "bg-ns-ink text-ns-bg"
                  : "text-ns-ink-secondary hover:bg-ns-surface-hover hover:text-ns-ink"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {f.tab}
            </button>
          );
        })}
      </div>

      <div
        key={feature.id}
        id={`feature-panel-${feature.id}`}
        role="tabpanel"
        aria-labelledby={`feature-tab-${feature.id}`}
        className="grid gap-8 animate-in fade-in-0 duration-300 md:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] md:items-center"
      >
        <div>
          <h3 className="font-heading text-[clamp(2rem,4vw,2.9rem)] font-medium leading-[1.05] tracking-[-0.02em] text-ns-ink">
            {feature.title}
          </h3>
          <p className="mt-4 max-w-[34ch] font-body text-lg leading-relaxed text-ns-ink-secondary">
            {feature.blurb}
          </p>
          {feature.link && (
            <Link
              to={feature.link.to}
              className="mt-6 inline-block font-ui text-sm font-semibold text-ns-accent underline decoration-ns-border-strong underline-offset-4 transition-colors hover:text-ns-accent-hover hover:decoration-ns-accent"
            >
              {feature.link.label}
            </Link>
          )}
        </div>
        <div className="min-h-[18rem] rounded-sm bg-ns-surface p-5 sm:p-7">
          {feature.panel}
        </div>
      </div>
    </div>
  );
}
