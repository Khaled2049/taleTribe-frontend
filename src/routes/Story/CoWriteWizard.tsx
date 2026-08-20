import React, { useState } from "react";
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
import {
  Sparkles,
  X,
  Plus,
  Loader2,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Users,
  MapPin,
  Swords,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { storyWorkspaceRepo } from "@novelsync/story-data-client";
import { storyWorldbuildingRepo } from "@novelsync/story-data-client";
import { storageService } from "@/services/StorageService";
import {
  StoryBeatType,
  PLOT_TEMPLATES,
} from "@/types/IPlot";
import { enhanceWizardInput, WizardEnhanceType } from "@/cloudFunctions/ai";
import {
  STORY_CATEGORIES as CATEGORIES,
  STORY_TAGS,
  MAX_STORY_TAGS,
  TARGET_AUDIENCES,
  LANGUAGES,
  COPYRIGHT_OPTIONS,
} from "@/constants/storyOptions";
import { TagMultiSelect } from "@/components/common";
import CoverImagePicker from "./components/CoverImagePicker";

// ── Types ────────────────────────────────────────────────────────────────────

interface CoWriteWizardProps {
  userId: string;
  onClose: () => void;
  onSuccess: (storyId: string) => void;
}

type DraftCharacter = {
  name: string;
  backstory: string;
  age: string;
  personality: string;
  voice: string;
  soul: string;
  affiliations: string;
  notes: string;
  expanded: boolean;
};
type DraftPlace = {
  name: string;
  description: string;
  atmosphere: string;
  geography: string;
  history: string;
  significance: string;
  notes: string;
  expanded: boolean;
};
type DraftEvent = { name: string; content: string; storyBeat: StoryBeatType };

// ── Constants ────────────────────────────────────────────────────────────────

const STORY_BEATS: { value: StoryBeatType; label: string }[] = [
  { value: "exposition", label: "Exposition" },
  { value: "inciting_incident", label: "Inciting Incident" },
  { value: "rising_action", label: "Rising Action" },
  { value: "midpoint", label: "Midpoint" },
  { value: "climax", label: "Climax" },
  { value: "falling_action", label: "Falling Action" },
  { value: "resolution", label: "Resolution" },
];

const STEPS = [
  { icon: BookOpen, label: "Concept" },
  { icon: Users, label: "Characters" },
  { icon: MapPin, label: "Places" },
  { icon: Swords, label: "Plot" },
];

const LAST_STEP = STEPS.length - 1;

// Forward-button label per step — names the next optional section so users
// discover what they can add.
const NEXT_LABELS = [
  "Next: Add characters →",
  "Next: Add places →",
  "Next: Plot →",
];

// ── Helpers ──────────────────────────────────────────────────────────────────


// Reusable banner reminding users these steps are optional and feed the AI.
const OptionalNote: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex items-start gap-2.5 rounded-lg border border-ns-border bg-ns-surface px-3.5 py-2.5">
    <Info className="w-4 h-4 text-ns-accent flex-shrink-0 mt-0.5" />
    <p className="font-body text-xs text-ns-ink-secondary leading-relaxed">
      {children}
    </p>
  </div>
);

const OPTIONAL_NOTE_TEXT =
  "Optional — anything you add gives the AI richer context for chat and writing help. You can always add or edit these later from the editor.";

// ── Component ────────────────────────────────────────────────────────────────

