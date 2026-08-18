import { useState, useRef, useEffect } from "react";
import { FaImage, FaUpload, FaMagic, FaTimes } from "react-icons/fa";
import {
  Eye,
  Heart,
  Star,
  BookOpen,
  PenLine,
  Trash2,
  EyeOff,
  MoreVertical,
  DollarSign,
  Loader2,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { StoryMetadata } from "@/types/IStory";
import { generateCover } from "@/services/imageGenerationService";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { storyWorkspaceRepo } from "@/services/StoryWorkspaceRepo";
import {
  fetchCoverAsset,
  buildEpub,
  toEpubFilename,
  downloadBlob,
} from "@/utils/epubExport";

interface StoryRowProps {
  story: StoryMetadata & {
    earnings?: { eth: string; usdc: string };
  };
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onPublish: (id: string) => void;
  onUnpublish: (id: string) => void;
  onEditDetails: (id: string) => void;
  onImageUpdate?: (
    id: string,
    imageFile: File | null,
    previewUrl: string | null,
  ) => void;
  isLoading?: boolean;
}

const formatNumber = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
};

const formatWordCount = (n?: number) => {
  if (!n) return null;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k words`;
  return `${n} words`;
};

const formatRelativeDate = (date: Date) => {
  const diff = Date.now() - new Date(date).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
};

export const StoryRow = ({
  story,
  onEdit,
  onDelete,
  onPublish,
  onUnpublish,
  onEditDetails,
  onImageUpdate,
  isLoading = false,
}: StoryRowProps) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showImagePanel, setShowImagePanel] = useState(false);
  const [showAiPrompt, setShowAiPrompt] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [showLightbox, setShowLightbox] = useState(false);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [showUnpublishConfirm, setShowUnpublishConfirm] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const imagePanelRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
      if (
        imagePanelRef.current &&
        !imagePanelRef.current.contains(e.target as Node)
      ) {
        setShowImagePanel(false);
        setShowAiPrompt(false);
      }
    };
    if (showMenu || showImagePanel) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMenu, showImagePanel]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowLightbox(false);
    };
    if (showLightbox) document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [showLightbox]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onImageUpdate) {
      onImageUpdate(story.id, file, URL.createObjectURL(file));
      setShowImagePanel(false);
    }
  };

  const handleRemoveImage = () => {
    if (onImageUpdate) {
      onImageUpdate(story.id, null, null);
      setShowImagePanel(false);
    }
  };

  const handleExportEpub = async () => {
    setIsExporting(true);
    try {
      const chapters = await storyWorkspaceRepo.getChaptersByStoryId(
        story.id,
        story.userId,
      );
      if (chapters.length === 0) {
        toast.error("This story has no chapters to export yet.");
        return;
      }
      const cover = await fetchCoverAsset(
        story.coverImageUrl || story.thumbnailUrl,
      );
      const blob = await buildEpub(story, story.id, chapters, cover);
      downloadBlob(blob, toEpubFilename(story.title));
      toast.success("EPUB downloaded.");
    } catch (error) {
      console.error("Error exporting EPUB:", error);
      toast.error("Failed to export EPUB. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleGenerateWithAI = async () => {
    if (!aiPrompt.trim()) return;
    setIsGenerating(true);
    setGenerationError(null);
    try {
      const result = await generateCover(aiPrompt);
      if (onImageUpdate) {
        onImageUpdate(story.id, result.file, result.imageUrl);
      }
      setShowAiPrompt(false);
      setShowImagePanel(false);
      setAiPrompt("");
    } catch (error) {
      setGenerationError(
        error instanceof Error ? error.message : "Failed to generate image",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const hasEarnings =
    story.earnings &&
    (parseFloat(story.earnings.eth) > 0 || parseFloat(story.earnings.usdc) > 0);

  return (
    <>
      <div
        className={`relative group flex gap-4 py-6 transition-colors duration-150 hover:bg-ns-surface-hover ${
          isLoading ? "opacity-50 pointer-events-none" : ""
        }`}
      >
        {/* Published accent bar */}
        <div
          className={`absolute left-0 top-8 bottom-8 w-[2px] rounded-full transition-colors ${
            story.isPublished ? "bg-ns-accent" : "bg-ns-border"
          }`}
        />

        {/* Cover image */}
        <div ref={imagePanelRef} className="relative flex-shrink-0 ml-4">
          {story.coverImageUrl ? (
            <img
              src={story.thumbnailUrl || story.coverImageUrl}
              alt={story.title}
              loading="lazy"
              decoding="async"
              onClick={() =>
                onImageUpdate
                  ? setShowImagePanel(!showImagePanel)
                  : setShowLightbox(true)
              }
              className="w-12 h-[68px] object-cover rounded shadow-ns-sm cursor-pointer hover:opacity-90 transition-opacity"
            />
          ) : (
            <div
              onClick={
                onImageUpdate
                  ? () => setShowImagePanel(!showImagePanel)
                  : undefined
              }
              className={`w-12 h-[68px] bg-ns-surface rounded border border-ns-border flex flex-col items-center justify-center text-ns-ink-muted ${
                onImageUpdate
                  ? "cursor-pointer hover:bg-ns-surface-hover transition-colors"
                  : ""
              }`}
            >
              <FaImage className="w-4 h-4" />
            </div>
          )}

          {/* Image management panel */}
          {showImagePanel && (
            <div className="absolute top-0 left-14 z-20 bg-ns-elevated border border-ns-border rounded-ns-lg shadow-ns-lg py-1.5 min-w-[196px]">
              {story.coverImageUrl && (
                <button
                  onClick={() => {
                    setShowImagePanel(false);
                    setShowLightbox(true);
                  }}
                  className="w-full px-3 py-2 text-left text-sm font-ui text-ns-ink hover:bg-ns-surface-hover flex items-center gap-2.5"
                >
                  <Eye className="w-3.5 h-3.5 text-ns-ink-muted" />
                  View full cover
                </button>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full px-3 py-2 text-left text-sm font-ui text-ns-ink hover:bg-ns-surface-hover flex items-center gap-2.5"
              >
                <FaUpload className="w-3.5 h-3.5 text-ns-ink-muted" />
                Upload image
              </button>
              <button
                onClick={() => {
                  setShowAiPrompt(true);
                  setShowImagePanel(false);
                }}
                className="w-full px-3 py-2 text-left text-sm font-ui text-ns-ink hover:bg-ns-surface-hover flex items-center gap-2.5"
              >
                <FaMagic className="w-3.5 h-3.5 text-ns-ink-muted" />
                Generate with AI
              </button>
              {story.coverImageUrl && (
                <>
                  <div className="my-1 border-t border-ns-border" />
                  <button
                    onClick={handleRemoveImage}
                    className="w-full px-3 py-2 text-left text-sm font-ui text-ns-destructive hover:bg-ns-surface-hover flex items-center gap-2.5"
                  >
                    <FaTimes className="w-3.5 h-3.5" />
                    Remove image
                  </button>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>
          )}

          {/* AI prompt panel */}
          {showAiPrompt && (
            <div className="absolute top-0 left-14 z-30 bg-ns-elevated border border-ns-border rounded-ns-lg shadow-ns-lg p-4 w-72">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-ui text-sm font-medium text-ns-ink">
                  Generate cover
                </h4>
                <button
                  onClick={() => {
                    setShowAiPrompt(false);
                    setAiPrompt("");
                    setGenerationError(null);
                  }}
                  className="text-ns-ink-muted hover:text-ns-ink transition-colors"
                >
                  <FaTimes className="w-3.5 h-3.5" />
                </button>
              </div>
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Describe the cover art..."
                className="w-full p-2.5 text-sm font-ui border border-ns-border rounded-ns bg-ns-surface text-ns-ink placeholder-ns-ink-muted resize-none focus:outline-none focus:ring-1 focus:ring-ns-accent"
                rows={3}
                disabled={isGenerating}
              />
              {generationError && (
                <p className="text-ns-destructive text-xs mt-1">
                  {generationError}
                </p>
              )}
              <button
                onClick={handleGenerateWithAI}
                disabled={isGenerating || !aiPrompt.trim()}
                className="mt-2.5 w-full py-2 text-sm font-ui font-medium text-white bg-ns-accent hover:bg-ns-accent-hover rounded-ns transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FaMagic className="w-3.5 h-3.5" />
                    Generate
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Story content */}
        <div className="flex-1 min-w-0 pr-2">
          {/* Title row */}
          <div className="flex items-start justify-between gap-4">
            <h3
              onClick={() => onEdit(story.id)}
              className="font-heading text-xl leading-snug text-ns-ink cursor-pointer hover:text-ns-accent transition-colors"
            >
              {story.title}
            </h3>

            {/* Actions */}
            <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
              {/* Status indicator */}
              <div
                className={`flex items-center gap-1.5 text-xs font-ui font-medium mr-2 ${
                  story.isPublished ? "text-ns-accent" : "text-ns-ink-muted"
                }`}
              >
                <div
                  className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    story.isPublished ? "bg-ns-accent" : "bg-ns-ink-muted"
                  }`}
                />
                {story.isPublished ? "Published" : "Draft"}
              </div>

              {/* Edit button — opens the story details editor */}
              <button
                onClick={() => onEditDetails(story.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-ui font-medium text-ns-ink bg-ns-surface hover:bg-ns-surface-hover border border-ns-border rounded-ns transition-colors"
              >
                <PenLine className="w-3 h-3" />
                Edit
              </button>

              {/* Overflow menu */}
              <div ref={menuRef} className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-1.5 rounded-ns text-ns-ink-muted hover:text-ns-ink hover:bg-ns-surface-hover transition-colors"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
                {showMenu && (
                  <div className="absolute right-0 top-8 z-20 bg-ns-elevated border border-ns-border rounded-ns-lg shadow-ns-lg py-1.5 min-w-[160px]">
                    <button
                      onClick={() => {
                        onEdit(story.id);
                        setShowMenu(false);
                      }}
                      className="w-full px-3 py-2 text-left text-sm font-ui text-ns-ink hover:bg-ns-surface-hover flex items-center gap-2.5"
                    >
                      <PenLine className="w-3.5 h-3.5 text-ns-ink-muted" />
                      Continue writing
                    </button>
                    <div className="my-1 border-t border-ns-border" />
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        handleExportEpub();
                      }}
                      disabled={isExporting}
                      className="w-full px-3 py-2 text-left text-sm font-ui text-ns-ink hover:bg-ns-surface-hover flex items-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isExporting ? (
                        <Loader2 className="w-3.5 h-3.5 text-ns-ink-muted animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5 text-ns-ink-muted" />
                      )}
                      {isExporting ? "Exporting…" : "Export as EPUB"}
                    </button>
                    <div className="my-1 border-t border-ns-border" />
                    {story.isPublished ? (
                      <button
                        onClick={() => {
                          setShowMenu(false);
                          setShowUnpublishConfirm(true);
                        }}
                        className="w-full px-3 py-2 text-left text-sm font-ui text-ns-ink hover:bg-ns-surface-hover flex items-center gap-2.5"
                      >
                        <EyeOff className="w-3.5 h-3.5 text-ns-ink-muted" />
                        Unpublish
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setShowMenu(false);
                            setShowPublishConfirm(true);
                          }}
                          className="w-full px-3 py-2 text-left text-sm font-ui text-ns-ink hover:bg-ns-surface-hover flex items-center gap-2.5"
                        >
                          <Eye className="w-3.5 h-3.5 text-ns-ink-muted" />
                          Publish
                        </button>
                        <button
                          onClick={() => {
                            setShowMenu(false);
                            setShowDeleteConfirm(true);
                          }}
                          className="w-full px-3 py-2 text-left text-sm font-ui text-ns-destructive hover:bg-ns-surface-hover flex items-center gap-2.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete story
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-xs font-ui text-ns-ink-muted">
            {story.category && (
              <>
                <span className="text-ns-ink-secondary">{story.category}</span>
                <span>·</span>
              </>
            )}
            <span className="flex items-center gap-1">
              <BookOpen className="w-3 h-3" />
              {story.chapterCount}{" "}
              {story.chapterCount === 1 ? "chapter" : "chapters"}
            </span>
            {story.wordCount && (
              <>
                <span>·</span>
                <span>{formatWordCount(story.wordCount)}</span>
              </>
            )}
            <span>·</span>
            <span>Updated {formatRelativeDate(story.updatedAt)}</span>
          </div>

          {/* Description */}
          {story.description && (
            <p className="mt-2 text-sm font-ui text-ns-ink-secondary leading-relaxed line-clamp-1">
              {story.description}
            </p>
          )}

          {/* Stats + earnings */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3">
            {(story.views > 0 || story.likes > 0 || story.averageRating) && (
              <div className="flex items-center gap-3 text-xs font-ui text-ns-ink-muted">
                {story.views > 0 && (
                  <span className="flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    {formatNumber(story.views)}
                  </span>
                )}
                {story.likes > 0 && (
                  <span className="flex items-center gap-1">
                    <Heart className="w-3 h-3" />
                    {formatNumber(story.likes)}
                  </span>
                )}
                {story.averageRating && (
                  <span className="flex items-center gap-1">
                    <Star className="w-3 h-3 fill-ns-gold text-ns-gold" />
                    {story.averageRating.toFixed(1)}
                    {story.ratingsCount && (
                      <span className="opacity-60">({story.ratingsCount})</span>
                    )}
                  </span>
                )}
              </div>
            )}

            {hasEarnings && (
              <div className="flex items-center gap-3 text-xs font-ui">
                {parseFloat(story.earnings!.eth) > 0 && (
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                    <DollarSign className="w-3 h-3" />
                    {parseFloat(story.earnings!.eth).toFixed(4)} ETH
                  </span>
                )}
                {parseFloat(story.earnings!.usdc) > 0 && (
                  <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium">
                    <DollarSign className="w-3 h-3" />
                    {parseFloat(story.earnings!.usdc).toFixed(2)} USDC
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-ns-accent" />
          </div>
        )}
      </div>

      {/* Lightbox */}
      {showLightbox && story.coverImageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setShowLightbox(false)}
        >
          <div
            className="relative max-w-3xl max-h-[90vh] mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowLightbox(false)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors"
            >
              <FaTimes className="w-6 h-6" />
            </button>
            <img
              src={story.coverImageUrl}
              alt={story.title}
              className="max-w-full max-h-[80vh] object-contain rounded-ns-lg"
            />
            {onImageUpdate && (
              <div className="flex justify-center gap-3 mt-4">
                <button
                  onClick={() => {
                    setShowLightbox(false);
                    setShowImagePanel(true);
                  }}
                  className="px-4 py-2 text-sm font-ui font-medium text-white bg-white/10 hover:bg-white/20 rounded-ns transition-colors flex items-center gap-2"
                >
                  <FaUpload className="w-3.5 h-3.5" />
                  Change cover
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Publish confirmation */}
      <ConfirmDialog
        open={showPublishConfirm}
        onOpenChange={setShowPublishConfirm}
        title="Publish story?"
        description={`"${story.title}" will become visible to readers. You can unpublish it again at any time.`}
        confirmLabel="Publish"
        cancelLabel="Cancel"
        onConfirm={() => onPublish(story.id)}
      />

      {/* Unpublish confirmation */}
      <ConfirmDialog
        open={showUnpublishConfirm}
        onOpenChange={setShowUnpublishConfirm}
        title="Unpublish story?"
        description={`"${story.title}" will be hidden from readers and returned to draft. You can publish it again at any time.`}
        confirmLabel="Unpublish"
        cancelLabel="Keep published"
        onConfirm={() => onUnpublish(story.id)}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete story?"
        description={`"${story.title}" will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete story"
        cancelLabel="Keep story"
        variant="danger"
        onConfirm={() => onDelete(story.id)}
      />
    </>
  );
};
