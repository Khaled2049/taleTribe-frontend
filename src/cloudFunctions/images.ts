/**
 * Image generation service for book covers.
 * Handles both local development (Python API) and production (Firebase Function + Replicate).
 */

import api from "./index";

const LOCAL_API_URL = "http://localhost:8000/generate-cover";
const isDevelopment = import.meta.env.MODE === "development";

interface GenerateCoverResponse {
  image: string; // base64 encoded image
  prompt: string;
  model: string;
  generation_time: number;
}

interface GenerateCoverResult {
  file: File;
  imageUrl: string; // data URL for preview
}

/**
 * Convert base64 string to File object.
 */
function base64ToFile(base64: string, filename: string): File {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new File([byteArray], filename, { type: "image/png" });
}

/**
 * Generate a cover image from a text prompt.
 *
 * @param prompt - Text description of the image to generate
 * @returns Promise resolving to File object and data URL for preview
 * @throws Error if generation fails
 */
export async function generateCover(
  prompt: string,
): Promise<GenerateCoverResult> {
  if (!prompt || prompt.trim().length === 0) {
    throw new Error("Prompt is required");
  }

  if (prompt.length > 500) {
    throw new Error("Prompt must be 500 characters or less");
  }

  try {
    let response: GenerateCoverResponse;

    if (isDevelopment) {
      // Use local Python API in development
      console.log("Using local image generation API");
      const fetchResponse = await fetch(LOCAL_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });

      if (!fetchResponse.ok) {
        const errorData = await fetchResponse.json().catch(() => ({}));
        throw new Error(
          errorData.error ||
            errorData.detail ||
            `HTTP error! status: ${fetchResponse.status}`,
        );
      }

      response = await fetchResponse.json();
    } else {
      try {
        const apiResponse = await api.post<GenerateCoverResponse>(
          "/generateCoverImage",
          { prompt: prompt.trim() },
        );
        response = apiResponse.data;
      } catch (err: unknown) {
        const apiError = err as {
          message?: string;
          response?: { data?: { error?: string } };
        };
        console.error("API error details:", {
          message: apiError.message,
          response: apiError.response?.data,
        });

        if (apiError.response?.data?.error) {
          throw new Error(apiError.response.data.error);
        }
        throw err;
      }
    }

    // Validate response
    if (!response) {
      throw new Error("Invalid response: no data received");
    }
    if (!response.image || typeof response.image !== "string") {
      console.error("Invalid response structure:", {
        hasImage: !!response.image,
        imageType: typeof response.image,
        imageLength: response.image?.length,
        responseKeys: Object.keys(response),
      });
      throw new Error(
        "Invalid response: missing or invalid image data. The server may have generated an image but failed to return it properly.",
      );
    }

    // Validate base64 string
    if (response.image.length < 100) {
      console.error(
        "Suspiciously short base64 string:",
        response.image.substring(0, 50),
      );
      throw new Error(
        "Invalid response: image data appears to be corrupted or incomplete",
      );
    }

    // Convert base64 to File object
    const filename = `ai-cover-${Date.now()}.png`;
    const file = base64ToFile(response.image, filename);

    // Create data URL for preview
    const imageUrl = `data:image/png;base64,${response.image}`;

    return {
      file,
      imageUrl,
    };
  } catch (error) {
    console.error("Error generating cover image:", error);

    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Failed to generate cover image. Please try again.");
  }
}
