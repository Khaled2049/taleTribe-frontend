// Admins review untrusted drafts, so only images in this project's own bucket
// load; any other image could tell its author who opened the draft and when.
export function isOwnStorageImage(src: string, bucket: string | undefined) {
  if (!bucket) return false;
  try {
    const url = new URL(src);
    if (url.protocol !== "https:") return false;
    if (url.hostname === "firebasestorage.googleapis.com")
      return url.pathname.startsWith(`/v0/b/${bucket}/o/`);
    if (url.hostname === "storage.googleapis.com")
      return url.pathname.startsWith(`/${bucket}/`);
    return false;
  } catch {
    return false;
  }
}

export function withoutForeignImages(
  html: string,
  bucket: string | undefined = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const images = Array.from(doc.querySelectorAll("img"));
  for (const img of images) {
    const src = img.getAttribute("src") ?? "";
    if (isOwnStorageImage(src, bucket)) continue;
    const note = doc.createElement("p");
    let host = "unknown source";
    try {
      host = new URL(src).hostname || host;
    } catch {
      // keep the generic label for a malformed src
    }
    note.textContent = `[External image not loaded: ${host}]`;
    img.replaceWith(note);
  }
  return images.length ? doc.body.innerHTML : html;
}
