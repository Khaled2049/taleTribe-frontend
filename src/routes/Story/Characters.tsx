import React, { useEffect, useRef, useState } from "react";
import { Character, CharacterRelationship } from "@novelsync/story-data-client";
import AddCharacterModal from "@/components/story/characters/AddCharacterModal";
import { storageService } from "@/services/StorageService";
import { useParams } from "react-router-dom";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { SlideOverPanel } from "@/components/common";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { toast } from "sonner";
import { validateImageFile } from "@/utils/imageUpload";
import {
  useAddCharacter,
  useCharacters,
  useDeleteCharacter,
  useUpdateCharacter,
} from "@/hooks/queries/useCharacterQueries";
import {
  Users,
  UserPlus,
  ImagePlus,
  Pencil,
  Trash2,
  X,
  Plus,
  Check,
  List,
} from "lucide-react";

const RELATIONSHIP_TYPES: CharacterRelationship["type"][] = [
  "ally",
  "rival",
  "mentor",
  "love interest",
  "family",
  "neutral",
];

const RELATIONSHIP_COLORS: Record<CharacterRelationship["type"], string> = {
  ally: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  rival: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  mentor: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  "love interest":
    "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  family:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  neutral: "bg-ns-surface text-ns-ink-muted border border-ns-border",
};

// Editable field component
const Field: React.FC<{
  label: string;
  value?: string;
  editing: boolean;
  placeholder: string;
  onChange: (v: string) => void;
  rows?: number;
}> = ({ label, value, editing, placeholder, onChange, rows = 3 }) => {
  if (!editing && !value) return null;
  return (
    <div className="space-y-1.5">
      <p className="font-ui text-[10px] font-semibold text-ns-ink-muted uppercase tracking-widest">
        {label}
      </p>
      {editing ? (
        <textarea
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className="w-full font-body text-sm text-ns-ink bg-ns-surface border border-ns-border rounded-ns px-3 py-2 resize-none focus:outline-none focus:border-ns-accent transition-colors placeholder:text-ns-ink-muted"
        />
      ) : (
        <p className="font-body text-sm text-ns-ink leading-relaxed whitespace-pre-wrap">
          {value}
        </p>
      )}
    </div>
  );
};

