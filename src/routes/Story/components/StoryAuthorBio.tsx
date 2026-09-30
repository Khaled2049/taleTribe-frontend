import React, { lazy, Suspense, useState } from "react";
import { Link } from "react-router-dom";
import { User, DollarSign } from "lucide-react";
import { Web3Boundary } from "@/contexts/Web3Boundary";
import { WEB3_ENABLED } from "@/config/featureFlags";
import {
  useAuthorUsername,
  usePublicProfile,
} from "@/hooks/queries/useUserQueries";

const StoryTipModal = lazy(() =>
  import("./StoryTipModal").then((m) => ({ default: m.StoryTipModal })),
);

interface StoryAuthorBioProps {
  author: string;
  authorId?: string;
  bio?: string;
  authorWalletAddress?: string;
  storyId: string;
}

export const StoryAuthorBio: React.FC<StoryAuthorBioProps> = ({
  author,
  authorId,
  bio,
  authorWalletAddress,
  storyId,
}) => {
  const [showTipModal, setShowTipModal] = useState(false);

  // Resolve the author's current username live from their public profile so the
  // bio reflects username changes; fall back to the copy stored on the story.
  const displayAuthor = useAuthorUsername(authorId, author);

  // Pull the author's live public profile for the real bio + photo. Prefer it
  // over the copy passed in, then a generic line while signed out / unset.
  const { data: authorProfile } = usePublicProfile(authorId);
  const photoURL = authorProfile?.photoURL;
  const authorBio =
    authorProfile?.bio?.trim() ||
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
            {photoURL ? (
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
            <p className="font-body text-sm text-ns-ink-secondary leading-relaxed">
              {authorBio}
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-2">
          <button
            onClick={WEB3_ENABLED ? () => setShowTipModal(true) : undefined}
            disabled={!WEB3_ENABLED}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-ns border border-ns-border font-ui text-xs text-ns-ink-secondary transition-all duration-150 ${
              WEB3_ENABLED
                ? "hover:bg-ns-surface hover:text-ns-ink active:scale-[0.97]"
                : "opacity-50 cursor-not-allowed"
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            Support this author
          </button>
          {!WEB3_ENABLED && (
            <span className="inline-block px-2 py-0.5 rounded-full bg-ns-accent-subtle font-ui text-[10px] font-semibold text-ns-accent tracking-wide uppercase">
              Coming soon
            </span>
          )}
        </div>
      </section>

      {WEB3_ENABLED && showTipModal && (
        <Suspense fallback={null}>
          <Web3Boundary>
            <StoryTipModal
              author={displayAuthor}
              authorWalletAddress={
                authorWalletAddress ||
                "0x0000000000000000000000000000000000000000"
              }
              storyId={storyId}
              isOpen={showTipModal}
              onClose={() => setShowTipModal(false)}
            />
          </Web3Boundary>
        </Suspense>
      )}
    </>
  );
};
