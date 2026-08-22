import React, { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import CoWriteWizard from "./CoWriteWizard";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Upload, Loader2, AlertCircle, FileText, PenLine } from "lucide-react";
import { toast } from "sonner";
import { storyWorkspaceRepo } from "@novelsync/story-data-client";
import { storageService } from "@/services/StorageService";
import CoverImagePicker from "./components/CoverImagePicker";
import {
  validateTextFile,
  parseTextFile,
  ParsedChapter,
} from "@/utils/textFileParser";
import {
  STORY_CATEGORIES,
  COPYRIGHT_OPTIONS,
  STORY_TAGS,
  MAX_STORY_TAGS,
  TARGET_AUDIENCES,
  LANGUAGES,
} from "@/constants/storyOptions";
import { TagMultiSelect } from "@/components/common";

type Mode = "create" | "import";

interface StoryMetadataModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

const StoryMetadataModal: React.FC<StoryMetadataModalProps> = ({
  isOpen,
  onClose,
  userId,
}) => {
  const navigate = useNavigate();

  // ── Mode ────────────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<Mode>("create");

  // ── Metadata fields ─────────────────────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [targetAudience, setTargetAudience] = useState("");
  const [language, setLanguage] = useState("");
  const [copyright, setCopyright] = useState("");

  // ── Cover image ─────────────────────────────────────────────────────────────
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // ── Import state ─────────────────────────────────────────────────────────────
  const [importFile, setImportFile] = useState<File | null>(null);
  const [parsedChapters, setParsedChapters] = useState<ParsedChapter[]>([]);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);

  // ── Submission state ─────────────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const resetImportState = () => {
    setImportFile(null);
    setParsedChapters([]);
    setParseWarnings([]);
    setImportError(null);
  };

  const handleModeChange = (next: Mode) => {
    setMode(next);
    resetImportState();
  };

  const processImportFile = useCallback(async (file: File) => {
    setImportError(null);

    const validationError = validateTextFile(file);
    if (validationError) {
      setImportError(validationError);
      return;
    }

    setImportFile(file);
    const text = await file.text();
    const { chapters, warnings } = parseTextFile(text);
    setParsedChapters(chapters);
    setParseWarnings(warnings);
  }, []);

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImportFile(file);
    // Reset input value so the same file can be re-selected if removed
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processImportFile(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  // ── Submission ───────────────────────────────────────────────────────────────

  const buildMetadata = () => ({
    category,
    tags,
    targetAudience,
    language,
    copyright,
    coverImageUrl: "",
  });

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile || parsedChapters.length === 0) {
      toast.error("Please upload a text file before creating the story.");
      return;
    }

    setIsSubmitting(true);
    try {
      let coverImageUrl = "";
      let thumbnailUrl = "";
      if (coverImage) {
        ({ coverImageUrl, thumbnailUrl } =
          await storageService.uploadCoverImage(
            coverImage,
            userId,
            `new-${Date.now()}`,
          ));
      }

      // Create the story (auto-creates the first chapter with empty content)
      const createdStory = await storyWorkspaceRepo.createStory({
        title,
        description,
        authorName: "",
        ...buildMetadata(),
        coverImageUrl,
        thumbnailUrl,
        published: false,
      });
      const newStoryId = createdStory.id;

      // Fetch the auto-created first chapter so we can overwrite it
      const existingChapters =
        await storyWorkspaceRepo.getChapters(createdStory);
      const autoChapter = existingChapters[0];

      // Update the first chapter with imported content
      if (autoChapter) {
        await storyWorkspaceRepo.updateChapter(
          createdStory,
          autoChapter,
          parsedChapters[0].title,
          parsedChapters[0].content,
        );
      }

      // Create and populate remaining chapters sequentially
      for (let i = 1; i < parsedChapters.length; i++) {
        const chapter = await storyWorkspaceRepo.createChapter(
          createdStory,
          parsedChapters[i].title,
          i,
        );
        await storyWorkspaceRepo.updateChapter(
          createdStory,
          chapter,
          parsedChapters[i].title,
          parsedChapters[i].content,
        );
      }

      toast.success(
        `Story created with ${parsedChapters.length} chapter${parsedChapters.length !== 1 ? "s" : ""} imported.`,
      );
      onClose();
      navigate(`/create/${newStoryId}`);
    } catch (error) {
      console.error("Error importing story:", error);
      toast.error("Failed to import story. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = handleImportSubmit;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-w-[95vw] max-h-[90vh] flex flex-col bg-white dark:bg-neutral-900 text-black dark:text-white border-0 shadow-2xl rounded-xl transition-all duration-200 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-200 dark:border-neutral-800">
          <DialogTitle className="text-2xl font-bold text-black dark:text-white">
            Create New Story
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Fill in the details to start your new story
          </DialogDescription>
        </DialogHeader>

        {/* ── Mode toggle ──────────────────────────────────────────────────
            Kept outside the form so it stays visible in both modes, letting
            users switch between the guided New Story stepper and Import. */}
        <div className="px-6 pt-4">
          <div className="flex rounded-lg border border-gray-200 dark:border-neutral-700 overflow-hidden">
            <button
              type="button"
              onClick={() => handleModeChange("create")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
                mode === "create"
                  ? "bg-dark-green dark:bg-light-green text-white"
                  : "bg-white dark:bg-neutral-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-neutral-700"
              }`}
            >
              <PenLine className="w-4 h-4" />
              New Story
            </button>
            <button
              type="button"
              onClick={() => handleModeChange("import")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors border-l border-gray-200 dark:border-neutral-700 ${
                mode === "import"
                  ? "bg-dark-green dark:bg-light-green text-white"
                  : "bg-white dark:bg-neutral-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-neutral-700"
              }`}
            >
              <Upload className="w-4 h-4" />
              Import Existing
            </button>
          </div>
        </div>

        {mode === "create" ? (
          <div className="flex-grow flex flex-col min-h-0">
            <CoWriteWizard
              userId={userId}
              onClose={onClose}
              onSuccess={(id) => {
                onClose();
                navigate(`/create/${id}`);
              }}
            />
          </div>
        ) : null}

        <div
          className={`flex-grow overflow-y-auto px-6 py-4 ${mode === "create" ? "hidden" : ""}`}
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* ── Metadata grid ─────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label
                    htmlFor="title"
                    className="text-sm font-semibold text-gray-700 dark:text-gray-300"
                  >
                    Title <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    placeholder="Enter story title"
                    className="h-11 bg-gray-50 dark:bg-neutral-800 text-black dark:text-white border-gray-300 dark:border-neutral-700 focus:ring-2 focus:ring-dark-green dark:focus:ring-light-green focus:border-transparent transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="description"
                    className="text-sm font-semibold text-gray-700 dark:text-gray-300"
                  >
                    Description
                  </Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description of your story"
                    rows={4}
                    className="bg-gray-50 dark:bg-neutral-800 text-black dark:text-white border-gray-300 dark:border-neutral-700 focus:ring-2 focus:ring-dark-green dark:focus:ring-light-green focus:border-transparent transition-all resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="category"
                    className="text-sm font-semibold text-gray-700 dark:text-gray-300"
                  >
                    Category
                  </Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="h-11 bg-gray-50 dark:bg-neutral-800 text-black dark:text-white border-gray-300 dark:border-neutral-700 focus:ring-2 focus:ring-dark-green dark:focus:ring-light-green">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-neutral-800 border-gray-200 dark:border-neutral-700">
                      {STORY_CATEGORIES.map(({ value, label }) => (
                        <SelectItem
                          key={value}
                          value={value}
                          className="text-black dark:text-white hover:bg-gray-100 dark:hover:bg-neutral-700 focus:bg-gray-100 dark:focus:bg-neutral-700"
                        >
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Tags
                  </Label>
                  <TagMultiSelect
                    options={STORY_TAGS}
                    value={tags}
                    onChange={setTags}
                    max={MAX_STORY_TAGS}
                    placeholder="Select tags"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Choose up to {MAX_STORY_TAGS} tags
                  </p>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Target Audience
                  </Label>
                  <Select
                    value={targetAudience}
                    onValueChange={setTargetAudience}
                  >
                    <SelectTrigger className="h-11 bg-gray-50 dark:bg-neutral-800 text-black dark:text-white border-gray-300 dark:border-neutral-700 focus:ring-2 focus:ring-dark-green dark:focus:ring-light-green">
                      <SelectValue placeholder="Select audience" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-neutral-800 border-gray-200 dark:border-neutral-700">
                      {TARGET_AUDIENCES.map(({ value, label }) => (
                        <SelectItem
                          key={value}
                          value={value}
                          className="text-black dark:text-white hover:bg-gray-100 dark:hover:bg-neutral-700 focus:bg-gray-100 dark:focus:bg-neutral-700"
                        >
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Language
                  </Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger className="h-11 bg-gray-50 dark:bg-neutral-800 text-black dark:text-white border-gray-300 dark:border-neutral-700 focus:ring-2 focus:ring-dark-green dark:focus:ring-light-green">
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-neutral-800 border-gray-200 dark:border-neutral-700">
                      {LANGUAGES.map(({ value, label }) => (
                        <SelectItem
                          key={value}
                          value={value}
                          className="text-black dark:text-white hover:bg-gray-100 dark:hover:bg-neutral-700 focus:bg-gray-100 dark:focus:bg-neutral-700"
                        >
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Copyright
                  </Label>
                  <Select value={copyright} onValueChange={setCopyright}>
                    <SelectTrigger className="h-11 bg-gray-50 dark:bg-neutral-800 text-black dark:text-white border-gray-300 dark:border-neutral-700 focus:ring-2 focus:ring-dark-green dark:focus:ring-light-green">
                      <SelectValue placeholder="Select copyright" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-neutral-800 border-gray-200 dark:border-neutral-700">
                      {COPYRIGHT_OPTIONS.map(({ value, label }) => (
                        <SelectItem
                          key={value}
                          value={value}
                          className="text-black dark:text-white hover:bg-gray-100 dark:hover:bg-neutral-700 focus:bg-gray-100 dark:focus:bg-neutral-700"
                        >
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* ── Cover image ───────────────────────────────────────────────── */}
            <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-neutral-800">
              <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300 block">
                Cover Image
              </Label>
              <CoverImagePicker
                title={title}
                description={description}
                previewUrl={imagePreview}
                onChange={(file, preview) => {
                  setCoverImage(file);
                  setImagePreview(preview);
                }}
              />
            </div>

            {/* ── Import section (only in import mode) ─────────────────────── */}
            {mode === "import" && (
              <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-neutral-800">
                <div>
                  <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                    Text File <span className="text-red-500">*</span>
                  </Label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    Upload a <code className="font-mono">.txt</code> file (max 5
                    MB). Chapters are auto-detected from headings like "Chapter
                    1", "Part Two", "Prologue", etc.
                  </p>

                  {/* Hidden file input */}
                  <input
                    ref={importFileRef}
                    type="file"
                    accept=".txt,text/plain"
                    onChange={handleImportFileChange}
                    className="hidden"
                  />

                  {/* Drop zone */}
                  <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => importFileRef.current?.click()}
                    className={`cursor-pointer border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                      isDragging
                        ? "border-dark-green dark:border-light-green bg-green-50 dark:bg-green-950/20"
                        : importFile
                          ? "border-green-400 dark:border-green-600 bg-green-50 dark:bg-green-950/20"
                          : "border-gray-300 dark:border-neutral-600 hover:border-dark-green dark:hover:border-light-green bg-gray-50 dark:bg-neutral-800/50"
                    }`}
                  >
                    {importFile ? (
                      <div className="flex items-center justify-center gap-3">
                        <FileText className="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0" />
                        <div className="text-left">
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate max-w-xs">
                            {importFile.name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {(importFile.size / 1024).toFixed(1)} KB · click to
                            replace
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Upload className="w-8 h-8 mx-auto text-gray-400 dark:text-gray-500" />
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          <span className="font-medium text-dark-green dark:text-light-green">
                            Click to upload
                          </span>{" "}
                          or drag and drop
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500">
                          Plain text (.txt) files only
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Import error */}
                  {importError && (
                    <div className="mt-3 p-3 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 rounded-lg flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                      <p className="text-sm">{importError}</p>
                    </div>
                  )}
                </div>

                {/* Parse warnings */}
                {parseWarnings.length > 0 && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 rounded-lg space-y-1">
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                      Import notices:
                    </p>
                    {parseWarnings.map((w, i) => (
                      <p
                        key={i}
                        className="text-xs text-amber-600 dark:text-amber-400"
                      >
                        • {w}
                      </p>
                    ))}
                  </div>
                )}

                {/* Chapter preview */}
                {parsedChapters.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Detected {parsedChapters.length} chapter
                      {parsedChapters.length !== 1 ? "s" : ""}:
                    </p>
                    <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-200 dark:border-neutral-700 divide-y divide-gray-100 dark:divide-neutral-700">
                      {parsedChapters.map((ch, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between px-3 py-2 bg-white dark:bg-neutral-800"
                        >
                          <span className="text-sm text-gray-800 dark:text-gray-200 truncate max-w-[70%]">
                            {ch.title}
                          </span>
                          <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0 ml-2">
                            {ch.wordCount.toLocaleString()} words
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </form>
        </div>

        {mode === "import" && (
          <DialogFooter className="px-6 py-4 border-t border-gray-200 dark:border-neutral-800 dark:bg-neutral-900/50">
            <div className="flex gap-3 w-full sm:w-auto sm:ml-auto">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="h-11 px-6"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                onClick={handleSubmit}
                disabled={isSubmitting || parsedChapters.length === 0}
                className="h-11 px-8 bg-gradient-to-r from-dark-green to-light-green dark:from-light-green dark:to-dark-green text-white hover:shadow-lg transition-all shadow-md font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importing…
                  </>
                ) : (
                  "Import Story"
                )}
              </Button>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default StoryMetadataModal;
