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

  return (
    <div className="min-h-screen bg-ns-bg">
      <SEOHead title={`@${username}'s profile`} noindex />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {/* ── Header ── */}
        <header className="pb-8 border-b border-ns-border animate-ns-fade-in">
          {/* Avatar on top */}
          <div className="w-28 h-28 sm:w-32 sm:h-32 mx-auto">
            <div className="relative w-full h-full rounded-full bg-ns-surface border border-ns-border shadow-ns-sm overflow-hidden flex items-center justify-center group cursor-default">
              {photoURL ? (
                <img
                  src={photoURL}
                  alt={username}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-12 h-12 text-ns-ink-muted" />
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
                    className="absolute inset-0 flex items-center justify-center bg-black/45 text-white opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity disabled:cursor-not-allowed"
                  >
                    {photoUploading ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      <Camera className="w-6 h-6" />
                    )}
                  </button>
                </>
              )}
            </div>
          </div>

          {isSelf && photoError && (
            <p className="mt-2 text-center text-xs font-ui text-ns-destructive">
              {photoError}
            </p>
          )}

          {/* Identity */}
          <div className="flex items-baseline gap-3 flex-wrap mt-5">
            <h1 className="font-heading text-3xl sm:text-4xl text-ns-ink leading-none">
              @{username}
            </h1>
            {fullName && (
              <span className="font-body text-base text-ns-ink-secondary">
                {fullName}
              </span>
            )}
          </div>

          {metaItems.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3">
              {metaItems.map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 font-ui text-[13px] text-ns-ink-secondary"
                >
                  <Icon className="w-3.5 h-3.5 text-ns-ink-muted" />
                  {label}
                </span>
              ))}
            </div>
          )}

          {!isSelf && userId && (
            <div className="mt-5">
              <FollowButton targetId={userId} />
            </div>
          )}

          <Link
            to={`/guestbook/${userId}`}
            className="group mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-ns border border-ns-border bg-ns-surface font-ui text-[13px] font-medium text-ns-ink no-underline hover:border-ns-border-strong hover:bg-ns-surface-hover transition-colors"
          >
            <BookMarked className="w-3.5 h-3.5 text-ns-ink-muted" />
            {isSelf ? "Your guestbook" : `Sign @${username}'s guestbook`}
            <ArrowRight className="w-3.5 h-3.5 text-ns-ink-muted group-hover:translate-x-0.5 transition-transform" />
          </Link>

          {/* Bio / details below */}
          {isSelf ? (
            <div className="mt-6 space-y-4">
              <EditableField
                label="Username"
                value={username || ""}
                onSave={(v) => updateProfile({ username: v })}
                placeholder="your_username"
                maxLength={20}
              />
              <div className="grid gap-4 sm:grid-cols-2">
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
              </div>
              <EditableField
                label="Bio"
                value={bio || ""}
                onSave={(v) => updateProfile({ bio: v })}
                placeholder="Write something about yourself…"
                multiline
                maxLength={300}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <EditableField
                  label="Occupation"
                  value={occupation || ""}
                  onSave={(v) => updateProfile({ occupation: v })}
                  placeholder="What do you do?"
                  maxLength={50}
                />
                <EditableField
                  label="Location"
                  value={location || ""}
                  onSave={(v) => updateProfile({ location: v })}
                  placeholder="Where are you based?"
                  maxLength={50}
                />
              </div>
              <EditableField
                label="What I write about"
                value={writingInterests || ""}
                onSave={(v) => updateProfile({ writingInterests: v })}
                placeholder="What do you want to write about?"
                multiline
                maxLength={200}
              />
            </div>
          ) : (
            <div className="mt-6 space-y-2 max-w-prose">
              {profile.bio && (
                <p className="font-body text-[15px] text-ns-ink-secondary leading-relaxed">
                  {profile.bio}
                </p>
              )}
              {writingInterests && (
                <p className="font-body text-[13px] text-ns-ink-muted leading-relaxed">
                  Writes about: {writingInterests}
                </p>
              )}
            </div>
          )}
        </header>

        {/* Owner-only settings — hidden from other viewers */}
        {isSelf && (
          <Suspense
            fallback={
              <div className="mt-6 h-40 rounded-ns-xl border border-ns-border animate-pulse bg-ns-surface" />
            }
          >
            <OwnerSettings />
          </Suspense>
        )}
      </div>
    </div>
  );
};

export default PublicUserProfile;
