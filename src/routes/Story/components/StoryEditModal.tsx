import { useState, useEffect, useRef, KeyboardEvent } from "react";
import { X } from "lucide-react";
import { StoryMetadata } from "@novelsync/story-data-client";
import {
  STORY_CATEGORIES,
  COPYRIGHT_OPTIONS,
  STORY_TAGS,
  MAX_STORY_TAGS,
  TARGET_AUDIENCES,
  LANGUAGES,
} from "@/constants/storyOptions";
import { TagMultiSelect } from "@/components/common";

interface StoryEditModalProps {
  story: Pick<
    StoryMetadata,
    | "id"
    | "title"
    | "description"
    | "category"
    | "tags"
    | "targetAudience"
    | "language"
    | "copyright"
  >;
  onSave: (
    id: string,
    data: {
      title: string;
      description: string;
      category?: string;
      tags?: string[];
      targetAudience?: string;
      language?: string;
      copyright?: string;
    },
  ) => Promise<void>;
  onClose: () => void;
}

const fieldClass =
  "w-full px-3 py-2 text-sm font-ui bg-ns-surface border border-ns-border rounded-ns text-ns-ink placeholder-ns-ink-muted focus:outline-none focus:ring-1 focus:ring-ns-accent focus:border-ns-accent transition-colors";
const labelClass =
  "block text-xs font-ui font-semibold uppercase tracking-widest text-ns-ink-muted mb-1.5";

export const StoryEditModal = ({
  story,
  onSave,
  onClose,
}: StoryEditModalProps) => {
  const [title, setTitle] = useState(story.title);
  const [description, setDescription] = useState(story.description ?? "");
  const [category, setCategory] = useState(story.category ?? "");
  const [tags, setTags] = useState<string[]>(story.tags ?? []);
  const [targetAudience, setTargetAudience] = useState(
    story.targetAudience ?? "",
  );
  const [language, setLanguage] = useState(story.language ?? "");
  const [copyright, setCopyright] = useState(story.copyright ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleEsc = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Title is required.");
      titleRef.current?.focus();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // Firestore rejects `undefined` field values, so send empty strings /
      // arrays (not undefined) — this also lets a cleared field persist as empty.
      await onSave(story.id, {
        title: trimmedTitle,
        description: description.trim(),
        category: category.trim(),
        tags,
        targetAudience: targetAudience.trim(),
        language: language.trim(),
        copyright: copyright.trim(),
      });
      onClose();
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleFieldKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSave();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/60"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg mx-4 bg-ns-elevated rounded-ns-xl shadow-ns-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ns-border">
          <h2 className="font-heading text-xl text-ns-ink">
            Edit story details
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-ns text-ns-ink-muted hover:text-ns-ink hover:bg-ns-surface-hover transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 max-h-[70vh] overflow-y-auto space-y-5">
          {/* Title */}
          <div>
            <label className="block text-xs font-ui font-semibold uppercase tracking-widest text-ns-ink-muted mb-1.5">
              Title
            </label>
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={handleFieldKeyDown}
              className="w-full px-3 py-2 text-sm font-ui bg-ns-surface border border-ns-border rounded-ns text-ns-ink placeholder-ns-ink-muted focus:outline-none focus:ring-1 focus:ring-ns-accent focus:border-ns-accent transition-colors"
              placeholder="Story title"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-ui font-semibold uppercase tracking-widest text-ns-ink-muted mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 text-sm font-ui bg-ns-surface border border-ns-border rounded-ns text-ns-ink placeholder-ns-ink-muted focus:outline-none focus:ring-1 focus:ring-ns-accent focus:border-ns-accent transition-colors resize-none"
              placeholder="A short description of your story..."
            />
          </div>

          {/* Category + Target audience */}
          <div className="grid grid-cols-2 gap-4">
            {/* Category */}
            <div>
              <label className={labelClass}>Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={fieldClass}
              >
                <option value="">Select category…</option>
                {STORY_CATEGORIES.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
                {/* Preserve a legacy/custom value not in the preset list */}
                {category &&
                  !STORY_CATEGORIES.some((c) => c.value === category) && (
                    <option value={category}>{category}</option>
                  )}
              </select>
            </div>

            {/* Target audience */}
            <div>
              <label className={labelClass}>Target audience</label>
              <select
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                className={fieldClass}
              >
                <option value="">Select audience…</option>
                {TARGET_AUDIENCES.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
                {/* Preserve a legacy/custom value not in the preset list */}
                {targetAudience &&
                  !TARGET_AUDIENCES.some((a) => a.value === targetAudience) && (
                    <option value={targetAudience}>{targetAudience}</option>
                  )}
              </select>
            </div>
          </div>

          {/* Language + Copyright */}
          <div className="grid grid-cols-2 gap-4">
            {/* Language */}
            <div>
              <label className={labelClass}>Language</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className={fieldClass}
              >
                <option value="">Select language…</option>
                {LANGUAGES.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
                {/* Preserve a legacy/custom value not in the preset list */}
                {language && !LANGUAGES.some((l) => l.value === language) && (
                  <option value={language}>{language}</option>
                )}
              </select>
            </div>

            {/* Copyright */}
            <div>
              <label className={labelClass}>Copyright</label>
              <select
                value={copyright}
                onChange={(e) => setCopyright(e.target.value)}
                className={fieldClass}
              >
                <option value="">Select copyright…</option>
                {COPYRIGHT_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className={labelClass}>
              Tags{" "}
              <span className="normal-case font-normal tracking-normal opacity-60">
                ({tags.length}/{MAX_STORY_TAGS})
              </span>
            </label>
            <TagMultiSelect
              options={STORY_TAGS}
              value={tags}
              onChange={setTags}
              max={MAX_STORY_TAGS}
              placeholder="Select tags…"
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs font-ui text-ns-destructive">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-ns-border">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-ui text-ns-ink hover:bg-ns-surface-hover rounded-ns transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-ui font-medium text-white bg-ns-accent hover:bg-ns-accent-hover rounded-ns transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
};
