import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Sparkles, Upload, Loader2, AlertCircle, X } from "lucide-react";
import { toast } from "sonner";
import { generateCover } from "@/cloudFunctions/images";

interface CoverImagePickerProps {
  /** Used to build the default AI prompt when none is supplied. */
  title: string;
  description?: string;
  /** Current preview data URL / remote URL, or null. */
  previewUrl: string | null;
  /** Called whenever the chosen cover changes (upload, AI gen, or clear). */
  onChange: (file: File | null, previewUrl: string | null) => void;
}

/**
 * Controlled cover-image field: upload from disk or generate with AI.
 * The parent owns the resulting File + preview URL; this component owns the
 * transient UI (AI prompt panel, generation state). Shared by the create
 * stepper's Concept step and the import form so the two never diverge.
 */
const CoverImagePicker: React.FC<CoverImagePickerProps> = ({
  title,
  description = "",
  previewUrl,
  onChange,
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAiPrompt, setShowAiPrompt] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [generationError, setGenerationError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => onChange(file, (ev.target?.result as string) ?? null);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const generateAICover = async () => {
    setIsGenerating(true);
    setGenerationError(null);
    try {
      const prompt =
        aiPrompt ||
        `Book cover for "${title}". ${description}. Professional, eye-catching design.`;
      const result = await generateCover(prompt);
      onChange(result.file, result.imageUrl);
      setShowAiPrompt(false);
      setAiPrompt("");
      toast.success("Cover image generated successfully!");
    } catch (error) {
      console.error("Error generating AI cover:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Failed to generate AI cover. Please try again.";
      setGenerationError(message);
      toast.error("Failed to generate cover image", { description: message });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-3">
      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        ref={fileRef}
        className="hidden"
      />
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          type="button"
          onClick={() => fileRef.current?.click()}
          variant="outline"
          className="flex-1 h-11 border-ns-border text-ns-ink hover:border-ns-accent"
        >
          <Upload className="w-4 h-4 mr-2" />
          Upload Image
        </Button>
        <Button
          type="button"
          onClick={() => {
            setShowAiPrompt((s) => !s);
            setGenerationError(null);
          }}
          className="flex-1 h-11 bg-gradient-to-r from-purple-600 to-purple-700 text-white hover:from-purple-700 hover:to-purple-800 transition-all shadow-md border-0"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          Generate with AI
        </Button>
      </div>

      {showAiPrompt && (
        <div className="space-y-3 p-4 border border-purple-200 dark:border-purple-800 rounded-lg bg-purple-50/60 dark:bg-purple-950/20">
          <Label className="text-sm font-medium text-ns-ink-secondary">
            Describe your cover (optional — uses title & description if empty)
          </Label>
          <Textarea
            value={aiPrompt}
            onChange={(e) => {
              setAiPrompt(e.target.value);
              setGenerationError(null);
            }}
            placeholder="E.g., A mystical forest with glowing trees and a mysterious figure…"
            rows={3}
            className="bg-ns-surface border-ns-border text-ns-ink focus:ring-purple-500"
          />

          {generationError && (
            <div className="p-3 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium">Generation Failed</p>
                <p className="text-xs mt-1">{generationError}</p>
              </div>
              <button
                type="button"
                onClick={() => setGenerationError(null)}
                className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 transition-colors"
                aria-label="Dismiss error"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <Button
            type="button"
            onClick={generateAICover}
            disabled={isGenerating || !title}
            className="w-full h-10 bg-gradient-to-r from-purple-600 to-purple-700 text-white hover:from-purple-700 hover:to-purple-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Cover
              </>
            )}
          </Button>
        </div>
      )}

      {previewUrl && (
        <div className="p-4 border border-ns-border rounded-lg bg-ns-surface">
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs font-medium text-ns-ink-muted">
              Preview
            </Label>
            <button
              type="button"
              onClick={() => onChange(null, null)}
              className="text-xs font-ui text-ns-ink-muted hover:text-ns-destructive transition-colors inline-flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Remove
            </button>
          </div>
          <div className="relative rounded-lg overflow-hidden border border-ns-border shadow-md">
            <img
              src={previewUrl}
              alt="Cover preview"
              className="w-full h-auto max-h-64 object-contain bg-ns-elevated"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default CoverImagePicker;
