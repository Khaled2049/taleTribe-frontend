import { lazy, Suspense } from "react";

const StoryMetadataModal = lazy(
  () => import("@/routes/Story/StoryMetadataModal"),
);

interface StoriesHeaderProps {
  uid: string | null;
  name?: string;
  onNewStory: () => void;
  isModalOpen: boolean;
  onCloseModal: () => void;
}

const StoriesHeader: React.FC<StoriesHeaderProps> = ({
  uid,
  name,
  isModalOpen,
  onCloseModal,
}) => {
  return (
    <div className="pt-4 sm:pt-8 mb-4">
      {/* The anonymous and signed-in headings occupy the same space, so auth
          restoration does not push the search and story grid down. */}
      <div className="min-w-0">
        <h1 className="max-w-full truncate font-heading text-2xl sm:text-3xl font-semibold leading-9 sm:leading-9 tracking-wide text-gray-900 dark:text-white">
          {uid
            ? name
              ? `Welcome back, ${name}`
              : "Welcome back"
            : "Discover stories"}
        </h1>
        <div className="mt-1.5 w-12 h-0.5 bg-dark-green/30 dark:bg-light-green/30" />
        <p className="mt-1.5 text-gray-500 dark:text-gray-400 text-xs sm:text-sm leading-5">
          Discover and create amazing stories
        </p>
      </div>

      {uid && isModalOpen && (
        <Suspense fallback={null}>
          <StoryMetadataModal
            isOpen={isModalOpen}
            onClose={onCloseModal}
            userId={uid}
          />
        </Suspense>
      )}
    </div>
  );
};

export default StoriesHeader;
