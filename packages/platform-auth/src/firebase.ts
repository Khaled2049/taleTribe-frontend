import {
  initializeApp,
  type FirebaseApp,
  type FirebaseOptions,
} from "firebase/app";
import {
  browserLocalPersistence,
  connectAuthEmulator,
  getAuth,
  indexedDBLocalPersistence,
  initializeAuth,
  type Auth,
} from "firebase/auth";

export interface PlatformAuthOptions {
  firebase: FirebaseOptions;
  platform: "web" | "mobile";
  emulators?: {
    authUrl: string;
    firestore?: { host: string; port: number };
    storage?: { host: string; port: number };
  };
}
export let app: FirebaseApp;
export let auth: Auth;
let configuration: PlatformAuthOptions | null = null;
let configurationKey: string | null = null;
function configKey(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(configKey).join(",")}]`;
  return `{${Object.entries(value)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${configKey(item)}`)
    .join(",")}}`;
}
const connected = new Set<string>();

/** Configure before route loaders, identity hooks, or SDK subpaths run. */
export function initializePlatformAuth(options: PlatformAuthOptions): {
  app: FirebaseApp;
  auth: Auth;
} {
  if (configuration) {
    if (configurationKey !== configKey(options))
      throw new Error(
        "Platform auth is already initialized with a different configuration.",
      );
    return { app, auth };
  }
  app = initializeApp(options.firebase);
  auth =
    options.platform === "mobile"
      ? initializeAuth(app, {
          persistence: [indexedDBLocalPersistence, browserLocalPersistence],
        })
      : getAuth(app);
  configurationKey = configKey(options);
  configuration = JSON.parse(JSON.stringify(options)) as PlatformAuthOptions;
  connectEmulatorOnce("auth", () =>
    connectAuthEmulator(auth, options.emulators!.authUrl, {
      disableWarnings: true,
    }),
  );
  return { app, auth };
}
export function getPlatformAuth(): {
  app: FirebaseApp;
  auth: Auth;
  options: PlatformAuthOptions;
} {
  if (!configuration)
    throw new Error(
      "Call initializePlatformAuth during app bootstrap before accessing Firebase.",
    );
  return { app, auth, options: configuration };
}
export function connectEmulatorOnce(
  service: string,
  connect: () => void,
): void {
  if (!configuration?.emulators || connected.has(service)) return;
  try {
    connect();
    connected.add(service);
  } catch (error) {
    console.warn("Could not connect the Firebase emulator:", service, error);
  }
}
