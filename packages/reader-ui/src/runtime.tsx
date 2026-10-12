import {
  createContext,
  useContext,
  type ComponentType,
  type ReactNode,
} from "react";
import type { ReaderSettings, WordDefinition } from "./types/IReader.js";
import type { RecommendationTransport } from "./recommendations.js";
import type { HighlightRepository } from "./services/HighlightService.js";
import { useDisabledReadAloud, type ReadAloudHook } from "./read-aloud.js";

export interface ReaderIdentity {
  uid: string | null;
  email: string | null;
  loading: boolean;
  isSignedIn: boolean;
  isAdmin: boolean;
  displayName?: string | null;
  photoURL?: string | null;
}

export interface ReaderUser {
  uid: string;
  username?: string;
  firstName?: string;
  photoURL?: string | null;
  following?: string[];
}

export interface ReaderViewer {
  user: ReaderUser | null;
  loading: boolean;
  followUser: (uid: string) => Promise<void>;
  unfollowUser: (uid: string) => Promise<void>;
}

export interface ReaderPreferences {
  settings: ReaderSettings;
  updateSettings: (settings: Partial<ReaderSettings>) => void;
  resetSettings: () => void;
  isLoading: boolean;
}

export interface ReaderMetadata {
  title?: string;
  description?: string;
  keywords?: string[];
  image?: string;
  url?: string;
  type?: "website" | "article" | "book" | "profile";
  author?: string;
  noindex?: boolean;
}

export interface DiscoveryHeaderProps {
  uid: string | null;
  name?: string;
  onNewStory: () => void;
  isModalOpen: boolean;
  onCloseModal: () => void;
}

export interface AuthorSupportProps {
  author: string;
  authorWalletAddress?: string;
  storyId: string;
}

export interface ReaderEnvironment {
  identity: ReaderIdentity;
  viewer: ReaderViewer;
  preferences: ReaderPreferences;
  highlights: HighlightRepository;
  lookupWord: (word: string) => Promise<WordDefinition>;
  appName: string;
  recommendations?: RecommendationTransport;
  Metadata?: ComponentType<ReaderMetadata>;
  DiscoveryHeader?: ComponentType<DiscoveryHeaderProps>;
  AuthorSupport?: ComponentType<AuthorSupportProps>;
  /** Keep this hook implementation fixed for the lifetime of the provider. */
  readAloud?: ReadAloudHook;
}

const ReaderContext = createContext<ReaderEnvironment | null>(null);

export function ReaderProvider({
  value,
  children,
}: {
  value: ReaderEnvironment;
  children: ReactNode;
}) {
  return (
    <ReaderContext.Provider value={value}>{children}</ReaderContext.Provider>
  );
}

export function useReaderEnvironment(): ReaderEnvironment {
  const environment = useContext(ReaderContext);
  if (!environment)
    throw new Error("Reading features require an app-owned ReaderProvider.");
  return environment;
}

export const useReaderIdentity = () => useReaderEnvironment().identity;
export const useReaderViewer = () => useReaderEnvironment().viewer;

export function ReaderMetadataHead(props: ReaderMetadata) {
  const Metadata = useReaderEnvironment().Metadata;
  return Metadata ? <Metadata {...props} /> : null;
}

export function DiscoveryHeader(props: DiscoveryHeaderProps) {
  const Header = useReaderEnvironment().DiscoveryHeader;
  if (Header) return <Header {...props} />;
  if (!props.uid) return <div className="pt-4 sm:pt-8" aria-hidden="true" />;
  return (
    <div className="pt-4 sm:pt-8 mb-4">
      <h1 className="font-heading text-2xl sm:text-3xl text-ns-ink">
        {props.name ? `Welcome back, ${props.name}` : "Welcome back"}
      </h1>
    </div>
  );
}

export function AuthorSupport(props: AuthorSupportProps) {
  const Support = useReaderEnvironment().AuthorSupport;
  return Support ? (
    <Support {...props} />
  ) : (
    <div className="mt-5 flex items-center gap-2">
      <button
        disabled
        className="rounded-ns border border-ns-border px-3 py-1.5 font-ui text-xs text-ns-ink-secondary opacity-50"
      >
        Support this author
      </button>
      <span className="rounded-full bg-ns-accent-subtle px-2 py-0.5 font-ui text-[10px] text-ns-accent">
        Coming soon
      </span>
    </div>
  );
}

export function useReaderReadAloud(options: Parameters<ReadAloudHook>[0]) {
  const useReadAloud = useReaderEnvironment().readAloud ?? useDisabledReadAloud;
  return useReadAloud(options);
}
