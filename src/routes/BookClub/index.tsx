import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowUpRight, Search } from "lucide-react";
import BookClubCard from "./BookClubCard";
import { IClub } from "../../types/IClub";
import CreateBookClub from "./CreateBookClub";
import UpdateBookClub from "./UpdateBookClub";

import { useAuthContext } from "../../contexts/AuthContext";
import { bookClubRepo } from "./bookClubRepo";
import { SEOHead } from "@/components/seo/SEOHead";
import { APP_NAME } from "@/config/seo";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import {
  useBookClubListCache,
  useBookClubs,
} from "@/hooks/queries/useBookClubQueries";
import {
  clubListView,
  filterClubs,
  withClubFirst,
  withMembership,
  withoutClub,
} from "@/lib/bookClubList";

const NO_CLUBS: IClub[] = [];

const SKELETON_NAME_WIDTHS = ["w-2/5", "w-3/5", "w-1/3", "w-1/2", "w-2/3"];

// Mirrors BookClubCard's padding and line height so the rows that replace it
// land where these were.
const ClubRowsSkeleton = () => (
  <div role="status" aria-label="Loading book clubs" className="animate-pulse">
    {SKELETON_NAME_WIDTHS.map((width, index) => (
      <div
        key={index}
        className="flex items-center gap-3 sm:gap-5 pl-4 sm:pl-6 py-3 sm:py-3.5 border-b border-neutral-200 dark:border-neutral-800"
      >
        <div className="flex-1 min-w-0 h-7 flex items-center">
          <div className={`h-4 ${width} bg-neutral-200 dark:bg-neutral-800`} />
        </div>
        <div className="h-7 w-14 shrink-0 bg-neutral-200 dark:bg-neutral-800" />
      </div>
    ))}
  </div>
);

