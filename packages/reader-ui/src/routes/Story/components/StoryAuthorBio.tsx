import React from "react";
import { Link } from "react-router-dom";
import { User } from "lucide-react";
import { AuthorSupport } from "../../../runtime.js";

interface StoryAuthorBioProps {
  author: string;
  authorId?: string;
  bio?: string;
  photoURL?: string;
  authorWalletAddress?: string;
  storyId: string;
  loading?: boolean;
}

const pulse = "animate-pulse rounded bg-ns-surface";

export const StoryAuthorBio: React.FC<StoryAuthorBioProps> = ({
  author,
  authorId,
  bio,
  photoURL,
  authorWalletAddress,
  storyId,
  loading = false,
}) => {
  const displayAuthor = author.trim() || "unknown";
  const authorBio =
    bio?.trim() ||
    `${displayAuthor} is a writer who loves exploring complex themes through storytelling.`;

  return (
    <>
      <section className="mb-10">
        <p className="font-ui text-[10px] font-semibold text-ns-ink-muted uppercase tracking-widest mb-5">
          About the Author
        </p>

        <div className="flex gap-5 items-start">
          <div className="w-14 h-14 rounded-full bg-ns-elevated border border-ns-border overflow-hidden flex items-center justify-center flex-shrink-0">
            {loading ? (
              <div className="w-full h-full animate-pulse bg-ns-surface" />
            ) : photoURL ? (
              <img
                src={photoURL}
                alt={displayAuthor}
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="w-6 h-6 text-ns-ink-muted" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-ui text-sm font-semibold text-ns-ink mb-1.5">
              {authorId ? (
                <Link
                  to={`/profile/${authorId}`}
                  className="hover:text-ns-accent transition-colors"
                >
                  {displayAuthor}
                </Link>
              ) : (
                displayAuthor
              )}
            </h4>
            {loading ? (
              <div className="space-y-2 pt-1" aria-hidden="true">
                <div className={`h-3.5 w-full ${pulse}`} />
                <div className={`h-3.5 w-3/4 ${pulse}`} />
              </div>
            ) : (
              <p className="font-body text-sm text-ns-ink-secondary leading-relaxed">
                {authorBio}
              </p>
            )}
          </div>
        </div>

        <AuthorSupport
          author={displayAuthor}
          authorWalletAddress={authorWalletAddress}
          storyId={storyId}
        />
      </section>
    </>
  );
};
