import { Place } from "@novelsync/story-data-client";
import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { validateImageFile } from "@/utils/imageUpload";

interface AddPlaceModalProps {
  storyId: string;
  onClose: () => void;
  onAddPlace: (
    place: Omit<Place, "id">,
    imageFile: File | null,
  ) => Promise<void>;
}

const AddPlaceModal = ({
  storyId,
  onClose,
  onAddPlace,
}: AddPlaceModalProps) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [atmosphere, setAtmosphere] = useState("");
  const [geography, setGeography] = useState("");
  const [history, setHistory] = useState("");
  const [significance, setSignificance] = useState("");
  const [notes, setNotes] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    const validationError = validateImageFile(file);
    if (validationError) {
      setSubmitError(validationError);
      return;
    }
    setSubmitError(null);
    // Object URLs live until revoked or the document unloads.
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onAddPlace(
        {
          name: name.trim(),
          description: description || undefined,
          atmosphere: atmosphere || undefined,
          geography: geography || undefined,
          history: history || undefined,
          significance: significance || undefined,
          notes: notes || undefined,
          storyId,
          userId: "",
        },
        imageFile,
      );
    } catch (error) {
      console.error("Error adding place:", error);
      setSubmitError(
        error instanceof Error ? error.message : "Failed to create place.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 p-4">
      <div className="bg-ns-surface border border-ns-border rounded-ns-lg shadow-ns-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-ns-border flex-shrink-0">
          <h2 className="font-heading italic text-xl text-ns-ink">New Place</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-ns text-ns-ink-muted hover:text-ns-ink hover:bg-ns-elevated transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable form */}
        <form
          onSubmit={handleSubmit}
          className="flex flex-col flex-1 overflow-y-auto"
        >
          <div className="px-5 py-4 space-y-4">
            {/* Image upload */}
            <div
              onClick={() => imageInputRef.current?.click()}
              className="relative w-full h-36 rounded-ns border-2 border-dashed border-ns-border bg-ns-bg hover:border-ns-accent cursor-pointer transition-colors overflow-hidden group"
            >
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt="Location preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-ns-ink-muted group-hover:text-ns-accent transition-colors">
                  <ImagePlus className="w-6 h-6" />
                  <span className="font-ui text-xs">
                    Upload location image (optional)
                  </span>
                </div>
              )}
              {imagePreview && (
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="font-ui text-xs text-white">
                    Change image
                  </span>
                </div>
              )}
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageSelect}
              />
            </div>

            {/* Name */}
            <div className="space-y-1">
              <label className="font-ui text-[10px] font-semibold text-ns-ink-muted uppercase tracking-widest">
                Name <span className="text-ns-destructive">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Location name"
                required
                className="w-full font-ui text-sm text-ns-ink bg-ns-bg border border-ns-border rounded-ns px-3 py-2 focus:outline-none focus:border-ns-accent transition-colors placeholder:text-ns-ink-muted"
              />
            </div>

            {/* Description */}
            <div className="space-y-1">
              <label className="font-ui text-[10px] font-semibold text-ns-ink-muted uppercase tracking-widest">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this place? A brief overview…"
                rows={2}
                className="w-full font-body text-sm text-ns-ink bg-ns-bg border border-ns-border rounded-ns px-3 py-2 resize-none focus:outline-none focus:border-ns-accent transition-colors placeholder:text-ns-ink-muted"
              />
            </div>

            {/* Atmosphere */}
            <div className="space-y-1">
              <label className="font-ui text-[10px] font-semibold text-ns-ink-muted uppercase tracking-widest">
                Atmosphere
              </label>
              <textarea
                value={atmosphere}
                onChange={(e) => setAtmosphere(e.target.value)}
                placeholder="Mood, sensory details, sounds, smells, light…"
                rows={2}
                className="w-full font-body text-sm text-ns-ink bg-ns-bg border border-ns-border rounded-ns px-3 py-2 resize-none focus:outline-none focus:border-ns-accent transition-colors placeholder:text-ns-ink-muted"
              />
            </div>

            {/* Geography */}
            <div className="space-y-1">
              <label className="font-ui text-[10px] font-semibold text-ns-ink-muted uppercase tracking-widest">
                Geography
              </label>
              <textarea
                value={geography}
                onChange={(e) => setGeography(e.target.value)}
                placeholder="Physical layout, terrain, surroundings…"
                rows={2}
                className="w-full font-body text-sm text-ns-ink bg-ns-bg border border-ns-border rounded-ns px-3 py-2 resize-none focus:outline-none focus:border-ns-accent transition-colors placeholder:text-ns-ink-muted"
              />
            </div>

            {/* History */}
            <div className="space-y-1">
              <label className="font-ui text-[10px] font-semibold text-ns-ink-muted uppercase tracking-widest">
                History
              </label>
              <textarea
                value={history}
                onChange={(e) => setHistory(e.target.value)}
                placeholder="Origins, past events, how it came to be…"
                rows={2}
                className="w-full font-body text-sm text-ns-ink bg-ns-bg border border-ns-border rounded-ns px-3 py-2 resize-none focus:outline-none focus:border-ns-accent transition-colors placeholder:text-ns-ink-muted"
              />
            </div>

            {/* Significance */}
            <div className="space-y-1">
              <label className="font-ui text-[10px] font-semibold text-ns-ink-muted uppercase tracking-widest">
                Significance
              </label>
              <textarea
                value={significance}
                onChange={(e) => setSignificance(e.target.value)}
                placeholder="Why this place matters to the story…"
                rows={2}
                className="w-full font-body text-sm text-ns-ink bg-ns-bg border border-ns-border rounded-ns px-3 py-2 resize-none focus:outline-none focus:border-ns-accent transition-colors placeholder:text-ns-ink-muted"
              />
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <label className="font-ui text-[10px] font-semibold text-ns-ink-muted uppercase tracking-widest">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything else worth remembering…"
                rows={2}
                className="w-full font-body text-sm text-ns-ink bg-ns-bg border border-ns-border rounded-ns px-3 py-2 resize-none focus:outline-none focus:border-ns-accent transition-colors placeholder:text-ns-ink-muted"
              />
            </div>

            {submitError && (
              <p className="font-ui text-xs text-ns-destructive">
                {submitError}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 px-5 py-4 border-t border-ns-border flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-ns border border-ns-border font-ui text-xs text-ns-ink-secondary hover:bg-ns-elevated transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="px-4 py-2 rounded-ns bg-ns-accent text-white font-ui text-xs font-medium hover:bg-ns-accent-hover active:scale-[0.97] transition-all disabled:opacity-50"
            >
              {submitting ? "Creating…" : "Create Place"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddPlaceModal;