const CoWriteWizard: React.FC<CoWriteWizardProps> = ({
  userId,
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [enhancing, setEnhancing] = useState<string | null>(null);

  // Step 0 — Concept
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [targetAudience, setTargetAudience] = useState("");
  const [language, setLanguage] = useState("");
  const [copyright, setCopyright] = useState("");
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Step 1 — Characters
  const [characters, setCharacters] = useState<DraftCharacter[]>([]);

  // Step 2 — Places
  const [places, setPlaces] = useState<DraftPlace[]>([]);

  // Step 3 — Conflict / Plot
  const [plotLineName, setPlotLineName] = useState("Main Plot");
  const [conflict, setConflict] = useState("");
  const [events, setEvents] = useState<DraftEvent[]>([]);

  // ── AI enhancement ────────────────────────────────────────────────────────

  const handleEnhance = async (
    key: string,
    type: WizardEnhanceType,
    data: Record<string, unknown>,
    onResult: (result: string) => void,
  ) => {
    setEnhancing(key);
    try {
      const res = await enhanceWizardInput({ type, data });
      if (res.success && res.data?.enhanced) {
        onResult(res.data.enhanced);
        toast.success("Enhanced!");
      } else {
        toast.error(res.error ?? "Enhancement failed. Please try again.");
      }
    } catch {
      toast.error("Could not reach AI. Check your connection.");
    } finally {
      setEnhancing(null);
    }
  };

  // ── Navigation ────────────────────────────────────────────────────────────

  const canAdvance = step === 0 ? title.trim().length > 0 : true;
  const canLaunch = title.trim().length > 0;

  const goNext = () => setStep((s) => Math.min(s + 1, LAST_STEP));
  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  // ── Character helpers ─────────────────────────────────────────────────────

  const addCharacter = () =>
    setCharacters((prev) => [
      ...prev,
      {
        name: "",
        backstory: "",
        age: "",
        personality: "",
        voice: "",
        soul: "",
        affiliations: "",
        notes: "",
        expanded: true,
      },
    ]);

  const removeCharacter = (i: number) =>
    setCharacters((prev) => prev.filter((_, idx) => idx !== i));

  const updateCharacter = (
    i: number,
    field: keyof DraftCharacter,
    value: string | boolean,
  ) =>
    setCharacters((prev) =>
      prev.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)),
    );

  // ── Place helpers ─────────────────────────────────────────────────────────

  const addPlace = () =>
    setPlaces((prev) => [
      ...prev,
      {
        name: "",
        description: "",
        atmosphere: "",
        geography: "",
        history: "",
        significance: "",
        notes: "",
        expanded: true,
      },
    ]);

  const removePlace = (i: number) =>
    setPlaces((prev) => prev.filter((_, idx) => idx !== i));

  const updatePlace = (
    i: number,
    field: keyof DraftPlace,
    value: string | boolean,
  ) =>
    setPlaces((prev) =>
      prev.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)),
    );

  // ── Event helpers ─────────────────────────────────────────────────────────

  const addEvent = () =>
    setEvents((prev) => [
      ...prev,
      { name: "", content: "", storyBeat: "rising_action" as StoryBeatType },
    ]);

  const removeEvent = (i: number) =>
    setEvents((prev) => prev.filter((_, idx) => idx !== i));

  const updateEvent = (i: number, field: keyof DraftEvent, value: string) =>
    setEvents((prev) =>
      prev.map((e, idx) => (idx === i ? { ...e, [field]: value } : e)),
    );

  // Apply a plot template — sets the plot line name and seeds its events.
  const applyTemplate = (templateId: string) => {
    const template = PLOT_TEMPLATES.find((t) => String(t.id) === templateId);
    if (!template) return;
    setPlotLineName(template.name);
    setEvents(
      template.events.map((e) => ({
        name: e.name,
        content: e.content,
        storyBeat: "rising_action" as StoryBeatType,
      })),
    );
  };

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleLaunch = async () => {
    setIsSubmitting(true);
    try {
      const finalDescription = description;

      // 0. Upload cover image if one was chosen
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

      // 1. Create story
      const story = await storyWorkspaceRepo.createStory({
        title,
        description: finalDescription,
        authorName: "",
        category,
        tags,
        targetAudience,
        language,
        copyright,
        coverImageUrl,
        thumbnailUrl,
        published: false,
      });
      const storyId = story.id;
      await Promise.all(
        characters.filter((character) => character.name.trim()).map(({ expanded: _expanded, age, ...character }) =>
          storyWorldbuildingRepo.addCharacter(storyId, {
            ...character,
            age: age ? Number(age) : undefined,
            relationships: [],
            userId,
          }),
        ),
      );
      await Promise.all(
        places.filter((place) => place.name.trim()).map(({ expanded: _expanded, ...place }) =>
          storyWorldbuildingRepo.addPlace(storyId, { ...place, userId, storyId }),
        ),
      );
      if (plotLineName.trim() && (conflict.trim() || events.length > 0)) {
        const line = await storyWorldbuildingRepo.addPlot(storyId, plotLineName.trim());
        if (conflict.trim()) {
          await storyWorldbuildingRepo.updatePlotMeta(storyId, { ...line, description: conflict });
        }
        for (let index = 0; index < events.length; index += 1) {
          const event = events[index];
          if (!event.name.trim()) continue;
          await storyWorldbuildingRepo.addEvent(storyId, line.id, {
            name: event.name,
            content: event.content,
            characterIds: [],
            locationId: null,
            dependencies: [],
            dependents: [],
            tensionLevel: 5,
            pacing: "moderate",
            storyBeat: event.storyBeat,
            orderIndex: index,
          });
        }
      }

      toast.success("Your story is ready — time to write!");
      onSuccess(storyId);
    } catch (err) {
      console.error("Error creating story:", err);
      toast.error("Failed to create story. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── EnhanceBtn — call-aware inline component ──────────────────────────────

  const EnhanceBtn = ({
    enhanceKey,
    label = "Enhance with AI",
    type,
    data,
    onResult,
    disabled: extraDisabled = false,
  }: {
    enhanceKey: string;
    label?: string;
    type: WizardEnhanceType;
    data: Record<string, unknown>;
    onResult: (result: string) => void;
    disabled?: boolean;
  }) => {
    const isActive = enhancing === enhanceKey;
    const isDisabled = extraDisabled || (enhancing !== null && !isActive);

    return (
      <button
        type="button"
        onClick={() => handleEnhance(enhanceKey, type, data, onResult)}
        disabled={isActive || isDisabled}
        className="inline-flex items-center gap-1.5 text-xs font-ui transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300"
      >
        {isActive ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Sparkles className="w-3.5 h-3.5" />
        )}
        {isActive ? "Enhancing…" : label}
      </button>
    );
  };

  // ── Step renderers ────────────────────────────────────────────────────────

  const renderStep0 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-2xl text-ns-ink mb-1">
          What is your story about?
        </h2>
        <p className="font-body text-ns-ink-secondary text-sm">
          Start with the core idea — you can always refine it later.
        </p>
      </div>

      <div className="space-y-2">
        <Label className="font-ui text-xs font-semibold text-ns-ink-secondary uppercase tracking-wide">
          Title <span className="text-red-500">*</span>
        </Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          data-cy="wizard-title"
          placeholder="Give your story a working title…"
          className="h-12 text-base bg-ns-surface border-ns-border text-ns-ink focus:ring-ns-accent"
          autoFocus
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="font-ui text-xs font-semibold text-ns-ink-secondary uppercase tracking-wide">
            Premise
          </Label>
          <EnhanceBtn
            enhanceKey="premise"
            type="premise"
            data={{ title, premise: description, genre: category }}
            onResult={setDescription}
            disabled={!title.trim()}
          />
        </div>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the core idea, tone, and what makes your story unique…"
          rows={5}
          className="bg-ns-surface border-ns-border text-ns-ink resize-none focus:ring-ns-accent"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="font-ui text-xs font-semibold text-ns-ink-secondary uppercase tracking-wide">
            Genre
          </Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-11 bg-ns-surface border-ns-border text-ns-ink">
              <SelectValue placeholder="Select genre" />
            </SelectTrigger>
            <SelectContent className="bg-ns-surface border-ns-border">
              {CATEGORIES.map(({ value, label }) => (
                <SelectItem
                  key={value}
                  value={value}
                  className="text-ns-ink focus:bg-ns-surface-hover"
                >
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="font-ui text-xs font-semibold text-ns-ink-secondary uppercase tracking-wide">
            Tags
          </Label>
          <TagMultiSelect
            options={STORY_TAGS}
            value={tags}
            onChange={setTags}
            max={MAX_STORY_TAGS}
            placeholder="Select tags…"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label className="font-ui text-xs font-semibold text-ns-ink-secondary uppercase tracking-wide">
            Audience
          </Label>
          <Select value={targetAudience} onValueChange={setTargetAudience}>
            <SelectTrigger className="h-11 bg-ns-surface border-ns-border text-ns-ink">
              <SelectValue placeholder="Audience" />
            </SelectTrigger>
            <SelectContent className="bg-ns-surface border-ns-border">
              {TARGET_AUDIENCES.map(({ value, label }) => (
                <SelectItem
                  key={value}
                  value={value}
                  className="text-ns-ink focus:bg-ns-surface-hover"
                >
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="font-ui text-xs font-semibold text-ns-ink-secondary uppercase tracking-wide">
            Language
          </Label>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="h-11 bg-ns-surface border-ns-border text-ns-ink">
              <SelectValue placeholder="Language" />
            </SelectTrigger>
            <SelectContent className="bg-ns-surface border-ns-border">
              {LANGUAGES.map(({ value, label }) => (
                <SelectItem
                  key={value}
                  value={value}
                  className="text-ns-ink focus:bg-ns-surface-hover"
                >
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="font-ui text-xs font-semibold text-ns-ink-secondary uppercase tracking-wide">
            Copyright
          </Label>
          <Select value={copyright} onValueChange={setCopyright}>
            <SelectTrigger className="h-11 bg-ns-surface border-ns-border text-ns-ink">
              <SelectValue placeholder="Copyright" />
            </SelectTrigger>
            <SelectContent className="bg-ns-surface border-ns-border">
              {COPYRIGHT_OPTIONS.map(({ value, label }) => (
                <SelectItem
                  key={value}
                  value={value}
                  className="text-ns-ink focus:bg-ns-surface-hover"
                >
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2 pt-2 border-t border-ns-border">
        <Label className="font-ui text-xs font-semibold text-ns-ink-secondary uppercase tracking-wide">
          Cover image
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
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-2xl text-ns-ink mb-1">
          Who are the main characters?
        </h2>
        <p className="font-body text-ns-ink-secondary text-sm">
          Add your key characters — a name is enough to start; expand a card to
          flesh them out.
        </p>
      </div>

      <OptionalNote>{OPTIONAL_NOTE_TEXT}</OptionalNote>

      <div className="space-y-3">
        {characters.map((char, i) => (
          <div
            key={i}
            className="border border-ns-border rounded-lg bg-ns-surface overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 py-3">
              <Input
                value={char.name}
                onChange={(e) => updateCharacter(i, "name", e.target.value)}
                placeholder="Character name…"
                className="flex-1 h-9 bg-ns-elevated border-ns-border text-ns-ink text-sm focus:ring-ns-accent"
              />
              <button
                type="button"
                onClick={() => updateCharacter(i, "expanded", !char.expanded)}
                className="text-ns-ink-muted hover:text-ns-ink transition-colors p-1"
                aria-label={char.expanded ? "Collapse" : "Expand"}
              >
                {char.expanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
              <button
                type="button"
                onClick={() => removeCharacter(i)}
                className="text-ns-ink-muted hover:text-ns-destructive transition-colors p-1"
                aria-label="Remove character"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {char.expanded && (
              <div className="px-4 pb-4 space-y-3 border-t border-ns-border pt-3">
                <div className="flex items-center justify-between">
                  <Label className="font-ui text-xs text-ns-ink-secondary">
                    Backstory
                  </Label>
                  <EnhanceBtn
                    enhanceKey={`character-${i}`}
                    label="Suggest traits"
                    type="character"
                    data={{
                      characterName: char.name,
                      characterDescription: char.backstory,
                    }}
                    onResult={(v) => updateCharacter(i, "backstory", v)}
                    disabled={!char.name.trim()}
                  />
                </div>
                <Textarea
                  value={char.backstory}
                  onChange={(e) =>
                    updateCharacter(i, "backstory", e.target.value)
                  }
                  placeholder="Origin, history, formative events…"
                  rows={3}
                  className="bg-ns-elevated border-ns-border text-ns-ink text-sm resize-none focus:ring-ns-accent"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="font-ui text-xs text-ns-ink-secondary">
                      Age
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      value={char.age}
                      onChange={(e) =>
                        updateCharacter(i, "age", e.target.value)
                      }
                      placeholder="Age"
                      className="h-9 bg-ns-elevated border-ns-border text-ns-ink text-sm focus:ring-ns-accent"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-ui text-xs text-ns-ink-secondary">
                      Affiliations
                    </Label>
                    <Input
                      value={char.affiliations}
                      onChange={(e) =>
                        updateCharacter(i, "affiliations", e.target.value)
                      }
                      placeholder="Groups, factions, allegiances…"
                      className="h-9 bg-ns-elevated border-ns-border text-ns-ink text-sm focus:ring-ns-accent"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="font-ui text-xs text-ns-ink-secondary">
                    Personality
                  </Label>
                  <Textarea
                    value={char.personality}
                    onChange={(e) =>
                      updateCharacter(i, "personality", e.target.value)
                    }
                    placeholder="How they act, quirks, habits…"
                    rows={2}
                    className="bg-ns-elevated border-ns-border text-ns-ink text-sm resize-none focus:ring-ns-accent"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="font-ui text-xs text-ns-ink-secondary">
                    Voice
                  </Label>
                  <Textarea
                    value={char.voice}
                    onChange={(e) =>
                      updateCharacter(i, "voice", e.target.value)
                    }
                    placeholder="Speech patterns, tone, mannerisms…"
                    rows={2}
                    className="bg-ns-elevated border-ns-border text-ns-ink text-sm resize-none focus:ring-ns-accent"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="font-ui text-xs text-ns-ink-secondary">
                    Soul
                  </Label>
                  <Textarea
                    value={char.soul}
                    onChange={(e) => updateCharacter(i, "soul", e.target.value)}
                    placeholder="Core essence, deepest fears, desires, wounds…"
                    rows={2}
                    className="bg-ns-elevated border-ns-border text-ns-ink text-sm resize-none focus:ring-ns-accent"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="font-ui text-xs text-ns-ink-secondary">
                    Notes
                  </Label>
                  <Textarea
                    value={char.notes}
                    onChange={(e) =>
                      updateCharacter(i, "notes", e.target.value)
                    }
                    placeholder="Anything else worth remembering…"
                    rows={2}
                    className="bg-ns-elevated border-ns-border text-ns-ink text-sm resize-none focus:ring-ns-accent"
                  />
                </div>
              </div>
            )}
          </div>
        ))}

        <button
          type="button"
          onClick={addCharacter}
          className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-ns-border rounded-lg text-sm font-ui text-ns-ink-secondary hover:border-ns-accent hover:text-ns-accent transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Character
        </button>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-2xl text-ns-ink mb-1">
          Where does it take place?
        </h2>
        <p className="font-body text-ns-ink-secondary text-sm">
          Describe the world or settings your story inhabits.
        </p>
      </div>

      <OptionalNote>{OPTIONAL_NOTE_TEXT}</OptionalNote>

      <div className="space-y-3">
        {places.map((place, i) => (
          <div
            key={i}
            className="border border-ns-border rounded-lg bg-ns-surface overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 py-3">
              <Input
                value={place.name}
                onChange={(e) => updatePlace(i, "name", e.target.value)}
                placeholder="Place name…"
                className="flex-1 h-9 bg-ns-elevated border-ns-border text-ns-ink text-sm focus:ring-ns-accent"
              />
              <button
                type="button"
                onClick={() => updatePlace(i, "expanded", !place.expanded)}
                className="text-ns-ink-muted hover:text-ns-ink transition-colors p-1"
                aria-label={place.expanded ? "Collapse" : "Expand"}
              >
                {place.expanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
              <button
                type="button"
                onClick={() => removePlace(i)}
                className="text-ns-ink-muted hover:text-ns-destructive transition-colors p-1"
                aria-label="Remove place"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {place.expanded && (
              <div className="px-4 pb-4 space-y-3 border-t border-ns-border pt-3">
                <div className="flex items-center justify-between">
                  <Label className="font-ui text-xs text-ns-ink-secondary">
                    Description
                  </Label>
                  <EnhanceBtn
                    enhanceKey={`place-${i}`}
                    label="Enrich world"
                    type="place"
                    data={{
                      placeName: place.name,
                      placeDescription: place.description,
                    }}
                    onResult={(v) => updatePlace(i, "description", v)}
                    disabled={!place.name.trim()}
                  />
                </div>
                <Textarea
                  value={place.description}
                  onChange={(e) =>
                    updatePlace(i, "description", e.target.value)
                  }
                  placeholder="What is this place? A brief overview…"
                  rows={3}
                  className="bg-ns-elevated border-ns-border text-ns-ink text-sm resize-none focus:ring-ns-accent"
                />

                <div className="space-y-1.5">
                  <Label className="font-ui text-xs text-ns-ink-secondary">
                    Atmosphere
                  </Label>
                  <Textarea
                    value={place.atmosphere}
                    onChange={(e) =>
                      updatePlace(i, "atmosphere", e.target.value)
                    }
                    placeholder="Mood, sensory details, sounds, smells, light…"
                    rows={2}
                    className="bg-ns-elevated border-ns-border text-ns-ink text-sm resize-none focus:ring-ns-accent"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="font-ui text-xs text-ns-ink-secondary">
                    Geography
                  </Label>
                  <Textarea
                    value={place.geography}
                    onChange={(e) =>
                      updatePlace(i, "geography", e.target.value)
                    }
                    placeholder="Physical layout, terrain, surroundings…"
                    rows={2}
                    className="bg-ns-elevated border-ns-border text-ns-ink text-sm resize-none focus:ring-ns-accent"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="font-ui text-xs text-ns-ink-secondary">
                    History
                  </Label>
                  <Textarea
                    value={place.history}
                    onChange={(e) => updatePlace(i, "history", e.target.value)}
                    placeholder="Origins, past events, how it came to be…"
                    rows={2}
                    className="bg-ns-elevated border-ns-border text-ns-ink text-sm resize-none focus:ring-ns-accent"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="font-ui text-xs text-ns-ink-secondary">
                    Significance
                  </Label>
                  <Textarea
                    value={place.significance}
                    onChange={(e) =>
                      updatePlace(i, "significance", e.target.value)
                    }
                    placeholder="Why this place matters to the story…"
                    rows={2}
                    className="bg-ns-elevated border-ns-border text-ns-ink text-sm resize-none focus:ring-ns-accent"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="font-ui text-xs text-ns-ink-secondary">
                    Notes
                  </Label>
                  <Textarea
                    value={place.notes}
                    onChange={(e) => updatePlace(i, "notes", e.target.value)}
                    placeholder="Anything else worth remembering…"
                    rows={2}
                    className="bg-ns-elevated border-ns-border text-ns-ink text-sm resize-none focus:ring-ns-accent"
                  />
                </div>
              </div>
            )}
          </div>
        ))}

        <button
          type="button"
          onClick={addPlace}
          className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-ns-border rounded-lg text-sm font-ui text-ns-ink-secondary hover:border-ns-accent hover:text-ns-accent transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Place
        </button>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-2xl text-ns-ink mb-1">
          Shape your plot
        </h2>
        <p className="font-body text-ns-ink-secondary text-sm">
          Start from a proven structure, then capture your central conflict and
          key beats.
        </p>
      </div>

      <OptionalNote>{OPTIONAL_NOTE_TEXT}</OptionalNote>

      {/* Template picker — seeds the plot line name + a starter set of beats */}
      <div className="space-y-2">
        <Label className="font-ui text-xs font-semibold text-ns-ink-secondary uppercase tracking-wide">
          Start from a template{" "}
          <span className="text-ns-ink-muted font-normal normal-case">
            (optional)
          </span>
        </Label>
        <Select onValueChange={applyTemplate}>
          <SelectTrigger className="h-11 bg-ns-surface border-ns-border text-ns-ink">
            <SelectValue placeholder="Choose a story structure…" />
          </SelectTrigger>
          <SelectContent className="bg-ns-surface border-ns-border">
            {PLOT_TEMPLATES.map((t) => (
              <SelectItem
                key={t.id}
                value={String(t.id)}
                className="text-ns-ink focus:bg-ns-surface-hover"
              >
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="font-body text-xs text-ns-ink-muted">
          Picking a template names your plot line and fills in its beats below —
          edit them freely.
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="font-ui text-xs font-semibold text-ns-ink-secondary uppercase tracking-wide">
            Central conflict
          </Label>
          <EnhanceBtn
            enhanceKey="conflict"
            label="Sharpen conflict"
            type="conflict"
            data={{ conflict, plotLineName }}
            onResult={setConflict}
          />
        </div>
        <Textarea
          value={conflict}
          onChange={(e) => setConflict(e.target.value)}
          placeholder="Describe the main tension, stakes, and what your protagonist must overcome…"
          rows={4}
          className="bg-ns-surface border-ns-border text-ns-ink resize-none focus:ring-ns-accent"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="font-ui text-xs font-semibold text-ns-ink-secondary uppercase tracking-wide">
            Key plot events{" "}
            <span className="text-ns-ink-muted font-normal normal-case">
              (optional)
            </span>
          </Label>
        </div>

        <div className="space-y-3">
          {events.map((ev, i) => (
            <div
              key={i}
              className="flex gap-3 items-start border border-ns-border rounded-lg p-3 bg-ns-surface"
            >
              <div className="flex-1 space-y-2">
                <Input
                  value={ev.name}
                  onChange={(e) => updateEvent(i, "name", e.target.value)}
                  placeholder="Event name…"
                  className="h-9 bg-ns-elevated border-ns-border text-ns-ink text-sm focus:ring-ns-accent"
                />
                <Textarea
                  value={ev.content}
                  onChange={(e) => updateEvent(i, "content", e.target.value)}
                  placeholder="What happens in this beat…"
                  rows={2}
                  className="bg-ns-elevated border-ns-border text-ns-ink text-sm resize-none focus:ring-ns-accent"
                />
                <Select
                  value={ev.storyBeat}
                  onValueChange={(v) => updateEvent(i, "storyBeat", v)}
                >
                  <SelectTrigger className="h-8 text-xs bg-ns-elevated border-ns-border text-ns-ink">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-ns-surface border-ns-border">
                    {STORY_BEATS.map(({ value, label }) => (
                      <SelectItem
                        key={value}
                        value={value}
                        className="text-xs text-ns-ink focus:bg-ns-surface-hover"
                      >
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <button
                type="button"
                onClick={() => removeEvent(i)}
                className="text-ns-ink-muted hover:text-ns-destructive transition-colors p-1 mt-0.5"
                aria-label="Remove event"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={addEvent}
            className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-ns-border rounded-lg text-sm font-ui text-ns-ink-secondary hover:border-ns-accent hover:text-ns-accent transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Plot Event
          </button>
        </div>

        <div className="space-y-2">
          <Label className="font-ui text-xs font-semibold text-ns-ink-secondary uppercase tracking-wide">
            Plot line name
          </Label>
          <Input
            value={plotLineName}
            onChange={(e) => setPlotLineName(e.target.value)}
            className="h-9 bg-ns-surface border-ns-border text-ns-ink text-sm focus:ring-ns-accent"
          />
        </div>
      </div>
    </div>
  );

  const steps = [renderStep0, renderStep1, renderStep2, renderStep3];

  const progressPct = ((step + 1) / STEPS.length) * 100;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Step indicator */}
      <div className="px-6 pt-2 pb-4">
        <div className="flex items-center justify-between mb-2">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isCompleted = i < step;
            const isActive = i === step;
            return (
              <React.Fragment key={i}>
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                      isCompleted
                        ? "bg-ns-accent text-white"
                        : isActive
                          ? "bg-ns-accent text-white ring-2 ring-ns-accent ring-offset-2 ring-offset-ns-bg"
                          : "bg-ns-surface border border-ns-border text-ns-ink-muted"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <span
                    className={`text-xs font-ui hidden sm:block ${
                      isActive ? "text-ns-ink font-medium" : "text-ns-ink-muted"
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-px mx-1 mb-4 transition-colors ${
                      i < step ? "bg-ns-accent" : "bg-ns-border"
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
        <div className="h-0.5 rounded-full bg-ns-border overflow-hidden">
          <div
            className="h-full bg-ns-accent transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto px-6 py-2">{steps[step]()}</div>

      {/* Footer navigation */}
      <div className="px-6 py-4 border-t border-ns-border flex items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="font-ui text-ns-ink-secondary"
          >
            Cancel
          </Button>
        </div>

        <div className="flex gap-3">
          {step > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={goBack}
              disabled={isSubmitting}
              className="font-ui border-ns-border text-ns-ink"
            >
              ← Back
            </Button>
          )}

          {/* Always-available create — lets users finish from any step */}
          <Button
            type="button"
            variant={step === LAST_STEP ? "default" : "outline"}
            onClick={handleLaunch}
            data-cy="wizard-create"
            disabled={!canLaunch || isSubmitting}
            className={
              step === LAST_STEP
                ? "font-ui bg-ns-accent hover:bg-ns-accent-hover text-white disabled:opacity-50 px-6"
                : "font-ui border-ns-border text-ns-ink disabled:opacity-50"
            }
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating…
              </>
            ) : step === 0 || step === LAST_STEP ? (
              "Create Story"
            ) : (
              "Create story now"
            )}
          </Button>

          {step < LAST_STEP && (
            <Button
              type="button"
              onClick={goNext}
              disabled={!canAdvance}
              className="font-ui bg-ns-accent hover:bg-ns-accent-hover text-white disabled:opacity-50"
            >
              {NEXT_LABELS[step]}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CoWriteWizard;
