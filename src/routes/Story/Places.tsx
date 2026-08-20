import React, { useEffect, useRef, useState } from "react";
import { Place } from "@novelsync/story-data-client";
import AddPlaceModal from "@/components/story/places/AddPlaceModal";
import { storageService } from "@/services/StorageService";
import { useParams } from "react-router-dom";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { SlideOverPanel } from "@/components/common";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { toast } from "sonner";
import { validateImageFile } from "@/utils/imageUpload";
import {
  useAddPlace,
  usePlaces,
  useDeletePlace,
  useUpdatePlace,
} from "@/hooks/queries/usePlaceQueries";
import {
  Map,
  MapPin,
  MapPinPlus,
  ImagePlus,
  Pencil,
  Trash2,
  X,
  Check,
  List,
} from "lucide-react";

// Reusable field component
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

const Places: React.FC = () => {
  const { storyId } = useParams<{ storyId: string }>();
  const { isDemo, requireAuth } = useDemoMode();
  const { isLgUp } = useBreakpoint();

  const {
    data: places = [],
    isPending: placesLoading,
    isError: placesError,
    error: placesErrorValue,
  } = usePlaces(storyId);
  const addPlace = useAddPlace(storyId);
  const deletePlace = useDeletePlace(storyId);
  const updatePlace = useUpdatePlace(storyId);

  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Place | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const saving = updatePlace.isPending;
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [isRosterOpen, setIsRosterOpen] = useState(false);

  const handlePlaceClick = (place: Place) => {
    setSelectedPlace(place);
    if (!isLgUp) {
      setIsRosterOpen(false);
    }
    setEditing(false);
    setDraft(null);
    setImagePreview(null);
    setImageFile(null);
  };

  useEffect(() => {
    if (isLgUp) {
      setIsRosterOpen(false);
    }
  }, [isLgUp]);

  const handleAddPlace = async (
    placeData: Omit<Place, "id">,
    imageFile: File | null,
  ) => {
    let newPlace = await addPlace.mutateAsync(placeData);
    if (imageFile) {
      const imageUrl = await storageService.uploadPlaceImage(
        imageFile,
        newPlace.userId,
        newPlace.id,
      );
      const withImage = { ...newPlace, imageUrl };
      await updatePlace.mutateAsync(withImage);
      newPlace = withImage;
    }
    setIsAddModalOpen(false);
    setSelectedPlace(newPlace);
  };

  const handleDeletePlace = (placeId: string) => {
    deletePlace.mutate(placeId, {
      onSuccess: () => {
        if (selectedPlace?.id === placeId) setSelectedPlace(null);
      },
    });
  };

  const startEditing = () => {
    if (!selectedPlace) return;
    setDraft({ ...selectedPlace });
    setImagePreview(null);
    setImageFile(null);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setDraft(null);
    setImagePreview(null);
    setImageFile(null);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!draft || !storyId) return;
    try {
      let updatedDraft = { ...draft };

      if (imageFile) {
        const url = await storageService.uploadPlaceImage(
          imageFile,
          draft.userId,
          draft.id,
        );
        updatedDraft = { ...updatedDraft, imageUrl: url };
      }

      await updatePlace.mutateAsync(updatedDraft);
      setSelectedPlace(updatedDraft);
      setEditing(false);
      setDraft(null);
      setImagePreview(null);
      setImageFile(null);
    } catch (error) {
      console.error("Error saving place:", error);
    }
  };

  const place = editing ? draft : selectedPlace;
  const imageSrc = imagePreview ?? place?.imageUrl ?? null;

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
            Places
          </span>
          {places.length > 0 && (
            <span className="font-ui text-[10px] font-semibold text-ns-accent bg-ns-accent-subtle px-2 py-0.5 rounded-full">
              {places.length}
            </span>
          )}
        </div>
        <button
          onClick={() => { if (requireAuth()) setIsAddModalOpen(true); }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-ns-accent text-white font-ui text-xs font-medium rounded-ns hover:bg-ns-accent-hover active:scale-[0.97] transition-all duration-150"
        >
          <MapPinPlus className="w-3.5 h-3.5" />
          Add Place
        </button>
        <button
          onClick={() => setIsRosterOpen(true)}
          className="lg:hidden inline-flex items-center gap-1.5 px-3 py-1.5 border border-ns-border font-ui text-xs text-ns-ink-secondary rounded-ns hover:bg-ns-surface-hover hover:text-ns-ink transition-all duration-150"
        >
          <List className="w-3.5 h-3.5" />
          Places
        </button>
      </div>
      {placesError && (
        <div className="mx-4 mt-3 rounded-ns border border-ns-destructive/20 bg-ns-accent-subtle px-3 py-2 font-ui text-xs text-ns-destructive">
          {placesErrorValue instanceof Error
            ? placesErrorValue.message
            : "Failed to load places."}
        </div>
      )}

      {/* ── Two-Panel Content ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Roster */}
        <div className="hidden lg:flex w-64 flex-shrink-0 border-r border-ns-border flex-col bg-ns-surface">
          <div className="flex-1 overflow-y-auto py-3 px-3">
            {placesLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="h-12 rounded-ns bg-ns-surface-hover animate-pulse"
                  />
                ))}
              </div>
            ) : places.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 py-12">
                <div className="w-12 h-12 rounded-full bg-ns-accent-subtle flex items-center justify-center">
                  <Map className="w-5 h-5 text-ns-accent opacity-60" />
                </div>
                <p className="font-ui text-xs text-ns-ink-muted text-center leading-relaxed">
                  No places yet.
                  <br />
                  Add your first location.
                </p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {places.map((p) => {
                  const isSelected = selectedPlace?.id === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => handlePlaceClick(p)}
                      className={`flex items-center gap-3 rounded-ns px-3 py-2.5 cursor-pointer transition-all duration-150 group ${
                        isSelected
                          ? "bg-ns-accent-subtle"
                          : "hover:bg-ns-surface-hover"
                      }`}
                    >
                      {/* Thumbnail or icon */}
                      <div className="w-8 h-8 rounded-full flex-shrink-0 overflow-hidden">
                        {p.imageUrl ? (
                          <img
                            src={p.imageUrl}
                            alt={p.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div
                            className={`w-full h-full flex items-center justify-center transition-colors ${
                              isSelected
                                ? "bg-ns-accent text-white"
                                : "bg-ns-border text-ns-ink-secondary"
                            }`}
                          >
                            <MapPin className="w-3.5 h-3.5" />
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
                          {p.name}
                        </p>
                        {p.description && (
                          <p className="font-ui text-[10px] text-ns-ink-muted truncate">
                            {p.description}
                          </p>
                        )}
                      </div>

                      {/* Hover actions */}
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!requireAuth()) return;
                            handlePlaceClick(p);
                            setTimeout(() => {
                              setDraft({ ...p });
                              setEditing(true);
                            }, 0);
                          }}
                          className="p-1.5 rounded text-ns-ink-muted hover:text-ns-ink hover:bg-ns-elevated transition-all duration-150"
                          aria-label="Edit place"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!requireAuth()) return;
                            handleDeletePlace(p.id);
                          }}
                          className="p-1.5 rounded text-ns-ink-muted hover:text-ns-destructive hover:bg-ns-elevated transition-all duration-150"
                          aria-label="Delete place"
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
          {!selectedPlace ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 px-8 animate-ns-fade-in">
              <div className="w-14 h-14 rounded-full bg-ns-accent-subtle flex items-center justify-center">
                <MapPin className="w-6 h-6 text-ns-accent opacity-60" />
              </div>
              <div className="text-center space-y-1">
                <p className="font-heading italic text-xl text-ns-ink-secondary">
                  Select a place
                </p>
                <p className="font-ui text-xs text-ns-ink-muted">
                  Choose a location from the list to view its details
                </p>
              </div>
            </div>
          ) : (
            <div className="animate-ns-fade-in">
              {/* Image Hero */}
              <div
                className={`relative w-full bg-ns-surface border-b border-ns-border overflow-hidden ${
                  editing ? "cursor-pointer group" : ""
                }`}
                style={{ minHeight: "180px", maxHeight: "280px" }}
                onClick={
                  editing ? () => imageInputRef.current?.click() : undefined
                }
              >
                {imageSrc ? (
                  <img
                    src={imageSrc}
                    alt={place?.name}
                    className="w-full h-full object-cover"
                    style={{ maxHeight: "280px" }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full min-h-[180px] gap-3 text-ns-ink-muted">
                    {editing ? (
                      <>
                        <ImagePlus className="w-8 h-8 opacity-40" />
                        <span className="font-ui text-xs">
                          Click to upload a location image
                        </span>
                      </>
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-ns-accent/20 flex items-center justify-center">
                        <MapPin className="w-9 h-9 text-ns-accent opacity-60" />
                      </div>
                    )}
                  </div>
                )}
                {editing && imageSrc && (
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <ImagePlus className="w-6 h-6 text-white" />
                    <span className="font-ui text-sm text-white">
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
                        placeholder="Place name"
                        className="font-heading italic text-2xl text-ns-ink bg-transparent border-b border-ns-border focus:border-ns-accent focus:outline-none w-full pb-1 transition-colors"
                      />
                    ) : (
                      <h2 className="font-heading italic text-2xl text-ns-ink leading-tight">
                        {selectedPlace.name}
                      </h2>
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
                    label="Description"
                    value={
                      editing ? draft?.description : selectedPlace.description
                    }
                    editing={editing}
                    placeholder="What is this place? A brief overview…"
                    onChange={(v) =>
                      setDraft((p) => (p ? { ...p, description: v } : p))
                    }
                    rows={3}
                  />
                  <Field
                    label="Atmosphere"
                    value={
                      editing ? draft?.atmosphere : selectedPlace.atmosphere
                    }
                    editing={editing}
                    placeholder="Mood, sensory details, sounds, smells, light…"
                    onChange={(v) =>
                      setDraft((p) => (p ? { ...p, atmosphere: v } : p))
                    }
                    rows={3}
                  />
                  <Field
                    label="Geography"
                    value={editing ? draft?.geography : selectedPlace.geography}
                    editing={editing}
                    placeholder="Physical layout, terrain, surroundings, size…"
                    onChange={(v) =>
                      setDraft((p) => (p ? { ...p, geography: v } : p))
                    }
                    rows={3}
                  />
                  <Field
                    label="History"
                    value={editing ? draft?.history : selectedPlace.history}
                    editing={editing}
                    placeholder="Origins, past events, how it came to be…"
                    onChange={(v) =>
                      setDraft((p) => (p ? { ...p, history: v } : p))
                    }
                    rows={3}
                  />
                  <Field
                    label="Significance"
                    value={
                      editing ? draft?.significance : selectedPlace.significance
                    }
                    editing={editing}
                    placeholder="Why this place matters to the story or characters…"
                    onChange={(v) =>
                      setDraft((p) => (p ? { ...p, significance: v } : p))
                    }
                    rows={2}
                  />
                  <Field
                    label="Notes"
                    value={editing ? draft?.notes : selectedPlace.notes}
                    editing={editing}
                    placeholder="Anything else worth remembering…"
                    onChange={(v) =>
                      setDraft((p) => (p ? { ...p, notes: v } : p))
                    }
                    rows={2}
                  />
                </div>

                {/* Danger zone */}
                {!editing && (
                  <div className="pt-2 border-t border-ns-border">
                    <button
                      onClick={() => { if (requireAuth()) handleDeletePlace(selectedPlace.id); }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-ns font-ui text-xs text-ns-destructive border border-ns-destructive/20 hover:bg-ns-destructive/5 hover:border-ns-destructive/40 active:scale-[0.97] transition-all duration-150"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete Place
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
        title="Places"
      >
        <div className="h-full bg-ns-surface">
          <div className="h-full overflow-y-auto py-3 px-3">
            {placesLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="h-12 rounded-ns bg-ns-surface-hover animate-pulse"
                  />
                ))}
              </div>
            ) : places.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 py-12">
                <div className="w-12 h-12 rounded-full bg-ns-accent-subtle flex items-center justify-center">
                  <Map className="w-5 h-5 text-ns-accent opacity-60" />
                </div>
                <p className="font-ui text-xs text-ns-ink-muted text-center leading-relaxed">
                  No places yet.
                  <br />
                  Add your first location.
                </p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {places.map((p) => {
                  const isSelected = selectedPlace?.id === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => handlePlaceClick(p)}
                      className={`flex items-center gap-3 rounded-ns px-3 py-2.5 cursor-pointer transition-all duration-150 group ${
                        isSelected
                          ? "bg-ns-accent-subtle"
                          : "hover:bg-ns-surface-hover"
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full flex-shrink-0 overflow-hidden">
                        {p.imageUrl ? (
                          <img
                            src={p.imageUrl}
                            alt={p.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div
                            className={`w-full h-full flex items-center justify-center transition-colors ${
                              isSelected
                                ? "bg-ns-accent text-white"
                                : "bg-ns-border text-ns-ink-secondary"
                            }`}
                          >
                            <MapPin className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p
                          className={`font-ui text-xs font-medium truncate transition-colors ${
                            isSelected ? "text-ns-ink" : "text-ns-ink-secondary"
                          }`}
                        >
                          {p.name}
                        </p>
                        {p.description && (
                          <p className="font-ui text-[10px] text-ns-ink-muted truncate">
                            {p.description}
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
        <AddPlaceModal
          storyId={storyId ?? ""}
          onClose={() => setIsAddModalOpen(false)}
          onAddPlace={handleAddPlace}
        />
      )}
    </div>
  );
};

export default Places;
