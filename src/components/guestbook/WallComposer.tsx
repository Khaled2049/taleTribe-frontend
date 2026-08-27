import React, { useState } from "react";
import { IUser } from "@/types/IUser";
import {
  GUESTBOOK_POLICY_LABELS,
  GuestbookPolicy,
} from "@/lib/guestbookPolicy";

interface WallComposerProps {
  currentUser: IUser;
  policy: GuestbookPolicy;
  onSubmit: (content: string) => Promise<void>;
  isLoading?: boolean;
}

const MAX_CHARACTERS = 280;

/**
 * Always posts to the signed-in user's own wall — this is "post to your
 * wall" at the top of your personal feed, distinct from SignGuestbookForm,
 * which signs someone *else's* guestbook.
 */
const WallComposer: React.FC<WallComposerProps> = ({
  currentUser,
  policy,
  onSubmit,
  isLoading = false,
}) => {
  const [content, setContent] = useState("");
  const initial = (currentUser.username || "?").charAt(0).toUpperCase();
  const audienceLabel = GUESTBOOK_POLICY_LABELS[policy].label;

  const submit = async () => {
    if (!content.trim() || isLoading || content.length > MAX_CHARACTERS) return;
    try {
      await onSubmit(content.trim());
      setContent("");
    } catch (error) {
      console.error("Error posting to wall:", error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="border border-ns-border rounded-ns-lg bg-ns-elevated px-[18px] py-4"
    >
      <div className="flex gap-3">
        <div className="w-[38px] h-[38px] flex-shrink-0 rounded-full bg-ns-ink text-white flex items-center justify-center font-ui font-bold text-[15px]">
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Post to your wall — a line, a question, a chapter…"
            rows={2}
            maxLength={MAX_CHARACTERS}
            disabled={isLoading}
            aria-label="Post to your wall"
            className="w-full resize-none bg-transparent border-0 outline-none font-body text-[19px] text-ns-ink placeholder:text-ns-ink-muted py-1.5 leading-relaxed disabled:opacity-50"
          />

          <div className="flex items-center gap-3 justify-end border-t border-ns-border pt-3 mt-1">
            <span className="font-ui text-[12.5px] text-ns-ink-muted">
              Visible to {audienceLabel.toLowerCase()}
            </span>
            <button
              type="submit"
              disabled={!content.trim() || isLoading}
              className="bg-ns-accent text-white font-ui text-sm font-bold px-[22px] py-[9px] rounded-full hover:bg-ns-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isLoading ? "Posting…" : "Post"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
};

export default WallComposer;
