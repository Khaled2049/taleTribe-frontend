import { useEffect, useMemo, useState } from "react";
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

const BookClubs = () => {
  const { user } = useAuthContext();

  const [bookClubs, setBookClubs] = useState<IClub[]>([]);

  useEffect(() => {
    const fetchBookClubs = async () => {
      const clubs = await bookClubRepo.getBookClubs();
      if (clubs) {
        setBookClubs(clubs);
      }
    };
    fetchBookClubs();
  }, []);

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

  const filteredClubs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return bookClubs;
    return bookClubs.filter((club) =>
      [club.name, club.description, club.category].some((field) =>
        field?.toLowerCase().includes(q),
      ),
    );
  }, [bookClubs, searchQuery]);

  const handleCreateClub = async (newClub: IClub) => {
    if (user) {
      newClub.creatorId = user.uid;
    }
    const id = await bookClubRepo.createBookClub(newClub);
    // Use the Firestore-generated ID so card navigation hits the right document
    setBookClubs((prevClubs) => [...prevClubs, { ...newClub, id }]);
    setShowCreateForm(false);
  };

  const handleShowCreateForm = () => {
    setShowCreateForm(true);
  };

  const handleCancelCreateClub = () => {
    setShowCreateForm(false);
  };

  const handleUpdateClub = (updatedClub: IClub) => {
    bookClubRepo.updateBookClub(updatedClub.id, updatedClub);
    setShowUpdateForm(false);
    setSelectedClub(null);
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
        setBookClubs((prevClubs) =>
          prevClubs.map((club) =>
            club.id === clubId && !club.members.includes(user.uid)
              ? { ...club, members: [...club.members, user.uid] }
              : club,
          ),
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

  const confirmDeleteClub = () => {
    if (clubToDelete) {
      bookClubRepo.deleteBookClub(clubToDelete.id);
      setBookClubs((prevClubs) =>
        prevClubs.filter((c) => c.id !== clubToDelete.id),
      );
      setClubToDelete(null);
    }
  };

  const handleLeaveClub = async (clubId: string) => {
    if (user) {
      try {
        await bookClubRepo.leaveBookClub(clubId, user.uid);
        setBookClubs((prevClubs) =>
          prevClubs.map((club) =>
            club.id === clubId
              ? {
                  ...club,
                  members: club.members.filter((id) => id !== user.uid),
                }
              : club,
          ),
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
                Novelsync — Reading Circles
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
        {filteredClubs.length > 0 ? (
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
        ) : searchQuery ? (
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
