import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  updateDoc,
  deleteDoc,
  where,
} from "firebase/firestore";
import { auth, firestore } from "../config/firebase";
import { Chapter, Story, StoryMetadata } from "@/types/IStory";
import { getDownloadURL, ref } from "firebase/storage";
import { storage } from "../config/firebase";
import { storageService } from "./StorageService";

const WORD_LIMIT = 5000;
const CHAPTER_LIMIT = 50;

class StoriesRepo {
  private storiesCollection = collection(firestore, "stories");

  async getStoryList(): Promise<StoryMetadata[]> {
    const q = query(this.storiesCollection, orderBy("updatedAt", "desc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title,
        description: data.description,
        chapterCount: data.chapterCount,
        isPublished: data.isPublished,
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt.toDate(),
        author: data.author,
        userId: data.userId,
        views: data.views,
        likes: data.likes,
        coverImageUrl: data.coverImageUrl || "",
        thumbnailUrl: data.thumbnailUrl || "",
      };
    });
  }

  async fetchNovelCoverUrls(novels: string[]): Promise<string[]> {
    const novelCoverURLs: string[] = [];
    for (let novel of novels) {
      const storageRef = ref(storage, `book-covers/${novel}`);
      const novelCoverURL = await getDownloadURL(storageRef);
      novelCoverURLs.push(novelCoverURL);
    }
    return novelCoverURLs;
  }

  async getUserStories(userId: string): Promise<StoryMetadata[]> {
    const q = query(
      this.storiesCollection,
      orderBy("updatedAt", "desc"),
      where("userId", "==", userId),
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title,
        description: data.description,
        chapterCount: data.chapterCount,
        isPublished: data.isPublished,
        createdAt: data.createdAt?.toDate() ?? new Date(),
        updatedAt: data.updatedAt.toDate(),
        author: data.author,
        userId: data.userId,
        views: data.views,
        likes: data.likes,
        coverImageUrl: data.coverImageUrl || "",
        thumbnailUrl: data.thumbnailUrl || "",
        tags: data.tags || [],
        category: data.category || "",
        targetAudience: data.targetAudience || "",
        language: data.language || "",
        copyright: data.copyright || "",
      };
    });
  }

  async getStory(storyId: string): Promise<Story | null> {
    try {
      const storyRef = doc(this.storiesCollection, storyId);
      const storySnap = await getDoc(storyRef);
      if (storySnap.exists()) {
        const data = storySnap.data();
        return {
          id: storySnap.id,
          ...data,
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate(),
          coverImageUrl: data.coverImageUrl || "",
          tags: data.tags || [],
          averageRating: data.averageRating ?? undefined,
          ratingsCount: data.ratingsCount ?? undefined,
        } as Story;
      }
    } catch (error) {
      console.error("Error getting story:", error);
    }
    return null;
  }

  async getUserInfo(userId: string): Promise<string> {
    try {
      const publicProfileRef = doc(firestore, "publicProfiles", userId);
      const profileSnap = await getDoc(publicProfileRef);
      if (profileSnap.exists()) {
        const profile = profileSnap.data();
        return profile.username || "";
      }
    } catch (error) {
      console.error("Error getting user info:", error);
    }
    return "";
  }

  async createStory(
    title: string,
    description: string,
    userId: string,
    metadata: {
      category: string;
      tags: string[];
      targetAudience: string;
      language: string;
      copyright: string;
      coverImageUrl: string;
      thumbnailUrl?: string;
    },
  ): Promise<string> {
    const newStoryRef = doc(this.storiesCollection);
    const author = await this.getUserInfo(userId);
    const newStory: Story = {
      id: newStoryRef.id,
      title,
      description,
      userId,
      isPublished: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      chapterCount: 0,
      author,
      views: 0,
      likes: 0,
      ...metadata,
    };
    await setDoc(newStoryRef, newStory);
    try {
      await this.addChapter(newStoryRef.id, "Chapter 1");
    } catch (error) {
      console.error("Error adding first chapter:", error);
      throw error;
    }
    return newStoryRef.id;
  }

  async deleteStory(storyId: string): Promise<void> {
    const storyRef = doc(this.storiesCollection, storyId);
    await deleteDoc(storyRef);
  }

  async updateStory(
    storyId: string,
    title: string,
    description: string,
  ): Promise<void> {
    try {
      const storyRef = doc(this.storiesCollection, storyId);
      await updateDoc(storyRef, {
        title,
        description,
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error("Error updating story:", error);
      throw error;
    }
  }

  async updateStoryMetadata(
    storyId: string,
    data: {
      title: string;
      description: string;
      category?: string;
      tags?: string[];
      targetAudience?: string;
      language?: string;
      copyright?: string;
    },
  ): Promise<void> {
    const storyRef = doc(this.storiesCollection, storyId);
    // Firestore rejects `undefined` field values — drop any undefined keys so
    // callers can safely omit optional fields.
    const cleaned = Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined),
    );
    await updateDoc(storyRef, { ...cleaned, updatedAt: new Date() });
  }

  async addChapter(storyId: string, chapterTitle: string): Promise<string> {
    try {
      const storyRef = doc(this.storiesCollection, storyId);
      const chaptersCollection = collection(storyRef, "chapters");

      const story = await this.getStory(storyId);
      if (!story) throw new Error("Story not found");

      if (story.chapterCount >= CHAPTER_LIMIT) {
        throw new Error(
          `Chapter limit reached. Current chapter count: ${story.chapterCount}`,
        );
      }

      const newChapterRef = doc(chaptersCollection);
      const newChapter: Chapter = {
        id: newChapterRef.id,
        title: chapterTitle,
        content: "",
        order: story.chapterCount,
        wordCount: 0,
        userId: story.userId,
      };

      await setDoc(newChapterRef, newChapter);

      // Update the story's chapter count
      await updateDoc(storyRef, {
        chapterCount: story.chapterCount + 1,
        updatedAt: new Date(),
      });

      return newChapter.id;
    } catch (error) {
      console.error("Error adding chapter:", error);
      throw error;
    }
  }

  async getChapters(storyId: string): Promise<Chapter[]> {
    try {
      const chaptersCollection = collection(
        doc(this.storiesCollection, storyId),
        "chapters",
      );
      const q = query(chaptersCollection, orderBy("order"));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() }) as Chapter,
      );
    } catch (error) {
      console.error("Error getting chapters:", error);
    }
    return [];
  }

  async updateChapter(
    storyId: string,
    chapterId: string,
    title: string,
    content: string,
  ): Promise<void> {
    try {
      const chapterRef = doc(
        this.storiesCollection,
        storyId,
        "chapters",
        chapterId,
      );
      const wordCount = this.countWords(content);
      if (wordCount > WORD_LIMIT) {
        throw new Error(
          `Chapter exceeds ${WORD_LIMIT} word limit. Current word count: ${wordCount}`,
        );
      }

      await updateDoc(chapterRef, {
        title,
        content,
        wordCount,
      });

      // Update the story's updatedAt field
      await updateDoc(doc(this.storiesCollection, storyId), {
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error("Error updating chapter:", error);
      throw error;
    }
  }

  async deleteChapter(storyId: string, chapterId: string): Promise<void> {
    const chapterRef = doc(
      this.storiesCollection,
      storyId,
      "chapters",
      chapterId,
    );
    await deleteDoc(chapterRef);

    // Update the story's chapter count and updatedAt field
    const storyRef = doc(this.storiesCollection, storyId);
    const story = await this.getStory(storyId);
    if (story) {
      await updateDoc(storyRef, {
        chapterCount: story.chapterCount - 1,
        updatedAt: new Date(),
      });
    }
  }

  async handlePublish(storyId: string): Promise<void> {
    try {
      const storyRef = doc(this.storiesCollection, storyId);

      const story = await this.getStory(storyId);
      if (!story) {
        throw new Error("Story not found");
      }

      await updateDoc(storyRef, {
        isPublished: !story.isPublished,
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error(`Failed to update story ${storyId}:`, error);
      throw error; // Re-throw if you need to propagate the error
    }
  }

  async updateStoryCoverImage(
    storyId: string,
    imageFile: File | null,
    previewUrl: string | null,
  ): Promise<void> {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) {
        throw new Error("You must be signed in to update the cover image.");
      }

      const storyRef = doc(this.storiesCollection, storyId);
      const story = await this.getStory(storyId);
      if (!story) throw new Error("Story not found");
      if (story.userId !== uid) {
        throw new Error("You do not have permission to update this cover.");
      }

      // Delete the old cover + thumbnail from Storage before replacing them
      if (story.coverImageUrl) {
        await storageService.deleteCoverImage(story.coverImageUrl);
      }
      if (story.thumbnailUrl && story.thumbnailUrl !== story.coverImageUrl) {
        await storageService.deleteCoverImage(story.thumbnailUrl);
      }

      let coverImageUrl = "";
      let thumbnailUrl = "";

      if (imageFile) {
        // User-selected file or AI-generated File object
        ({ coverImageUrl, thumbnailUrl } =
          await storageService.uploadCoverImage(imageFile, uid, storyId));
      } else if (previewUrl?.startsWith("data:")) {
        // AI-generated data URL — convert to File before uploading
        const file = storageService.dataUrlToFile(previewUrl);
        ({ coverImageUrl, thumbnailUrl } =
          await storageService.uploadCoverImage(file, uid, storyId));
      }

      await updateDoc(storyRef, {
        coverImageUrl,
        thumbnailUrl,
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error("Error updating cover image:", error);
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code: string }).code === "storage/unauthorized"
      ) {
        throw new Error(
          "Cover upload was denied. Use a JPEG, PNG, or WebP under 2 MB, then try again. If this persists, storage rules may need redeploying (`firebase deploy --only storage`).",
        );
      }
      throw error;
    }
  }

  private countWords(text: string): number {
    return text.trim().split(/\s+/).length;
  }

  getWordLimit(): number {
    return WORD_LIMIT;
  }
}

export const storiesRepo = new StoriesRepo();
