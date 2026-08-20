import { Character } from "@novelsync/story-data-client";
import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { validateImageFile } from "@/utils/imageUpload";

interface AddCharacterModalProps {
  storyId: string;
  onClose: () => void;
  onAddCharacter: (
    character: Omit<Character, "id">,
    artFile: File | null,
  ) => Promise<void>;
}

const AddCharacterModal = ({
  storyId: _storyId,
  onClose,
  onAddCharacter,
}: AddCharacterModalProps) => {
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [soul, setSoul] = useState("");
  const [personality, setPersonality] = useState("");
  const [voice, setVoice] = useState("");
  const [backstory, setBackstory] = useState("");
  const [affiliations, setAffiliations] = useState("");
  const [notes, setNotes] = useState("");
  const [artFile, setArtFile] = useState<File | null>(null);
  const [artPreview, setArtPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const artInputRef = useRef<HTMLInputElement>(null);

  const handleArtSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    if (artPreview) URL.revokeObjectURL(artPreview);
    setArtFile(file);
    setArtPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onAddCharacter(
        {
          name: name.trim(),
          age: age ? parseInt(age) : undefined,
          soul: soul || undefined,
          personality: personality || undefined,
          voice: voice || undefined,
          backstory: backstory || undefined,
          affiliations: affiliations || undefined,
          notes: notes || undefined,
          userId: "",
        },
        artFile,
      );
    } catch (error) {
      console.error("Error adding character:", error);
      setSubmitError(
        error instanceof Error ? error.message : "Failed to create character.",
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
          <h2 className="font-heading italic text-xl text-ns-ink">
            New Character
          </h2>
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
            {/* Art upload */}
            <div
              onClick={() => artInputRef.current?.click()}
              className="relative w-full h-36 rounded-ns border-2 border-dashed border-ns-border bg-ns-bg hover:border-ns-accent cursor-pointer transition-colors overflow-hidden group"
            >
              {artPreview ? (
                <img
                  src={artPreview}
                  alt="Character art preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-ns-ink-muted group-hover:text-ns-accent transition-colors">
                  <ImagePlus className="w-6 h-6" />
                  <span className="font-ui text-xs">
                    Upload character art (optional)
                  </span>
                </div>
              )}
              {artPreview && (
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="font-ui text-xs text-white">
                    Change image
                  </span>
                </div>
              )}
              <input
                ref={artInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleArtSelect}
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
                data-cy="character-name"
                placeholder="Character name"
                required
                className="w-full font-ui text-sm text-ns-ink bg-ns-bg border border-ns-border rounded-ns px-3 py-2 focus:outline-none focus:border-ns-accent transition-colors placeholder:text-ns-ink-muted"
              />
            </div>

            {/* Age */}
            <div className="space-y-1">
              <label className="font-ui text-[10px] font-semibold text-ns-ink-muted uppercase tracking-widest">
                Age
              </label>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="Optional"
                className="w-full font-ui text-sm text-ns-ink bg-ns-bg border border-ns-border rounded-ns px-3 py-2 focus:outline-none focus:border-ns-accent transition-colors placeholder:text-ns-ink-muted"
              />
            </div>

            {/* Soul */}
            <div className="space-y-1">
              <label className="font-ui text-[10px] font-semibold text-ns-ink-muted uppercase tracking-widest">
                The Soul
              </label>
              <textarea
                value={soul}
                onChange={(e) => setSoul(e.target.value)}
                placeholder="Core essence, deepest fears, desires, wounds…"
                rows={3}
                className="w-full font-body text-sm text-ns-ink bg-ns-bg border border-ns-border rounded-ns px-3 py-2 resize-none focus:outline-none focus:border-ns-accent transition-colors placeholder:text-ns-ink-muted"
              />
            </div>

            {/* Personality */}
            <div className="space-y-1">
              <label className="font-ui text-[10px] font-semibold text-ns-ink-muted uppercase tracking-widest">
                Personality & Behavioral Traits
              </label>
              <textarea
                value={personality}
                onChange={(e) => setPersonality(e.target.value)}
                placeholder="How they act, quirks, habits…"
                rows={3}
                className="w-full font-body text-sm text-ns-ink bg-ns-bg border border-ns-border rounded-ns px-3 py-2 resize-none focus:outline-none focus:border-ns-accent transition-colors placeholder:text-ns-ink-muted"
              />
            </div>

            {/* Voice */}
            <div className="space-y-1">
              <label className="font-ui text-[10px] font-semibold text-ns-ink-muted uppercase tracking-widest">
                Voice & Presence
              </label>
              <textarea
                value={voice}
                onChange={(e) => setVoice(e.target.value)}
                placeholder="Speech patterns, tone, mannerisms…"
                rows={2}
                className="w-full font-body text-sm text-ns-ink bg-ns-bg border border-ns-border rounded-ns px-3 py-2 resize-none focus:outline-none focus:border-ns-accent transition-colors placeholder:text-ns-ink-muted"
              />
            </div>

            {/* Backstory */}
            <div className="space-y-1">
              <label className="font-ui text-[10px] font-semibold text-ns-ink-muted uppercase tracking-widest">
                Backstory
              </label>
              <textarea
                value={backstory}
                onChange={(e) => setBackstory(e.target.value)}
                placeholder="Origin, history, formative events…"
                rows={3}
                className="w-full font-body text-sm text-ns-ink bg-ns-bg border border-ns-border rounded-ns px-3 py-2 resize-none focus:outline-none focus:border-ns-accent transition-colors placeholder:text-ns-ink-muted"
              />
            </div>

            {/* Affiliations */}
            <div className="space-y-1">
              <label className="font-ui text-[10px] font-semibold text-ns-ink-muted uppercase tracking-widest">
                Affiliations
              </label>
              <input
                type="text"
                value={affiliations}
                onChange={(e) => setAffiliations(e.target.value)}
                placeholder="Groups, factions, allegiances…"
                className="w-full font-ui text-sm text-ns-ink bg-ns-bg border border-ns-border rounded-ns px-3 py-2 focus:outline-none focus:border-ns-accent transition-colors placeholder:text-ns-ink-muted"
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
              data-cy="character-save"
              disabled={submitting || !name.trim()}
              className="px-4 py-2 rounded-ns bg-ns-accent text-white font-ui text-xs font-medium hover:bg-ns-accent-hover active:scale-[0.97] transition-all disabled:opacity-50"
            >
              {submitting ? "Creating…" : "Create Character"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddCharacterModal;
