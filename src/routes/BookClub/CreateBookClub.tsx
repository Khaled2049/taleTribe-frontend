import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { IBookOfTheMonth, IClub } from "../../types/IClub";
import { IUser } from "../../types/IUser";
import { ArrowLeft } from "lucide-react";
import { BookPicker } from "../../components/common/BookPicker";
import { hasBook } from "../../utils/bookMapping";

const CATEGORIES = [
  "Fantasy",
  "Mystery",
  "Romance",
  "Sci-Fi",
  "Literary Fiction",
  "Non-Fiction",
  "Thriller",
  "Historical",
  "Horror",
  "Biography",
];

const CreateBookClub = ({
  user,
  onCreate,
  onCancel,
}: {
  user: IUser;
  onCreate: (newClub: IClub) => void;
  onCancel: () => void;
}) => {
  const [bookOfTheMonth, setBookOfTheMonth] = useState<IBookOfTheMonth | null>(
    null,
  );

  const [newClub, setNewClub] = useState<IClub>({
    id: "",
    name: "",
    description: "",
    image: "",
    members: [],
    category: "",
    activity: "",
    creatorId: "",
    meetUp: "",
  });

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setNewClub({
      ...newClub,
      [e.target.name]: e.target.value,
    });
  };

  const handleCategorySelect = (cat: string) => {
    setNewClub({ ...newClub, category: cat });
  };

  const handleCreateClub = () => {
    const clubWithDefaults: IClub = {
      ...newClub,
      id: uuidv4(),
      members: [user.uid],
      activity: "New",
      // Left empty rather than a placeholder path: the API only accepts an
      // absolute http(s) image URL, and nothing renders this as an image —
      // BookClubDetails already falls back when it is blank.
      image: "",
      creatorId: user.uid,
      // Only persist a book when one was actually chosen — legacy code wrote
      // an all-empty-strings placeholder object here.
      ...(hasBook(bookOfTheMonth) ? { bookOfTheMonth } : {}),
      meetUp: newClub.meetUp,
    };
    onCreate(clubWithDefaults);
  };

  const fieldLabelClass =
    "block font-ui text-[10px] font-semibold tracking-[0.18em] uppercase text-neutral-400 dark:text-neutral-600 mb-3";

  const underlineInputClass =
    "w-full bg-transparent border-0 border-b border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-50 pb-2.5 focus:outline-none focus:border-dark-green dark:focus:border-light-green transition-colors duration-200 placeholder:text-neutral-300 dark:placeholder:text-neutral-700";

  return (
    <div className="min-h-screen bg-ns-bg px-5 py-10 md:px-10">
      {/* Back */}
      <button
        onClick={onCancel}
        className="flex items-center gap-2 font-ui text-[11px] font-semibold tracking-[0.12em] uppercase text-neutral-400 dark:text-neutral-600 hover:text-neutral-900 dark:hover:text-white transition-colors duration-200 mb-12"
      >
        <ArrowLeft size={14} />
        All Clubs
      </button>

      <div className="max-w-xl mx-auto">
        {/* Masthead */}
        <p className="font-ui text-[10px] font-semibold tracking-[0.2em] uppercase text-dark-green dark:text-light-green mb-5">
          Found a New Club
        </p>
        <h1 className="font-heading text-5xl md:text-[3.75rem] font-light italic leading-[1.1] text-neutral-900 dark:text-white mb-16">
          Start Something
          <br />
          Worth Reading For.
        </h1>

        <div className="space-y-14">
          {/* Club Name */}
          <div>
            <label className={fieldLabelClass}>Club Name</label>
            <input
              name="name"
              value={newClub.name}
              onChange={handleInputChange}
              placeholder="e.g., The Midnight Readers"
              className={`${underlineInputClass} text-2xl font-heading italic`}
              autoComplete="off"
            />
          </div>

          {/* Description */}
          <div>
            <label className={fieldLabelClass}>About This Club</label>
            <textarea
              name="description"
              value={newClub.description}
              onChange={handleInputChange}
              placeholder="What brings you all together? What do you hope to discover?"
              className={`${underlineInputClass} font-body text-base resize-none min-h-[72px]`}
              rows={3}
            />
          </div>

          {/* Category */}
          <div>
            <label className={fieldLabelClass}>Genre &amp; Category</label>
            <div className="flex flex-wrap gap-2 mb-5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => handleCategorySelect(cat)}
                  className={`px-3.5 py-1.5 font-ui text-[11px] font-medium tracking-wide border transition-colors duration-150 ${
                    newClub.category === cat
                      ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border-neutral-900 dark:border-white"
                      : "border-neutral-300 dark:border-neutral-700 text-neutral-500 dark:text-neutral-500 hover:border-neutral-700 dark:hover:border-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <input
              name="category"
              value={newClub.category}
              onChange={handleInputChange}
              placeholder="Or type your own genre..."
              className={`${underlineInputClass} text-sm font-body`}
              autoComplete="off"
            />
          </div>

          {/* Meetup */}
          <div>
            <label className={fieldLabelClass}>Meetup Location</label>
            <input
              name="meetUp"
              value={newClub.meetUp}
              onChange={handleInputChange}
              placeholder="Online, or a city near you..."
              className={`${underlineInputClass} text-base font-body`}
              autoComplete="off"
            />
          </div>

          {/* Book of the Month */}
          <div>
            <label className={fieldLabelClass}>Opening Read</label>
            <p className="font-body text-sm text-neutral-400 dark:text-neutral-600 mb-5">
              Choose the first book your club will read together — a story
              published on NovelSync, or anything from Google Books.
            </p>
            <BookPicker
              onSelect={setBookOfTheMonth}
              selected={bookOfTheMonth}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="mt-20 pt-8 border-t border-neutral-200 dark:border-neutral-800 flex items-center gap-8">
          <button
            onClick={handleCreateClub}
            disabled={!newClub.name.trim()}
            className="font-ui text-[12px] font-bold tracking-[0.14em] uppercase px-8 py-3.5 bg-ns-accent text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-ns-accent-hover transition-colors duration-200"
          >
            Found This Club
          </button>
          <button
            onClick={onCancel}
            className="font-ui text-[11px] font-semibold tracking-[0.14em] uppercase text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors duration-200"
          >
            Never mind
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateBookClub;