const Characters: React.FC = () => {
  const { storyId } = useParams<{ storyId: string }>();
  const { isDemo, requireAuth } = useDemoMode();
  const { isLgUp } = useBreakpoint();

  const {
    data: characters = [],
    isPending: charactersLoading,
    isError: charactersError,
    error: charactersErrorValue,
  } = useCharacters(storyId);
  const addCharacter = useAddCharacter(storyId);
  const deleteCharacter = useDeleteCharacter(storyId);
  const updateCharacter = useUpdateCharacter(storyId);

  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(
    null,
  );
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Character | null>(null);
  const [artPreview, setArtPreview] = useState<string | null>(null);
  const [artFile, setArtFile] = useState<File | null>(null);
  const saving = updateCharacter.isPending;
  const artInputRef = useRef<HTMLInputElement>(null);

  // Relationship builder state
  const [newRelationship, setNewRelationship] = useState<{
    characterId: string;
    type: CharacterRelationship["type"];
    description: string;
  }>({ characterId: "", type: "ally", description: "" });
  const [isRosterOpen, setIsRosterOpen] = useState(false);

  const handleCharacterClick = (character: Character) => {
    setSelectedCharacter(character);
    if (!isLgUp) {
      setIsRosterOpen(false);
    }
    setEditing(false);
    setDraft(null);
    setArtPreview(null);
    setArtFile(null);
  };

  useEffect(() => {
    if (isLgUp) {
      setIsRosterOpen(false);
    }
  }, [isLgUp]);

  const handleAddCharacter = async (
    characterData: Omit<Character, "id">,
    artFile: File | null,
  ) => {
    let newCharacter = await addCharacter.mutateAsync(characterData);
    if (artFile) {
      const artUrl = await storageService.uploadCharacterArt(
        artFile,
        newCharacter.userId,
        newCharacter.id,
      );
      const withArt = { ...newCharacter, artUrl };
      await updateCharacter.mutateAsync(withArt);
      newCharacter = withArt;
    }
    setIsAddModalOpen(false);
    setSelectedCharacter(newCharacter);
  };

  const handleDeleteCharacter = (characterId: string) => {
    deleteCharacter.mutate(characterId, {
      onSuccess: () => {
        if (selectedCharacter?.id === characterId) setSelectedCharacter(null);
      },
    });
  };

  const startEditing = () => {
    if (!selectedCharacter) return;
    setDraft({ ...selectedCharacter });
    setArtPreview(null);
    setArtFile(null);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setDraft(null);
    setArtPreview(null);
    setArtFile(null);
  };

  const handleArtSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;

    // `accept="image/*"` is a filter in the picker, not a guarantee: a file can
    // still arrive by drag-and-drop or by choosing "all files". Validate the
    // same way the upload path does, so the preview can never show something
    // Storage will reject afterwards.
    const validationError = validateImageFile(file);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    // Object URLs live until revoked or the document unloads.
    if (artPreview) URL.revokeObjectURL(artPreview);
    setArtFile(file);
    setArtPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!draft || !storyId) return;
    try {
      let updatedDraft = { ...draft };

      if (artFile) {
        const url = await storageService.uploadCharacterArt(
          artFile,
          draft.userId,
          draft.id,
        );
        updatedDraft = { ...updatedDraft, artUrl: url };
      }

      await updateCharacter.mutateAsync(updatedDraft);
      setSelectedCharacter(updatedDraft);
      setEditing(false);
      setDraft(null);
      setArtPreview(null);
      setArtFile(null);
    } catch (error) {
      console.error("Error saving character:", error);
    }
  };

  const handleAddRelationship = () => {
    if (!draft || !newRelationship.characterId) return;
    const target = characters.find((c) => c.id === newRelationship.characterId);
    if (!target) return;

    const rel: CharacterRelationship = {
      characterId: target.id,
      name: target.name,
      type: newRelationship.type,
      description: newRelationship.description || undefined,
    };

    setDraft((prev) =>
      prev
        ? {
            ...prev,
            relationships: [...(prev.relationships ?? []), rel],
          }
        : prev,
    );
    setNewRelationship({ characterId: "", type: "ally", description: "" });
  };

  const handleRemoveRelationship = (characterId: string) => {
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            relationships: (prev.relationships ?? []).filter(
              (r) => r.characterId !== characterId,
            ),
          }
        : prev,
    );
  };

  const character = editing ? draft : selectedCharacter;
  const artSrc = artPreview ?? character?.artUrl ?? null;

  // Characters available to link (exclude self and already-linked)
  const linkableCharacters = characters.filter(
    (c) =>
      c.id !== draft?.id &&
      !(draft?.relationships ?? []).some((r) => r.characterId === c.id),
  );

  if (!storyId && !isDemo) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="font-ui text-sm text-ns-ink-muted">
          Story ID not found. Please check the URL and try again.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-ns-bg">
      {/* ── Toolbar ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-ns-border bg-ns-surface">
        <div className="flex items-center gap-2.5">
          <span className="font-heading italic text-lg text-ns-ink">
            Characters
          </span>
          {characters.length > 0 && (
            <span className="font-ui text-[10px] font-semibold text-ns-accent bg-ns-accent-subtle px-2 py-0.5 rounded-full">
              {characters.length}
            </span>
          )}
        </div>
        <button
          onClick={() => { if (requireAuth()) setIsAddModalOpen(true); }}
          data-cy="add-character"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-ns-accent text-white font-ui text-xs font-medium rounded-ns hover:bg-ns-accent-hover active:scale-[0.97] transition-all duration-150"
        >
          <UserPlus className="w-3.5 h-3.5" />
          Add Character
        </button>
        <button
          onClick={() => setIsRosterOpen(true)}
          className="lg:hidden inline-flex items-center gap-1.5 px-3 py-1.5 border border-ns-border font-ui text-xs text-ns-ink-secondary rounded-ns hover:bg-ns-surface-hover hover:text-ns-ink transition-all duration-150"
        >
          <List className="w-3.5 h-3.5" />
          Roster
        </button>
      </div>
      {charactersError && (
        <div className="mx-4 mt-3 rounded-ns border border-ns-destructive/20 bg-ns-accent-subtle px-3 py-2 font-ui text-xs text-ns-destructive">
          {charactersErrorValue instanceof Error
            ? charactersErrorValue.message
            : "Failed to load characters."}
        </div>
      )}

      {/* ── Two-Panel Content ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Roster */}
        <div className="hidden lg:flex w-64 flex-shrink-0 border-r border-ns-border flex-col bg-ns-surface">
          <div className="flex-1 overflow-y-auto py-3 px-3">
            {charactersLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="h-12 rounded-ns bg-ns-surface-hover animate-pulse"
                  />
                ))}
              </div>
            ) : characters.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 py-12">
                <div className="w-12 h-12 rounded-full bg-ns-accent-subtle flex items-center justify-center">
                  <Users className="w-5 h-5 text-ns-accent opacity-60" />
                </div>
                <p className="font-ui text-xs text-ns-ink-muted text-center leading-relaxed">
                  No characters yet.
                  <br />
                  Add your first character.
                </p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {characters.map((c) => {
                  const isSelected = selectedCharacter?.id === c.id;
                  return (
                    <div
                      key={c.id}
                      onClick={() => handleCharacterClick(c)}
                      className={`flex items-center gap-3 rounded-ns px-3 py-2.5 cursor-pointer transition-all duration-150 group ${
                        isSelected
                          ? "bg-ns-accent-subtle"
                          : "hover:bg-ns-surface-hover"
                      }`}
                    >
                      {/* Avatar or art thumbnail */}
                      <div className="w-8 h-8 rounded-full flex-shrink-0 overflow-hidden">
                        {c.artUrl ? (
                          <img
                            src={c.artUrl}
                            alt={c.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div
                            className={`w-full h-full flex items-center justify-center font-ui font-semibold text-sm transition-colors ${
                              isSelected
                                ? "bg-ns-accent text-white"
                                : "bg-ns-border text-ns-ink-secondary"
                            }`}
                          >
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p
                          className={`font-ui text-xs font-medium truncate transition-colors ${
                            isSelected ? "text-ns-ink" : "text-ns-ink-secondary"
                          }`}
                        >
                          {c.name}
                        </p>
                        {c.age && c.age > 0 && (
                          <p className="font-ui text-[10px] text-ns-ink-muted">
                            Age {c.age}
                          </p>
                        )}
                      </div>

                      {/* Hover actions */}
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!requireAuth()) return;
                            handleCharacterClick(c);
                            setTimeout(() => {
                              setDraft({ ...c });
                              setEditing(true);
                            }, 0);
                          }}
                          className="p-1.5 rounded text-ns-ink-muted hover:text-ns-ink hover:bg-ns-elevated transition-all duration-150"
                          aria-label="Edit character"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (requireAuth()) handleDeleteCharacter(c.id);
                          }}
                          className="p-1.5 rounded text-ns-ink-muted hover:text-ns-destructive hover:bg-ns-elevated transition-all duration-150"
                          aria-label="Delete character"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Detail / Edit Panel */}
        <div className="flex-1 overflow-y-auto bg-ns-bg">
          {!selectedCharacter ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 px-8 animate-ns-fade-in">
              <div className="w-14 h-14 rounded-full bg-ns-accent-subtle flex items-center justify-center">
                <Users className="w-6 h-6 text-ns-accent opacity-60" />
              </div>
              <div className="text-center space-y-1">
                <p className="font-heading italic text-xl text-ns-ink-secondary">
                  Select a character
                </p>
                <p className="font-ui text-xs text-ns-ink-muted">
                  Choose someone from the roster to view their profile
                </p>
              </div>
            </div>
          ) : (
            <div className="animate-ns-fade-in">
              {/* Art Hero */}
              <div
                className={`relative w-full bg-ns-surface border-b border-ns-border overflow-hidden ${
                  editing ? "cursor-pointer group" : ""
                }`}
                style={{ minHeight: "200px", maxHeight: "320px" }}
                onClick={
                  editing ? () => artInputRef.current?.click() : undefined
                }
              >
                {artSrc ? (
                  <img
                    src={artSrc}
                    alt={character?.name}
                    className="w-full h-full object-cover object-top"
                    style={{ maxHeight: "320px" }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full min-h-[200px] gap-3 text-ns-ink-muted">
                    {editing ? (
                      <>
                        <ImagePlus className="w-8 h-8 opacity-40" />
                        <span className="font-ui text-xs">
                          Click to upload character art
                        </span>
                      </>
                    ) : (
                      <div className="w-24 h-24 rounded-full bg-ns-accent flex items-center justify-center font-heading text-4xl text-white">
                        {selectedCharacter.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                )}
                {editing && artSrc && (
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <ImagePlus className="w-6 h-6 text-white" />
                    <span className="font-ui text-sm text-white">
                      Change art
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

              {/* Profile Content */}
              <div className="max-w-2xl mx-auto p-6 space-y-6">
                {/* Header row */}
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 flex-1 min-w-0">
                    {editing ? (
                      <input
                        value={draft?.name ?? ""}
                        onChange={(e) =>
                          setDraft((prev) =>
                            prev ? { ...prev, name: e.target.value } : prev,
                          )
                        }
                        placeholder="Character name"
                        className="font-heading italic text-2xl text-ns-ink bg-transparent border-b border-ns-border focus:border-ns-accent focus:outline-none w-full pb-1 transition-colors"
                      />
                    ) : (
                      <h2 className="font-heading italic text-2xl text-ns-ink leading-tight">
                        {selectedCharacter.name}
                      </h2>
                    )}

                    {editing ? (
                      <div className="flex items-center gap-2 mt-2">
                        <label className="font-ui text-[10px] text-ns-ink-muted uppercase tracking-widest">
                          Age
                        </label>
                        <input
                          type="number"
                          value={draft?.age ?? ""}
                          onChange={(e) =>
                            setDraft((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    age: e.target.value
                                      ? parseInt(e.target.value)
                                      : undefined,
                                  }
                                : prev,
                            )
                          }
                          placeholder="—"
                          className="w-16 font-ui text-xs text-ns-ink bg-ns-surface border border-ns-border rounded px-2 py-1 focus:outline-none focus:border-ns-accent transition-colors"
                        />
                      </div>
                    ) : (
                      selectedCharacter.age &&
                      selectedCharacter.age > 0 && (
                        <span className="inline-block font-ui text-xs text-ns-ink-muted bg-ns-surface border border-ns-border px-2 py-0.5 rounded-full">
                          Age {selectedCharacter.age}
                        </span>
                      )
                    )}
                  </div>

                  {/* Edit / Save / Cancel */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {editing ? (
                      <>
                        <button
                          onClick={cancelEditing}
                          disabled={saving}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-ns border border-ns-border font-ui text-xs text-ns-ink-secondary hover:bg-ns-surface active:scale-[0.97] transition-all duration-150"
                        >
                          <X className="w-3.5 h-3.5" />
                          Cancel
                        </button>
                        <button
                          onClick={handleSave}
                          disabled={saving || !draft?.name?.trim()}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-ns bg-ns-accent text-white font-ui text-xs font-medium hover:bg-ns-accent-hover active:scale-[0.97] transition-all duration-150 disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                          {saving ? "Saving…" : "Save"}
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => { if (requireAuth()) startEditing(); }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-ns border border-ns-border font-ui text-xs text-ns-ink-secondary hover:bg-ns-surface hover:text-ns-ink active:scale-[0.97] transition-all duration-150"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Edit
                      </button>
                    )}
                  </div>
                </div>

                <div className="h-px bg-ns-border" />

                {/* Fields */}
                <div className="space-y-5">
                  <Field
                    label="The Soul"
                    value={editing ? draft?.soul : selectedCharacter.soul}
                    editing={editing}
                    placeholder="Core essence, deepest fears, desires, wounds, what drives them…"
                    onChange={(v) =>
                      setDraft((p) => (p ? { ...p, soul: v } : p))
                    }
                    rows={4}
                  />
                  <Field
                    label="Personality & Behavioral Traits"
                    value={
                      editing
                        ? draft?.personality
                        : selectedCharacter.personality
                    }
                    editing={editing}
                    placeholder="How they act, react, think. Quirks, habits, contradictions…"
                    onChange={(v) =>
                      setDraft((p) => (p ? { ...p, personality: v } : p))
                    }
                    rows={3}
                  />
                  <Field
                    label="Voice & Presence"
                    value={editing ? draft?.voice : selectedCharacter.voice}
                    editing={editing}
                    placeholder="Speech patterns, vocabulary, tone, physical presence, mannerisms…"
                    onChange={(v) =>
                      setDraft((p) => (p ? { ...p, voice: v } : p))
                    }
                    rows={3}
                  />
                  <Field
                    label="Backstory"
                    value={
                      editing ? draft?.backstory : selectedCharacter.backstory
                    }
                    editing={editing}
                    placeholder="Origin, history, formative events…"
                    onChange={(v) =>
                      setDraft((p) => (p ? { ...p, backstory: v } : p))
                    }
                    rows={4}
                  />
                  <Field
                    label="Affiliations"
                    value={
                      editing
                        ? draft?.affiliations
                        : selectedCharacter.affiliations
                    }
                    editing={editing}
                    placeholder="Groups, factions, allegiances…"
                    onChange={(v) =>
                      setDraft((p) => (p ? { ...p, affiliations: v } : p))
                    }
                    rows={2}
                  />
                  <Field
                    label="Notes"
                    value={editing ? draft?.notes : selectedCharacter.notes}
                    editing={editing}
                    placeholder="Anything else worth remembering…"
                    onChange={(v) =>
                      setDraft((p) => (p ? { ...p, notes: v } : p))
                    }
                    rows={3}
                  />
                </div>

                {/* Relationship Map */}
                {(editing ||
                  (selectedCharacter.relationships ?? []).length > 0) && (
                  <div className="space-y-3 pt-1">
                    <div className="h-px bg-ns-border" />
                    <p className="font-ui text-[10px] font-semibold text-ns-ink-muted uppercase tracking-widest">
                      Relationship Map
                    </p>

                    {/* Existing relationships */}
                    <div className="space-y-2">
                      {(editing
                        ? draft?.relationships
                        : selectedCharacter.relationships
                      )?.map((rel) => (
                        <div
                          key={rel.characterId}
                          className="flex items-start gap-3 p-3 rounded-ns bg-ns-surface border border-ns-border"
                        >
                          <div className="w-8 h-8 rounded-full bg-ns-accent flex items-center justify-center font-ui font-semibold text-sm text-white flex-shrink-0">
                            {rel.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-ui text-xs font-medium text-ns-ink">
                                {rel.name}
                              </span>
                              <span
                                className={`font-ui text-[10px] font-semibold px-1.5 py-0.5 rounded-full capitalize ${RELATIONSHIP_COLORS[rel.type]}`}
                              >
                                {rel.type}
                              </span>
                            </div>
                            {rel.description && (
                              <p className="font-body text-xs text-ns-ink-secondary mt-0.5 leading-relaxed">
                                {rel.description}
                              </p>
                            )}
                          </div>
                          {editing && (
                            <button
                              onClick={() =>
                                handleRemoveRelationship(rel.characterId)
                              }
                              className="p-1 rounded text-ns-ink-muted hover:text-ns-destructive transition-colors flex-shrink-0"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Add relationship form (edit mode only) */}
                    {editing && linkableCharacters.length > 0 && (
                      <div className="p-3 rounded-ns border border-ns-border border-dashed space-y-2">
                        <p className="font-ui text-[10px] text-ns-ink-muted">
                          Add relationship
                        </p>
                        <div className="flex gap-2 flex-wrap">
                          <select
                            value={newRelationship.characterId}
                            onChange={(e) =>
                              setNewRelationship((p) => ({
                                ...p,
                                characterId: e.target.value,
                              }))
                            }
                            className="flex-1 min-w-0 font-ui text-xs text-ns-ink bg-ns-surface border border-ns-border rounded px-2 py-1.5 focus:outline-none focus:border-ns-accent transition-colors"
                          >
                            <option value="">Select character…</option>
                            {linkableCharacters.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                          <select
                            value={newRelationship.type}
                            onChange={(e) =>
                              setNewRelationship((p) => ({
                                ...p,
                                type: e.target
                                  .value as CharacterRelationship["type"],
                              }))
                            }
                            className="font-ui text-xs text-ns-ink bg-ns-surface border border-ns-border rounded px-2 py-1.5 focus:outline-none focus:border-ns-accent transition-colors capitalize"
                          >
                            {RELATIONSHIP_TYPES.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </div>
                        <textarea
                          value={newRelationship.description}
                          onChange={(e) =>
                            setNewRelationship((p) => ({
                              ...p,
                              description: e.target.value,
                            }))
                          }
                          placeholder="Describe the relationship (optional)…"
                          rows={2}
                          className="w-full font-body text-xs text-ns-ink bg-ns-surface border border-ns-border rounded px-2 py-1.5 resize-none focus:outline-none focus:border-ns-accent transition-colors placeholder:text-ns-ink-muted"
                        />
                        <button
                          onClick={handleAddRelationship}
                          disabled={!newRelationship.characterId}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-ns bg-ns-accent text-white font-ui text-xs font-medium hover:bg-ns-accent-hover active:scale-[0.97] transition-all duration-150 disabled:opacity-40"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Danger zone */}
                {!editing && (
                  <div className="pt-2 border-t border-ns-border">
                    <button
                      onClick={() => { if (requireAuth()) handleDeleteCharacter(selectedCharacter.id); }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-ns font-ui text-xs text-ns-destructive border border-ns-destructive/20 hover:bg-ns-destructive/5 hover:border-ns-destructive/40 active:scale-[0.97] transition-all duration-150"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete Character
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <SlideOverPanel
        open={!isLgUp && isRosterOpen}
        onClose={() => setIsRosterOpen(false)}
        side="left"
        title="Characters"
      >
        <div className="h-full bg-ns-surface">
          <div className="h-full overflow-y-auto py-3 px-3">
            {charactersLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="h-12 rounded-ns bg-ns-surface-hover animate-pulse"
                  />
                ))}
              </div>
            ) : characters.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 py-12">
                <div className="w-12 h-12 rounded-full bg-ns-accent-subtle flex items-center justify-center">
                  <Users className="w-5 h-5 text-ns-accent opacity-60" />
                </div>
                <p className="font-ui text-xs text-ns-ink-muted text-center leading-relaxed">
                  No characters yet.
                  <br />
                  Add your first character.
                </p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {characters.map((c) => {
                  const isSelected = selectedCharacter?.id === c.id;
                  return (
                    <div
                      key={c.id}
                      onClick={() => handleCharacterClick(c)}
                      className={`flex items-center gap-3 rounded-ns px-3 py-2.5 cursor-pointer transition-all duration-150 group ${
                        isSelected
                          ? "bg-ns-accent-subtle"
                          : "hover:bg-ns-surface-hover"
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full flex-shrink-0 overflow-hidden">
                        {c.artUrl ? (
                          <img
                            src={c.artUrl}
                            alt={c.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div
                            className={`w-full h-full flex items-center justify-center font-ui font-semibold text-sm transition-colors ${
                              isSelected
                                ? "bg-ns-accent text-white"
                                : "bg-ns-border text-ns-ink-secondary"
                            }`}
                          >
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p
                          className={`font-ui text-xs font-medium truncate transition-colors ${
                            isSelected ? "text-ns-ink" : "text-ns-ink-secondary"
                          }`}
                        >
                          {c.name}
                        </p>
                        {c.age && c.age > 0 && (
                          <p className="font-ui text-[10px] text-ns-ink-muted">
                            Age {c.age}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </SlideOverPanel>

      {/* ── Modals ── */}
      {isAddModalOpen && (
        <AddCharacterModal
          storyId={storyId ?? ""}
          onClose={() => setIsAddModalOpen(false)}
          onAddCharacter={handleAddCharacter}
        />
      )}
    </div>
  );
};

export default Characters;
