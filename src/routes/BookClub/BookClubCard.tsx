import { useNavigate } from "react-router-dom";
import { IClub } from "@/types/IClub";
import { Edit, Trash2, ArrowUpRight } from "lucide-react";
import { prefetchBookClub, preloadBookClubCode } from "./prefetchBookClub";

interface BookClubCardProps {
  club: IClub;
  joined: boolean;
  isCreator: boolean;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
  onJoin: (clubId: string) => void;
  onLeave: (clubId: string) => void;
}

const BookClubCard = ({
  joined,
  isCreator,
  onJoin,
  club,
  onEdit,
  onDelete,
  onLeave,
  index,
}: BookClubCardProps) => {
  const navigate = useNavigate();

  const handleCardClick = () => {
    navigate(`/book-clubs/${club.id}`);
  };

  // Hovering down the list warms only the page code. The club itself is read
  // on press, so a sweep of the pointer does not fetch every club it crosses,
  // and a press on Join or Edit does not fetch one at all.
  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as Element).closest("button")) return;
    void prefetchBookClub(club.id);
  };

  const handleButtonClick = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    action();
  };

  return (
    <article
      onClick={handleCardClick}
      onMouseEnter={preloadBookClubCode}
      onPointerDown={handlePointerDown}
      className="group relative cursor-pointer border-b border-neutral-200 dark:border-neutral-800 py-3 sm:py-3.5 transition-colors duration-200 hover:border-dark-green dark:hover:border-light-green"
    >
      {/* Left accent bar */}
      <div
        className="absolute left-0 top-0 h-full w-[2px] bg-dark-green dark:bg-light-green origin-top scale-y-0 group-hover:scale-y-100 transition-transform duration-300"
        style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
      />

      <div className="flex items-center gap-3 sm:gap-5 pl-4 sm:pl-6">
        {/* Index number */}
        <span className="hidden sm:block w-5 shrink-0 font-mono text-[10px] text-neutral-300 dark:text-neutral-700 select-none">
          {String(index + 1).padStart(2, "0")}
        </span>

        {/* Category + name, single line */}
        <div className="flex-1 min-w-0 flex items-baseline gap-2.5">
          <span className="hidden sm:inline shrink-0 font-ui text-[9px] font-semibold tracking-[0.16em] uppercase text-dark-green dark:text-light-green">
            {club.category || "General"}
          </span>
          <h2 className="min-w-0 truncate font-heading text-base sm:text-lg font-light italic leading-tight text-neutral-900 dark:text-neutral-50 group-hover:text-dark-green dark:group-hover:text-light-green transition-colors duration-200">
            {club.name}
          </h2>
        </div>

        {/* Metadata */}
        <div className="hidden lg:flex items-center gap-2 shrink-0 text-[11px] font-ui text-neutral-400 dark:text-neutral-600">
          <span>
            {club.members.length}{" "}
            {club.members.length === 1 ? "member" : "members"}
          </span>
          <span className="w-[3px] h-[3px] rounded-full bg-neutral-300 dark:bg-neutral-700" />
          <span>{club.activity}</span>
        </div>

        {/* Actions */}
        <div className="shrink-0 flex items-center gap-2">
          {isCreator && (
            <div className="hidden sm:flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <button
                onClick={(e) => handleButtonClick(e, onEdit)}
                className="p-1.5 text-neutral-400 hover:text-dark-green dark:hover:text-light-green transition-colors"
                title="Edit Club"
              >
                <Edit size={12} />
              </button>
              <button
                onClick={(e) => handleButtonClick(e, onDelete)}
                className="p-1.5 text-neutral-400 hover:text-red-500 transition-colors"
                title="Delete Club"
              >
                <Trash2 size={12} />
              </button>
            </div>
          )}
          {!joined ? (
            <button
              onClick={(e) => handleButtonClick(e, () => onJoin(club.id))}
              className="text-[10px] font-ui font-semibold tracking-[0.12em] uppercase text-neutral-900 dark:text-white border border-neutral-900 dark:border-white px-3 py-1.5 hover:bg-neutral-900 hover:text-white dark:hover:bg-white dark:hover:text-neutral-900 transition-colors duration-200"
            >
              Join
            </button>
          ) : (
            <button
              onClick={(e) => handleButtonClick(e, () => onLeave(club.id))}
              className="text-[10px] font-ui font-semibold tracking-[0.12em] uppercase text-dark-green dark:text-light-green border border-dark-green dark:border-light-green px-3 py-1.5 hover:bg-red-50 hover:text-red-600 hover:border-red-300 dark:hover:bg-red-900/20 dark:hover:text-red-400 dark:hover:border-red-700 transition-colors duration-200"
            >
              Member
            </button>
          )}
          <ArrowUpRight
            size={14}
            className="hidden sm:block text-neutral-300 dark:text-neutral-700 group-hover:text-dark-green dark:group-hover:text-light-green transition-colors duration-300"
          />
        </div>
      </div>
    </article>
  );
};

export default BookClubCard;
