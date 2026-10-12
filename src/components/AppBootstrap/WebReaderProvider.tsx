import { ReaderProvider, type AuthorSupportProps } from "@novelsync/reader-ui";
import { useAuthIdentity } from "@novelsync/platform-auth";
import { useAuthContext } from "@/contexts/AuthContext";
import { useReaderSettings } from "@/routes/Story/hooks/useReaderSettings";
import { useReadAloud } from "@/hooks/useReadAloud";
import { READ_ALOUD_ENABLED, WEB3_ENABLED } from "@/config/featureFlags";
import { APP_NAME } from "@/config/seo";
import { SEOHead } from "@/components/seo/SEOHead";
import StoriesHeader from "@/components/story/StoriesHeader";
import { recommendationService } from "@/cloudFunctions/recommendations";
import { highlightService } from "@/services/HighlightService";
import { dictionaryService } from "@/services/DictionaryService";
import { Web3Boundary } from "@/contexts/Web3Boundary";
import { lazy, Suspense, useState, type ReactNode } from "react";
import { DollarSign } from "lucide-react";
const TipModal = lazy(() =>
  import("@/routes/Story/components/StoryTipModal").then((module) => ({
    default: module.StoryTipModal,
  })),
);
const lookupWord = (word: string) => dictionaryService.lookup(word);
function WebAuthorSupport({
  author,
  authorWalletAddress,
  storyId,
}: AuthorSupportProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="mt-5 flex items-center gap-2">
        <button
          onClick={WEB3_ENABLED ? () => setOpen(true) : undefined}
          disabled={!WEB3_ENABLED}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-ns border border-ns-border font-ui text-xs text-ns-ink-secondary ${WEB3_ENABLED ? "hover:bg-ns-surface hover:text-ns-ink" : "opacity-50 cursor-not-allowed"}`}
        >
          <DollarSign className="w-3.5 h-3.5" />
          Support this author
        </button>
        {!WEB3_ENABLED && (
          <span className="px-2 py-0.5 rounded-full bg-ns-accent-subtle font-ui text-[10px] font-semibold text-ns-accent tracking-wide uppercase">
            Coming soon
          </span>
        )}
      </div>
      {WEB3_ENABLED && open && (
        <Suspense fallback={null}>
          <Web3Boundary>
            <TipModal
              author={author}
              authorWalletAddress={
                authorWalletAddress ||
                "0x0000000000000000000000000000000000000000"
              }
              storyId={storyId}
              isOpen={open}
              onClose={() => setOpen(false)}
            />
          </Web3Boundary>
        </Suspense>
      )}
    </>
  );
}
export function WebReaderProvider({ children }: { children: ReactNode }) {
  const identity = useAuthIdentity();
  const viewer = useAuthContext();
  const preferences = useReaderSettings();
  return (
    <ReaderProvider
      value={{
        identity,
        viewer,
        preferences,
        highlights: highlightService,
        lookupWord,
        appName: APP_NAME,
        Metadata: SEOHead,
        DiscoveryHeader: StoriesHeader,
        AuthorSupport: WebAuthorSupport,
        recommendations:
          import.meta.env.VITE_RECOMMENDATIONS_ENABLED !== "false"
            ? recommendationService
            : undefined,
        readAloud: READ_ALOUD_ENABLED ? useReadAloud : undefined,
      }}
    >
      {children}
    </ReaderProvider>
  );
}
