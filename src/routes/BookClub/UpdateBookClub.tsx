import { useState } from "react";
import { IClubSummary } from "../../types/IClub";
import { ArrowLeft } from "lucide-react";

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

interface UpdateBookClubProps {
  club: IClubSummary;
  onUpdate: (updatedClub: IClubSummary) => void;
  onCancel: () => void;
}

const UpdateBookClub = ({ club, onUpdate, onCancel }: UpdateBookClubProps) => {
  const [name, setName] = useState(club.name);
  const [description, setDescription] = useState(club.description);
  const [category, setCategory] = useState(club.category);

  const handleUpdate = () => {
    const updatedClub = { ...club, name, description, category };
    onUpdate(updatedClub);
  };

  const fieldLabelClass =
    "block font-ui text-[10px] font-semibold tracking-[0.18em] uppercase text-neutral-400 dark:text-neutral-600 mb-3";

  const underlineInputClass =
    "w-full bg-transparent border-0 border-b border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-50 pb-2.5 focus:outline-none focus:border-dark-green dark:focus:border-light-green transition-colors duration-200 placeholder:text-neutral-300 dark:placeholder:text-neutral-700";

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 px-5 py-10 md:px-10">
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
          Edit Club
        </p>
        <h1 className="font-heading text-5xl md:text-[3.75rem] font-light italic leading-[1.1] text-neutral-900 dark:text-white mb-16">
          Refine Your
          <br />
          Reading Circle.
        </h1>

        <div className="space-y-14">
          {/* Club Name */}
          <div>
            <label className={fieldLabelClass}>Club Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., The Midnight Readers"
              className={`${underlineInputClass} text-2xl font-heading italic`}
              autoComplete="off"
            />
          </div>

          {/* Description */}
          <div>
            <label className={fieldLabelClass}>About This Club</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What brings you all together?"
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
                  onClick={() => setCategory(cat)}
                  className={`px-3.5 py-1.5 font-ui text-[11px] font-medium tracking-wide border transition-colors duration-150 ${
                    category === cat
                      ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border-neutral-900 dark:border-white"
                      : "border-neutral-300 dark:border-neutral-700 text-neutral-500 dark:text-neutral-500 hover:border-neutral-700 dark:hover:border-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Or type your own genre..."
              className={`${underlineInputClass} text-sm font-body`}
              autoComplete="off"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="mt-20 pt-8 border-t border-neutral-200 dark:border-neutral-800 flex items-center gap-8">
          <button
            onClick={handleUpdate}
            disabled={!name.trim()}
            className="font-ui text-[12px] font-bold tracking-[0.14em] uppercase px-8 py-3.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-dark-green dark:hover:bg-light-green transition-colors duration-200"
          >
            Save Changes
          </button>
          <button
            onClick={onCancel}
            className="font-ui text-[11px] font-semibold tracking-[0.14em] uppercase text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors duration-200"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpdateBookClub;
