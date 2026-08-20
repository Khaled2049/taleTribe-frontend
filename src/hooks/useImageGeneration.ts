import { useState, useCallback } from "react";
import { Editor } from "@tiptap/react";
import { generateCover } from "@/cloudFunctions/images";
import { storageService } from "@/services/StorageService";

export const MAX_CHAPTER_IMAGES = 5;

export { validateImageFile } from "@/utils/imageUpload";

export function countEditorImages(editor: Editor): number {
  let count = 0;
  editor.state.doc.descendants((node) => {
    if (node.type.name === "image") count++;
  });
  return count;
}

interface UploadContext {
  userId?: string;
  storyId: string;
  chapterId?: string;
}

interface UseImageGenerationParams {
  editorRef: React.RefObject<Editor | null>;
  uploadContextRef: React.RefObject<UploadContext>;
  onError: (msg: string) => void;
}

export function useImageGeneration({
  editorRef,
  uploadContextRef,
  onError,
}: UseImageGenerationParams) {
  const [imagePromptOpen, setImagePromptOpen] = useState(false);
  const [imagePrompt, setImagePrompt] = useState("");
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  const openImagePrompt = useCallback(() => {
    setImagePrompt("");
    setImagePromptOpen(true);
  }, []);

  const handleGenerateImage = useCallback(async () => {
    const editorInstance = editorRef.current;
    if (!editorInstance || !imagePrompt.trim()) return;

    if (countEditorImages(editorInstance) >= MAX_CHAPTER_IMAGES) {
      onError(`Maximum ${MAX_CHAPTER_IMAGES} images per chapter.`);
      return;
    }
    setIsGeneratingImage(true);
    try {
      const { file } = await generateCover(imagePrompt.trim());
      const {
        userId: uid,
        storyId: sid,
        chapterId: cid,
      } = uploadContextRef.current;
      const url = await storageService.uploadChapterImage(
        file,
        uid ?? "",
        sid,
        cid ?? "",
      );
      editorInstance.chain().focus().setImage({ src: url }).run();
      setImagePromptOpen(false);
      setImagePrompt("");
    } catch (err) {
      console.error("Image generation failed:", err);
      onError("Image generation failed. Please try again.");
    } finally {
      setIsGeneratingImage(false);
    }
  }, [imagePrompt, editorRef, uploadContextRef, onError]);

  return {
    imagePromptOpen,
    setImagePromptOpen,
    imagePrompt,
    setImagePrompt,
    isGeneratingImage,
    openImagePrompt,
    handleGenerateImage,
  };
}
