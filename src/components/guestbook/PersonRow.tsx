import React from "react";
import { Link } from "react-router-dom";
import { BookMarked } from "lucide-react";
import { PublicProfile } from "@/services/ProfileRepo";
import FollowButton from "@/components/common/FollowButton";

interface PersonRowProps {
  person: PublicProfile;
}

/**
 * There is no avatar image component in this codebase; the initials badge here
 * matches the one GuestbookEntryCard already uses for entry authors.
 */
const PersonRow: React.FC<PersonRowProps> = ({ person }) => {
  const initial = (person.username || "?").charAt(0).toUpperCase();
  const detail = [person.occupation, person.location]
    .filter((part) => part && part.trim() && !isPlaceholder(part))
    .join(" · ");

  return (
    <li className="flex items-center gap-3 py-3 border-b border-ns-border last:border-b-0">
      <Link
        to={`/profile/${person.uid}`}
        className="shrink-0 w-10 h-10 rounded-full bg-ns-accent text-white font-ui font-semibold text-sm flex items-center justify-center no-underline"
        aria-hidden="true"
        tabIndex={-1}
      >
        {initial}
      </Link>

      <div className="min-w-0 flex-1">
        <Link
          to={`/profile/${person.uid}`}
          className="font-ui text-sm font-medium text-ns-ink no-underline hover:text-ns-accent transition-colors"
        >
          @{person.username}
        </Link>
        {detail && (
          <p className="font-body text-xs text-ns-ink-muted truncate">
            {detail}
          </p>
        )}
      </div>

      <Link
        to={`/guestbook/${person.uid}`}
        title={`Sign @${person.username}'s guestbook`}
        className="shrink-0 p-2 rounded-ns text-ns-ink-muted no-underline hover:bg-ns-surface hover:text-ns-ink transition-colors"
      >
        <BookMarked className="w-4 h-4" />
      </Link>

      <FollowButton targetId={person.uid} size="sm" className="shrink-0" />
    </li>
  );
};

/** Signup seeds these as literal placeholder text rather than leaving them empty. */
const isPlaceholder = (value?: string) =>
  value === "Occupation" || value === "Location";

export default PersonRow;
