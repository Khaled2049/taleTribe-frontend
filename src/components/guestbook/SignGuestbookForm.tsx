import React, { useState } from "react";

interface SignGuestbookFormProps {
  onSubmit: (content: string) => Promise<void>;
  isLoading?: boolean;
  isOwnGuestbook?: boolean;
}

const SignGuestbookForm: React.FC<SignGuestbookFormProps> = ({
  onSubmit,
  isLoading = false,
  isOwnGuestbook = false,
}) => {
  const [content, setContent] = useState("");
  const maxCharacters = 280;

  const submitEntry = async () => {
    if (!content.trim() || isLoading) return;
    try {
      await onSubmit(content.trim());
      setContent("");
    } catch (error) {
      console.error("Error in form submission:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await submitEntry();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitEntry();
    }
  };

  const remainingChars = maxCharacters - content.length;
  const isNearLimit = remainingChars < 20;
  const isOverLimit = remainingChars < 0;

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-ns-surface border border-ns-border rounded-ns-lg px-[22px] py-5 mb-7"
    >
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={
          isOwnGuestbook
            ? "Leave a note on your own page…"
            : "Sign the guestbook…"
        }
        rows={2}
        maxLength={maxCharacters}
        disabled={isLoading}
        aria-label="Guestbook entry"
        className="
          w-full resize-none bg-transparent border-0 outline-none
          font-body text-ns-ink placeholder:text-ns-ink-muted
          text-[17px] leading-relaxed min-h-[44px]
          disabled:opacity-50
        "
      />

      <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-ns-border">
        <span
          className={`font-ui text-[13px] tabular-nums ${
            isOverLimit
              ? "text-ns-destructive font-semibold"
              : isNearLimit
                ? "text-ns-destructive"
                : "text-ns-ink-muted"
          }`}
        >
          {content.length} / {maxCharacters}
        </span>

        <button
          type="submit"
          disabled={!content.trim() || isLoading || isOverLimit}
          className="
            inline-flex items-center px-5 py-[9px]
            bg-ns-accent text-white rounded-full
            font-ui text-sm
            hover:bg-ns-accent-hover
            transition-colors duration-200
            disabled:opacity-40 disabled:cursor-not-allowed
          "
        >
          {isLoading ? "Signing…" : "Sign"}
        </button>
      </div>
    </form>
  );
};

export default SignGuestbookForm;