const BookClubs = () => {
  const { user } = useAuthContext();

  const clubsQuery = useBookClubs();
  const bookClubs = clubsQuery.data ?? NO_CLUBS;
  const patchClubs = useBookClubListCache();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [selectedClub, setSelectedClub] = useState<IClub | null>(null);
  const [clubToDelete, setClubToDelete] = useState<IClub | null>(null);
  const [notCreatorDeleteAttempt, setNotCreatorDeleteAttempt] =
    useState<IClub | null>(null);
  const [notCreatorUpdateAttempt, setNotCreatorUpdateAttempt] =
    useState<IClub | null>(null);
  const [loginRequiredForJoin, setLoginRequiredForJoin] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredClubs = useMemo(
    () => filterClubs(bookClubs, searchQuery),
    [bookClubs, searchQuery],
  );
  const listView = clubListView(
    {
      data: clubsQuery.data,
      // A retry in flight shows the skeleton again rather than a dead button.
      isError: clubsQuery.isError && !clubsQuery.isFetching,
    },
    filteredClubs.length,
    searchQuery,
  );

  const handleCreateClub = async (newClub: IClub) => {
    try {
      const created = await bookClubRepo.createBookClub(newClub);
      await patchClubs(created.id, (clubs) => withClubFirst(clubs, created));
      setShowCreateForm(false);
    } catch (error) {
      console.error("Failed to create club:", error);
      toast.error("We couldn't create the club. Please try again.");
    }
  };

  const handleShowCreateForm = () => {
    setShowCreateForm(true);
  };

  const handleCancelCreateClub = () => {
    setShowCreateForm(false);
  };

  const handleUpdateClub = async (updatedClub: IClub) => {
    try {
      const saved = await bookClubRepo.updateBookClub(
        updatedClub.id,
        updatedClub,
      );
      await patchClubs(saved.id, (clubs) => withClubFirst(clubs, saved));
      setShowUpdateForm(false);
      setSelectedClub(null);
    } catch (error) {
      console.error("Failed to update club:", error);
      toast.error("We couldn't save the club. Please try again.");
    }
  };

  const handleShowUpdateForm = (club: IClub) => {
    if (club.creatorId === user?.uid) {
      setSelectedClub(club);
      setShowUpdateForm(true);
    } else {
      setNotCreatorUpdateAttempt(club);
    }
  };

  const handleJoinClub = async (clubId: string) => {
    if (user) {
      try {
        await bookClubRepo.joinBookClub(clubId, user.uid);
        await patchClubs(clubId, (clubs) =>
          withMembership(clubs, clubId, user.uid, true),
        );
      } catch (error) {
        console.error("Failed to join club:", error);
      }
    } else {
      setLoginRequiredForJoin(true);
    }
  };

  const handleDeleteClub = (club: IClub) => {
    if (club.creatorId === user?.uid) {
      setClubToDelete(club);
    } else {
      setNotCreatorDeleteAttempt(club);
    }
  };

  const confirmDeleteClub = async () => {
    if (!clubToDelete) return;
    const { id } = clubToDelete;
    setClubToDelete(null);
    try {
      await bookClubRepo.deleteBookClub(id);
      await patchClubs(id, (clubs) => withoutClub(clubs, id));
    } catch (error) {
      console.error("Failed to delete club:", error);
      toast.error("We couldn't delete the club. Please try again.");
    }
  };

  const handleLeaveClub = async (clubId: string) => {
    if (user) {
      try {
        await bookClubRepo.leaveBookClub(clubId, user.uid);
        await patchClubs(clubId, (clubs) =>
          withMembership(clubs, clubId, user.uid, false),
        );
      } catch (error) {
        console.error("Failed to leave club:", error);
      }
    }
  };

  const handleCancelUpdateClub = () => {
    setShowUpdateForm(false);
    setSelectedClub(null);
  };

  if (showCreateForm && user) {
    return (
      <CreateBookClub
        user={user}
        onCreate={handleCreateClub}
        onCancel={handleCancelCreateClub}
      />
    );
  }

  if (showUpdateForm && selectedClub) {
    return (
      <UpdateBookClub
        club={selectedClub}
        onUpdate={handleUpdateClub}
        onCancel={handleCancelUpdateClub}
      />
    );
  }

  return (
    <div className="min-h-screen">
      <ConfirmDialog
        open={!!clubToDelete}
        onOpenChange={(open) => !open && setClubToDelete(null)}
        title="Delete Book Club"
        description={`"${clubToDelete?.name}" will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete Club"
        cancelLabel="Keep Club"
        variant="danger"
        onConfirm={confirmDeleteClub}
      />

      <ConfirmDialog
        open={!!notCreatorDeleteAttempt}
        onOpenChange={(open) => !open && setNotCreatorDeleteAttempt(null)}
        title="Can't Delete This Club"
        description={`Only the creator of "${notCreatorDeleteAttempt?.name}" can delete it.`}
        confirmLabel="Got It"
        variant="danger"
        hideCancel
        onConfirm={() => setNotCreatorDeleteAttempt(null)}
      />

      <ConfirmDialog
        open={!!notCreatorUpdateAttempt}
        onOpenChange={(open) => !open && setNotCreatorUpdateAttempt(null)}
        title="Can't Edit This Club"
        description={`Only the creator of "${notCreatorUpdateAttempt?.name}" can edit it.`}
        confirmLabel="Got It"
        variant="danger"
        hideCancel
        onConfirm={() => setNotCreatorUpdateAttempt(null)}
      />

      <ConfirmDialog
        open={loginRequiredForJoin}
        onOpenChange={(open) => !open && setLoginRequiredForJoin(false)}
        title="Sign In Required"
        description="You must be logged in to join a club."
        confirmLabel="Got It"
        hideCancel
        onConfirm={() => setLoginRequiredForJoin(false)}
      />

      <SEOHead
        title={`Book Clubs - ${APP_NAME}`}
        description={`Join reading communities and book clubs on ${APP_NAME}. Read together, discuss stories, and connect with fellow readers.`}
        keywords={[
          "book clubs",
          "reading groups",
          "reading community",
          "book discussions",
        ]}
        url="/book-clubs"
        canonical="/book-clubs"
      />
      <div className="max-w-4xl mx-auto px-5 md:px-10 py-12 md:py-16">
        {/* Masthead */}
        <header className="mb-2">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 sm:gap-6">
            <div className="min-w-0 sm:flex-1">
              <p className="font-ui text-[10px] font-semibold tracking-[0.2em] uppercase text-dark-green dark:text-light-green mb-4">
                TheTaleTribe — Reading Circles
              </p>
              <h1 className="font-heading text-[clamp(1.75rem,7vw,4.5rem)] font-light italic leading-[1.05] whitespace-nowrap text-neutral-900 dark:text-white">
                Find Your Reading Tribe.
              </h1>
            </div>

            {user && (
              <button
                onClick={handleShowCreateForm}
                className="group shrink-0 sm:mt-2 flex items-center gap-2 font-ui text-[11px] font-bold tracking-[0.14em] uppercase text-neutral-900 dark:text-white hover:text-dark-green dark:hover:text-light-green transition-colors duration-200"
              >
                <span>Start a Club</span>
                <ArrowUpRight
                  size={14}
                  className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-200"
                />
              </button>
            )}
          </div>

          <p className="mt-6 font-body text-base text-neutral-500 dark:text-neutral-400 max-w-lg">
            Browse active communities, meet fellow readers, and discover books
            worth talking about.
          </p>

          <div className="mt-8 relative max-w-md">
            <Search
              size={16}
              className="absolute left-0 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-600"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search clubs by name, category, or description…"
              className="w-full pl-7 pb-3 bg-transparent border-b border-neutral-300 dark:border-neutral-700 font-body text-base text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-600 focus:outline-none focus:border-neutral-900 dark:focus:border-white transition-colors"
            />
          </div>
        </header>

        {/* Thin rule */}
        <div className="mt-10 mb-0 border-t border-neutral-900 dark:border-neutral-100 opacity-100" />

        {/* Club list */}
        {listView === "loading" ? (
          <ClubRowsSkeleton />
        ) : listView === "error" ? (
          <div className="py-28 text-center" role="alert">
            <p className="font-heading italic text-3xl text-neutral-300 dark:text-neutral-700 mb-6">
              The clubs didn’t load.
            </p>
            <p className="font-body text-sm text-neutral-400 dark:text-neutral-600 mb-10">
              Check your connection and try again.
            </p>
            <button
              onClick={() => void clubsQuery.refetch()}
              className="font-ui text-[11px] font-bold tracking-[0.14em] uppercase px-7 py-3 border border-neutral-900 dark:border-white text-neutral-900 dark:text-white hover:bg-neutral-900 hover:text-white dark:hover:bg-white dark:hover:text-neutral-900 transition-colors duration-200"
            >
              Try Again
            </button>
          </div>
        ) : listView === "rows" ? (
          <div>
            {filteredClubs.map((club: IClub, index) => (
              <BookClubCard
                key={club.id}
                index={index}
                joined={user ? club.members.includes(user.uid) : false}
                isCreator={user ? club.creatorId === user.uid : false}
                club={club}
                onEdit={() => handleShowUpdateForm(club)}
                onDelete={() => handleDeleteClub(club)}
                onJoin={() => handleJoinClub(club.id)}
                onLeave={() => handleLeaveClub(club.id)}
              />
            ))}
          </div>
        ) : listView === "no-matches" ? (
          <div className="py-28 text-center">
            <p className="font-heading italic text-3xl text-neutral-300 dark:text-neutral-700 mb-6">
              No matches.
            </p>
            <p className="font-body text-sm text-neutral-400 dark:text-neutral-600">
              No clubs match “{searchQuery}”. Try a different search.
            </p>
          </div>
        ) : (
          <div className="py-28 text-center">
            <p className="font-heading italic text-3xl text-neutral-300 dark:text-neutral-700 mb-6">
              No clubs yet.
            </p>
            <p className="font-body text-sm text-neutral-400 dark:text-neutral-600 mb-10">
              Be the first to gather a reading circle.
            </p>
            {user && (
              <button
                onClick={handleShowCreateForm}
                className="font-ui text-[11px] font-bold tracking-[0.14em] uppercase px-7 py-3 border border-neutral-900 dark:border-white text-neutral-900 dark:text-white hover:bg-neutral-900 hover:text-white dark:hover:bg-white dark:hover:text-neutral-900 transition-colors duration-200"
              >
                Found the First Club
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BookClubs;
