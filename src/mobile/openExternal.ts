import { toast } from "sonner";

const inTauri = () => "__TAURI_INTERNALS__" in window;

// Not config/seo's getAbsoluteUrl: in dev that resolves to the page's own
// origin, which inside the app is tauri://localhost, and the opener rightly
// refuses to hand that to the system browser. In dev the "website" is the web
// app's Vite server, which the Simulator reaches on the host's localhost.
const SITE_URL = (
  import.meta.env.VITE_SITE_URL ||
  (import.meta.env.DEV ? "http://localhost:5173" : "https://thetaletribe.com")
).replace(/\/+$/, "");

export const websiteUrl = (pathOrUrl: string): string => {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${SITE_URL}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
};

/** Opens a website path (or absolute URL) in the system browser. */
export async function openExternal(pathOrUrl: string): Promise<void> {
  const url = websiteUrl(pathOrUrl);
  try {
    if (inTauri()) {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(url);
    } else {
      window.open(url, "_blank", "noopener");
    }
  } catch (error) {
    console.error("Could not open external link:", url, error);
    toast.error("Couldn’t open that link.");
  }
}
