/**
 * Generate cover image endpoint using Replicate API.
 * This endpoint proxies requests to Replicate API to protect the API key.
 */
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { corsOptions } from "../infra/corsConfig";
import { requireAuth } from "../infra/authService";
import Replicate from "replicate";

const replicateApiToken = defineSecret("REPLICATE_API_TOKEN");

interface GenerateCoverRequest {
  prompt: string;
}

/**
 * Convert image URL to base64 string.
 */
async function imageUrlToBase64(imageUrl: string): Promise<string> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }
  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer).toString("base64");
}

/**
 * Convert ReadableStream to base64 string.
 */
async function readableStreamToBase64(
  stream: ReadableStream<Uint8Array>
): Promise<string> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
      }
    }
  } finally {
    reader.releaseLock();
  }

  // Combine all chunks into a single Uint8Array
  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  // Convert to base64
  return Buffer.from(combined).toString("base64");
}

/**
 * Generate cover image using Replicate API.
 * POST /generateCoverImage
 */
export const generateCoverImage = onRequest(
  { secrets: [replicateApiToken], ...corsOptions },
  requireAuth(async (req, res, _userId) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const apiToken = replicateApiToken.value();
    if (!apiToken) {
      res.status(500).json({
        error:
          "Replicate API token not configured. Please set REPLICATE_API_TOKEN secret.",
      });
      return;
    }

    try {
      const { prompt } = req.body as GenerateCoverRequest;

      // Validate prompt
      if (!prompt?.trim()) {
        res.status(400).json({ error: "Prompt is required" });
        return;
      }

      if (prompt.length > 500) {
        res.status(400).json({ error: "Prompt must be 500 characters or less" });
        return;
      }

      const startTime = Date.now();

      // Initialize Replicate client
      const replicate = new Replicate({
        auth: apiToken,
      });

      // Run the model - following Replicate docs exactly
      const output = await replicate.run("black-forest-labs/flux-schnell", {
        input: {
          prompt: prompt.trim(),
          num_outputs: 1,
          aspect_ratio: "3:4", // Good for book covers
          output_format: "png",
          output_quality: 80,
        },
      });

      console.log("Replicate output:", output);

      // Handle different output types from Replicate
      if (!Array.isArray(output) || output.length === 0) {
        throw new Error(
          `Invalid output from model. Expected array, got: ${typeof output}`
        );
      }

      const firstItem = output[0];
      let imageBase64: string;

      // Check if it's a ReadableStream
      if (
        firstItem &&
        typeof firstItem === "object" &&
        "getReader" in firstItem &&
        typeof (firstItem as any).getReader === "function"
      ) {
        console.log("Processing ReadableStream...");
        // Handle ReadableStream
        imageBase64 = await readableStreamToBase64(
          firstItem as ReadableStream<Uint8Array>
        );
        console.log(
          `ReadableStream converted to base64. Length: ${imageBase64.length}`
        );
      }
      // Check if it has a url() method (FileOutput object)
      else if (
        firstItem &&
        typeof firstItem === "object" &&
        "url" in firstItem &&
        typeof (firstItem as any).url === "function"
      ) {
        console.log("Processing FileOutput with url() method...");
        // Access the file URL as documented: output[0].url()
        const imageUrl = await (firstItem as any).url();

        if (!imageUrl || typeof imageUrl !== "string") {
          throw new Error(`Failed to extract image URL. Got: ${typeof imageUrl}`);
        }

        console.log("Image URL extracted:", imageUrl.substring(0, 100) + "...");

        // Download image from URL and convert to base64
        imageBase64 = await imageUrlToBase64(imageUrl);
      }
      // Check if it's already a string URL
      else if (typeof firstItem === "string") {
        console.log("Processing string URL...");
        imageBase64 = await imageUrlToBase64(firstItem);
      }
      // Unknown format
      else {
        throw new Error(
          `Unsupported output format. Expected ReadableStream, FileOutput, or string URL. Got: ${typeof firstItem}, constructor: ${firstItem?.constructor?.name}`
        );
      }

      const generationTime = (Date.now() - startTime) / 1000;

      res.status(200).json({
        image: imageBase64,
        prompt: prompt.trim(),
        model: "flux-schnell",
        generation_time: Math.round(generationTime * 100) / 100,
      });
    } catch (error) {
      console.error("Error generating cover image:", error);

      const message =
        error instanceof Error ? error.message : "Internal server error";
      res.status(500).json({ error: message });
    }
  })
);
