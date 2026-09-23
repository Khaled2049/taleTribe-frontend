import React, { lazy, Suspense, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowRight,
  BookMarked,
  Briefcase,
  Calendar,
  Camera,
  Loader2,
  MapPin,
  User,
  UserX,
} from "lucide-react";
import { useAuthContext } from "@/contexts/AuthContext";
import { usePublicProfile } from "@/hooks/queries/useUserQueries";
import { EditableField } from "@/components/ui/editable-field";
import { SEOHead } from "@/components/seo/SEOHead";
import FollowButton from "@/components/common/FollowButton";
import { storageService } from "@/services/StorageService";
import { validateImageFile } from "@/utils/imageUpload";

const OwnerSettings = lazy(() => import("./OwnerSettings"));

const formatMemberSince = (isoDate?: string): string | null => {
  if (!isoDate) return null;
  const date = new Date(isoDate);
  if (isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
};

const PublicUserProfile: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const { user, loading: authLoading, updateProfile } = useAuthContext();
  const isSelf = !!user && user.uid === userId;

  const { data: profile, isLoading: profileLoading } = usePublicProfile(userId);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const handlePhotoSelected = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    // Reset so re-selecting the same file still fires onChange.
    e.target.value = "";
    if (!file || !user) return;

    const validationError = validateImageFile(file);
    if (validationError) {
      setPhotoError(validationError);
      return;
    }

    setPhotoError(null);
    setPhotoUploading(true);
    try {
      const photoURL = await storageService.uploadProfileImage(file, user.uid);
      // updateProfile persists public fields through story-data and refreshes
      // the public-profile query so the avatar updates immediately.
      await updateProfile({ photoURL });
    } catch (err) {
      setPhotoError(
        err instanceof Error ? err.message : "Couldn't upload photo.",
      );
    } finally {
      setPhotoUploading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-ns-bg">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ns-accent"></div>
      </div>
    );
  }

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-ns-bg">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ns-accent"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-ns-bg flex items-center justify-center px-4">
        <div className="text-center">
          <UserX className="w-10 h-10 mx-auto mb-4 text-ns-ink-muted opacity-40" />
          <h1 className="font-heading text-xl text-ns-ink mb-2">
            This profile doesn't exist
          </h1>
          <p className="font-body text-sm text-ns-ink-secondary mb-6">
            The member you're looking for may have changed their account.
          </p>
          <Link
            to="/stories"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-ns border border-ns-border font-ui text-xs text-ns-ink-secondary hover:bg-ns-surface hover:text-ns-ink transition-all duration-150"
          >
            Browse stories
          </Link>
        </div>
      </div>
    );
  }

  // Public identity is the @username. For the owner, prefer the live auth value
  // so username edits reflect instantly (the mirrored public doc may lag).
  const username = (isSelf && user?.username) || profile.username;
  // Prefer the live auth value for the owner so a fresh upload shows instantly.
  const photoURL = (isSelf && user?.photoURL) || profile.photoURL;
  const firstName = (isSelf && user?.firstName) || profile.firstName;
  const lastName = (isSelf && user?.lastName) || profile.lastName;
  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  const bio = (isSelf && user?.bio) || profile.bio;
  const occupation = (isSelf && user?.occupation) || profile.occupation;
  const location = (isSelf && user?.location) || profile.location;
  const writingInterests =
    (isSelf && user?.writingInterests) || profile.writingInterests;
  const memberSince = formatMemberSince(profile.createdAt);
  // Owners edit occupation/location inline below, so only show them as read-only
  // chips for visitors. "Member since" is shown to everyone.
  const metaItems = [
    !isSelf && profile.occupation
      ? { icon: Briefcase, label: profile.occupation }
      : null,
    !isSelf && profile.location
      ? { icon: MapPin, label: profile.location }
      : null,
    memberSince
      ? { icon: Calendar, label: `Member since ${memberSince}` }
      : null,
  ].filter(Boolean) as { icon: React.ElementType; label: string }[];

  const identityFields = (
    <div className="grid gap-x-6 gap-y-6 sm:grid-cols-2">
      <EditableField
        className="sm:col-span-2"
        label="Username"
        prefix="@"
        value={username || ""}
        onSave={(v) => updateProfile({ username: v })}
        placeholder="username"
        maxLength={20}
      />
      <EditableField
        label="First name"
        value={firstName || ""}
        onSave={(v) => updateProfile({ firstName: v })}
        placeholder="First name"
        maxLength={50}
      />
      <EditableField
        label="Last name"
        value={lastName || ""}
        onSave={(v) => updateProfile({ lastName: v })}
        placeholder="Last name"
        maxLength={50}
      />
      <EditableField
        className="sm:col-span-2"
        label="Bio"
        value={bio || ""}
        onSave={(v) => updateProfile({ bio: v })}
        placeholder="A line or two about you"
        multiline
        maxLength={300}
      />
      <EditableField
        label="Occupation"
        value={occupation || ""}
        onSave={(v) => updateProfile({ occupation: v })}
        placeholder="Occupation"
        maxLength={50}
      />
      <EditableField
        label="Location"
        value={location || ""}
        onSave={(v) => updateProfile({ location: v })}
        placeholder="Location"
        maxLength={50}
      />
      <EditableField
        className="sm:col-span-2"
        label="Writes about"
        value={writingInterests || ""}
        onSave={(v) => updateProfile({ writingInterests: v })}
        placeholder="Genres, themes, worlds"
        multiline
        maxLength={200}
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-ns-bg">
      <SEOHead title={`@${username}'s profile`} noindex />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <header className="relative animate-ns-fade-in overflow-hidden border-b border-ns-border pb-10 sm:pb-12">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-32 h-72 w-72 rounded-full bg-ns-accent-subtle blur-3xl"
          />

          <div className="relative grid gap-7 sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-center sm:gap-9">
            <div>
              <div className="group relative mx-auto h-28 w-28 sm:mx-0 sm:h-32 sm:w-32">
                <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full border border-ns-border bg-ns-surface shadow-ns-sm">
                  {photoURL ? (
                    <img
                      src={photoURL}
                      alt={username}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <User className="h-11 w-11 text-ns-ink-muted" />
                  )}

                  {isSelf && (
                    <>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={handlePhotoSelected}
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={photoUploading}
                        aria-label="Change profile photo"
                        className="absolute inset-0 flex items-center justify-center bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 disabled:cursor-not-allowed"
                      >
                        {photoUploading ? (
                          <Loader2 className="h-6 w-6 animate-spin" />
                        ) : (
                          <Camera className="h-6 w-6" />
                        )}
                      </button>
                    </>
                  )}
                </div>
                {isSelf && (
                  <span className="pointer-events-none absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-ns-bg bg-ns-accent text-white transition-transform group-hover:scale-0">
                    {photoUploading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Camera className="h-3.5 w-3.5" />
                    )}
                  </span>
                )}
              </div>
              {isSelf && photoError && (
                <p className="mt-3 text-center font-ui text-xs text-ns-destructive sm:text-left">
                  {photoError}
                </p>
              )}
            </div>

            <div className="min-w-0 text-center sm:text-left">
              <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.2em] text-ns-accent">
                {isSelf ? "Your public profile" : "TheTaleTribe writer"}
              </p>
              <h1 className="mt-3 break-words font-heading text-[2.7rem] font-light leading-[0.95] text-ns-ink sm:text-6xl">
                <span className="text-ns-ink-muted">@</span>
                {username}
              </h1>
              {fullName && (
                <p className="mt-3 font-body text-lg text-ns-ink-secondary">
                  {fullName}
                </p>
              )}

              {metaItems.length > 0 && (
                <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 sm:justify-start">
                  {metaItems.map(({ icon: Icon, label }) => (
                    <span
                      key={label}
                      className="inline-flex items-center gap-1.5 font-ui text-xs text-ns-ink-secondary"
                    >
                      <Icon className="h-3.5 w-3.5 text-ns-ink-muted" />
                      {label}
                    </span>
                  ))}
                </div>
              )}

              {!isSelf && userId && (
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3 sm:justify-start">
                  <FollowButton targetId={userId} />
                  <Link
                    to={`/guestbook/${userId}`}
                    className="group inline-flex items-center gap-2 border-b border-ns-border py-2 font-ui text-[13px] font-medium text-ns-ink no-underline transition-colors hover:border-ns-accent hover:text-ns-accent"
                  >
                    <BookMarked className="h-3.5 w-3.5 text-ns-ink-muted" />
                    {`Sign @${username}'s guestbook`}
                    <ArrowRight className="h-3.5 w-3.5 text-ns-ink-muted transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </div>
              )}
            </div>
          </div>

          {!isSelf && (profile.bio || writingInterests) && (
            <div className="mt-9 max-w-2xl border-t border-ns-border pt-7">
              {profile.bio && (
                <p className="font-body text-[17px] leading-relaxed text-ns-ink-secondary">
                  {profile.bio}
                </p>
              )}
              {writingInterests && (
                <p className="mt-4 font-ui text-xs leading-relaxed text-ns-ink-muted">
                  <span className="mr-2 font-semibold uppercase tracking-[0.12em] text-ns-accent">
                    Writes about
                  </span>
                  {writingInterests}
                </p>
              )}
            </div>
          )}
        </header>

        {isSelf && (
          <Suspense
            fallback={
              <div className="mt-12 grid gap-12 lg:grid-cols-2 lg:gap-16">
                <div className="h-96 animate-pulse rounded-ns bg-ns-surface" />
                <div className="h-96 animate-pulse rounded-ns bg-ns-surface" />
              </div>
            }
          >
            <OwnerSettings identity={identityFields} />
          </Suspense>
        )}
      </div>
    </div>
  );
};

export default PublicUserProfile;
