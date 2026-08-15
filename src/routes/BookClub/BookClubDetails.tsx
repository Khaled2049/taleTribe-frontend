import React, { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { ChevronDown, ChevronUp, Crown } from "lucide-react";
import { bookClubRepo } from "./bookClubRepo";
import { useAuthContext } from "@/contexts/AuthContext";
import BookClubChat from "./BookClubChat";
import ReadingPaceSection from "./components/ReadingPaceSection";
import DiscussionSection from "./components/DiscussionSection";
import NextBookSection from "./components/NextBookSection";
import { SEOHead } from "@/components/seo/SEOHead";
import { getAbsoluteUrl, APP_NAME } from "@/config/seo";
import { useBookClub } from "@/hooks/queries/useBookClubQueries";
import { profileRepo } from "@/services/ProfileRepo";
import { BookPickerDialog } from "@/components/common/BookPicker";
import { hasBook } from "@/utils/bookMapping";
import { IReadingProgress } from "@/types/IClub";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface MemberInfo {
  id: string;
  username: string;
}

const Ornament = () => (
  <div className="flex items-center justify-center gap-3 py-2" aria-hidden="true">
    <span className="w-10 h-px bg-ns-border" />
    <span className="text-ns-ink-muted text-xs">✦</span>
    <span className="w-10 h-px bg-ns-border" />
  </div>
);

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <section className="border-t border-ns-border py-10 sm:py-12">
    <div className="min-w-0">
      <h2 className="font-ui text-[10px] font-semibold tracking-[0.2em] uppercase text-ns-ink-muted mb-5">
        {title}
      </h2>
      {children}
    </div>
  </section>
);

const BookClubDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuthContext();
  const { data: clubData, isPending: isLoading } = useBookClub(id);
  const club = clubData ?? undefined;

  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [isMembersOpen, setIsMembersOpen] = useState(false);
  const previousMemberIdsRef = useRef<string>("");
  const [progressList, setProgressList] = useState<IReadingProgress[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isEditingMeetup, setIsEditingMeetup] = useState(false);
  const [meetupDraft, setMeetupDraft] = useState("");
  const [isSavingMeetup, setIsSavingMeetup] = useState(false);
  const [isUpdatingMembership, setIsUpdatingMembership] = useState(false);
  const [isChangingBook, setIsChangingBook] = useState(false);

  // Fetch usernames for member IDs
  useEffect(() => {
    let isMounted = true;

    const fetchMemberUsernames = async () => {
      if (!club?.members || club.members.length === 0) {
        if (previousMemberIdsRef.current !== "") {
          if (isMounted) setMembers([]);
          previousMemberIdsRef.current = "";
        }
        return;
      }

      const memberIdsString = [...club.members].sort().join(",");
      if (memberIdsString === previousMemberIdsRef.current) return;
      previousMemberIdsRef.current = memberIdsString;

      try {
        const profileMap = await profileRepo.getMany(
          club.members,
        );
        const memberInfos = club.members.map((memberId) => {
          const profile = profileMap.get(memberId);
          return {
            id: memberId,
            username: profile?.username || "Unknown User",
          };
        });
        if (isMounted) setMembers(memberInfos);
      } catch {
        console.error("Error fetching member usernames");
      }
    };

    fetchMemberUsernames();
    return () => {
      isMounted = false;
    };
  }, [club?.members?.length, club?.members]);

  // One realtime source for every member's reading progress.
  // Firestore rules require auth to read memberProgress, so skip when signed out.
  useEffect(() => {
    if (!id || !user) {
      setProgressList([]);
      return;
    }
    const unsubscribe = bookClubRepo.getAllMemberProgress(id, setProgressList);
    return unsubscribe;
  }, [id, user]);

  const userCurrentChapter = user
    ? (progressList.find((p) => p.userId === user.uid)?.currentChapter ?? 0)
    : 0;

  const isCreator = user ? club?.creatorId === user.uid : false;
  const isMember = user ? (club?.members?.includes(user.uid) ?? false) : false;
  const membersById = new Map(members.map((m) => [m.id, m.username]));

  const handleMembershipToggle = async () => {
    if (!club || !user || isUpdatingMembership) return;
    setIsUpdatingMembership(true);
    try {
      if (isMember) {
        await bookClubRepo.leaveBookClub(club.id, user.uid);
      } else {
        await bookClubRepo.joinBookClub(club.id, user.uid);
      }
    } catch (error) {
      console.error("Failed to update membership:", error);
    } finally {
      setIsUpdatingMembership(false);
    }
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ns-bg">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-ns-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="font-heading italic text-xl text-ns-ink">Loading…</p>
        </div>
      </div>
    );
  }

  if (!club) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ns-bg">
        <h1 className="font-heading italic text-3xl text-ns-ink">
          Club not found
        </h1>
      </div>
    );
  }

  const book = hasBook(club.bookOfTheMonth) ? club.bookOfTheMonth : null;
  const memberCount = club.members?.length || 0;

  return (
    <>
      <SEOHead
        title={`${club.name} Book Club`}
        description={club.description}
        keywords={[club.category, club.activity, "book club", "reading group"]}
        image={club.image}
        url={`/book-clubs/${club.id}`}
        type="website"
        canonical={`/book-clubs/${club.id}`}
        structuredData={{
          "@context": "https://schema.org",
          "@type": "Organization",
          name: club.name,
          description: club.description,
          image: club.image
            ? getAbsoluteUrl(club.image)
            : getAbsoluteUrl("/book.svg"),
          url: getAbsoluteUrl(`/book-clubs/${club.id}`),
          memberOf: {
            "@type": "Organization",
            name: APP_NAME,
          },
        }}
      />

      <div className="min-h-full bg-ns-bg text-ns-ink transition-colors duration-300">
        <div className="max-w-3xl mx-auto px-5 sm:px-8 pb-24">
          {/* Masthead */}
          <header className="pt-14 sm:pt-20 pb-10">
            <p className="font-ui text-[10px] font-semibold tracking-[0.2em] uppercase text-ns-accent mb-4">
              Book Club
              {club.category && ` · ${club.category}`}
            </p>
            <h1 className="font-heading font-light italic text-4xl sm:text-6xl leading-[1.02] tracking-tight mb-5">
              {club.name}
            </h1>
            {club.description && (
              <p className="font-body text-base text-ns-ink-secondary leading-relaxed max-w-2xl mb-7">
                {club.description}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => setIsMembersOpen(true)}
                className="flex items-center gap-2.5 group"
              >
                <span className="flex items-center">
                  {members.slice(0, 5).map((member) => (
                    <span
                      key={member.id}
                      className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-ns-surface border border-ns-border font-ui text-[11px] font-semibold text-ns-ink-secondary -ml-2 first:ml-0"
                      title={member.username}
                    >
                      {member.username.charAt(0).toUpperCase()}
                    </span>
                  ))}
                </span>
                <span className="font-ui text-[11px] font-semibold tracking-[0.12em] uppercase text-ns-ink-muted group-hover:text-ns-accent transition-colors">
                  {memberCount} reader{memberCount !== 1 ? "s" : ""}
                </span>
              </button>

              {user && !isCreator && (
                <button
                  type="button"
                  onClick={handleMembershipToggle}
                  disabled={isUpdatingMembership}
                  className={`font-ui text-[11px] font-semibold tracking-[0.12em] uppercase px-4 py-1.5 rounded-full border transition-colors duration-200 disabled:opacity-50 ${
                    isMember
                      ? "text-ns-ink-secondary border-ns-border hover:text-ns-accent hover:border-ns-accent"
                      : "text-ns-ink border-ns-ink hover:bg-ns-ink hover:text-ns-bg"
                  }`}
                >
                  {isUpdatingMembership
                    ? "Working…"
                    : isMember
                      ? "Leave"
                      : "Join"}
                </button>
              )}
            </div>
          </header>

          {/* Now reading */}
          <Section title="Now reading">
            {book ? (
              <div className="flex gap-5 sm:gap-8 items-start">
                {book.volumeInfo.imageLinks?.thumbnail ? (
                  <img
                    src={book.volumeInfo.imageLinks.thumbnail}
                    alt={book.volumeInfo.title}
                    className="w-24 sm:w-32 aspect-[2/3] object-cover rounded-ns-lg shadow-ns-xl ring-1 ring-ns-border/40 shrink-0"
                  />
                ) : (
                  <div
                    className="w-24 sm:w-32 aspect-[2/3] shrink-0 rounded-ns-lg bg-ns-surface border border-ns-border flex items-center justify-center"
                    aria-hidden="true"
                  >
                    <span className="font-heading text-4xl text-ns-ink-muted">
                      {book.volumeInfo.title.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <h3 className="font-heading italic text-2xl sm:text-3xl leading-tight text-ns-ink mb-1.5">
                    {book.volumeInfo.title}
                  </h3>
                  {book.volumeInfo.authors && (
                    <p className="font-ui text-xs tracking-wide text-ns-ink-secondary mb-3">
                      by {book.volumeInfo.authors.join(", ")}
                    </p>
                  )}
                  <div className="w-10 h-0.5 bg-ns-accent mb-3" aria-hidden="true" />
                  {book.volumeInfo.description && (
                    <p className="font-body text-sm text-ns-ink-secondary leading-relaxed line-clamp-4 mb-4">
                      {book.volumeInfo.description}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                    {book.source === "novelsync" && book.storyId && (
                      <Link
                        to={`/story/${book.storyId}`}
                        className="font-ui text-[11px] font-semibold tracking-[0.12em] uppercase text-ns-accent hover:opacity-80 transition-opacity"
                      >
                        Read on NovelSync →
                      </Link>
                    )}
                    {!!book.totalChapters && (
                      <span className="font-ui text-[10px] uppercase tracking-widest text-ns-ink-muted border border-ns-border rounded-full px-2.5 py-0.5">
                        {book.totalChapters} chapters
                      </span>
                    )}
                    {isCreator && (
                      <button
                        type="button"
                        onClick={() => setIsChangingBook(true)}
                        className="font-ui text-[11px] font-semibold tracking-[0.12em] uppercase text-ns-ink-muted hover:text-ns-accent transition-colors"
                      >
                        Change book
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <p className="font-body italic text-sm text-ns-ink-muted mb-3">
                  No book on the club's nightstand yet.
                </p>
                {isCreator && (
                  <button
                    type="button"
                    onClick={() => setIsChangingBook(true)}
                    className="font-ui text-[11px] font-semibold tracking-[0.14em] uppercase text-ns-accent hover:opacity-80 transition-opacity"
                  >
                    Choose a book →
                  </button>
                )}
              </div>
            )}
          </Section>

          {/* Reading pace */}
          <Section title="Reading pace">
            <ReadingPaceSection
              club={club}
              isCreator={isCreator}
              isMember={isMember}
              progress={progressList}
              userCurrentChapter={userCurrentChapter}
              membersById={membersById}
            />
          </Section>

          {/* Discussion */}
          <Section title="Discussion">
            <DiscussionSection
              club={club}
              isCreator={isCreator}
              userCurrentChapter={userCurrentChapter}
            />
          </Section>

          {/* Next book */}
          <Section title="Next book">
            <NextBookSection club={club} isCreator={isCreator} />
          </Section>

          <Ornament />

          {/* Meetup */}
          <Section title="Next meetup">
            {isEditingMeetup ? (
              <div className="space-y-3">
                <Textarea
                  value={meetupDraft}
                  onChange={(e) => setMeetupDraft(e.target.value)}
                  rows={3}
                  placeholder="e.g. Saturday June 14 at 7pm — Zoom link: …"
                  disabled={isSavingMeetup}
                  autoFocus
                  className="resize-none"
                />
                <div className="flex gap-3 items-center">
                  <Button
                    size="sm"
                    onClick={async () => {
                      setIsSavingMeetup(true);
                      try {
                        await bookClubRepo.updateMeetUp(
                          club.id,
                          meetupDraft.trim(),
                        );
                        setIsEditingMeetup(false);
                      } catch (e) {
                        console.error("Failed to save meetup:", e);
                      } finally {
                        setIsSavingMeetup(false);
                      }
                    }}
                    disabled={isSavingMeetup}
                  >
                    {isSavingMeetup ? "Saving…" : "Save"}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setIsEditingMeetup(false)}
                    disabled={isSavingMeetup}
                    className="font-ui text-xs text-ns-ink-muted hover:text-ns-ink transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : club.meetUp ? (
              <div className="flex flex-wrap items-start justify-between gap-4">
                <p className="font-heading italic text-lg sm:text-xl text-ns-ink leading-snug whitespace-pre-wrap border-l-2 border-ns-accent pl-4 max-w-xl">
                  {club.meetUp}
                </p>
                {isCreator && (
                  <button
                    type="button"
                    onClick={() => {
                      setMeetupDraft(club.meetUp ?? "");
                      setIsEditingMeetup(true);
                    }}
                    className="font-ui text-[11px] font-semibold tracking-[0.14em] uppercase text-ns-ink-muted hover:text-ns-accent transition-colors shrink-0"
                  >
                    Edit
                  </button>
                )}
              </div>
            ) : (
              <div>
                <p className="font-body italic text-sm text-ns-ink-muted">
                  No meetup scheduled yet.
                </p>
                {isCreator && (
                  <button
                    type="button"
                    onClick={() => {
                      setMeetupDraft("");
                      setIsEditingMeetup(true);
                    }}
                    className="mt-2 font-ui text-[11px] font-semibold tracking-[0.14em] uppercase text-ns-accent hover:opacity-80 transition-opacity"
                  >
                    Schedule one →
                  </button>
                )}
              </div>
            )}
          </Section>

          {/* Chat */}
          {user && (
            <section className="border-t border-ns-border">
              <button
                type="button"
                onClick={() => setIsChatOpen(!isChatOpen)}
                className="w-full py-6 flex items-center justify-between gap-4 group"
              >
                <span className="font-ui text-[10px] font-semibold tracking-[0.2em] uppercase text-ns-ink-muted group-hover:text-ns-accent transition-colors text-left">
                  Chat room
                </span>
                {isChatOpen ? (
                  <ChevronUp size={16} className="text-ns-accent shrink-0" />
                ) : (
                  <ChevronDown size={16} className="text-ns-accent shrink-0" />
                )}
              </button>
              {isChatOpen && (
                <div className="pb-10">
                  <BookClubChat
                    clubId={club.id}
                    user={user}
                    userCurrentChapter={userCurrentChapter}
                  />
                </div>
              )}
            </section>
          )}
        </div>
      </div>

      {/* Members panel */}
      <Dialog open={isMembersOpen} onOpenChange={setIsMembersOpen}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle className="font-heading text-ns-ink">
              {memberCount} reader{memberCount !== 1 ? "s" : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto">
            {members.length === 0 ? (
              <p className="py-4 font-body italic text-sm text-ns-ink-muted">
                No members yet.
              </p>
            ) : (
              members.map((member) => {
                const isFounder = member.id === club.creatorId;
                return (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 py-2.5 border-b border-ns-border last:border-b-0"
                  >
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-ns-surface border border-ns-border font-ui text-xs font-semibold text-ns-ink-secondary shrink-0">
                      {member.username.charAt(0).toUpperCase()}
                    </span>
                    <span className="flex-1 font-ui text-sm text-ns-ink truncate">
                      {member.username}
                    </span>
                    {isFounder && (
                      <span className="inline-flex items-center gap-1 font-ui text-[10px] uppercase tracking-widest text-ns-accent shrink-0">
                        <Crown size={10} />
                        Founder
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Change book */}
      <BookPickerDialog
        open={isChangingBook}
        onOpenChange={setIsChangingBook}
        title={book ? "Change the club's book" : "Choose the club's book"}
        onConfirm={async (newBook) => {
          await bookClubRepo.updateBookOfTheMonth(club.id, newBook);
        }}
      />
    </>
  );
};

export default BookClubDetails;
