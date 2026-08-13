import { createHash } from "crypto";
import { z } from "zod";

export const STORY_LIMITS = {
  requestBytes: 8 * 1024 * 1024,
  documentBytes: 900 * 1024,
  aggregateDocuments: 450,
  titleChars: 200,
  descriptionChars: 2_000,
  entityTextChars: 10_000,
  tags: 10,
  tagChars: 40,
  categoryChars: 60,
  urlChars: 2_048,
  chapterContentChars: 100_000,
  chapterWords: 5_000,
  chapters: 50,
  storiesPerUser: 100,
  nestedItems: 100,
} as const;

const keySchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, "must contain only letters, numbers, _ or -");
const titleSchema = z.string().trim().min(1).max(STORY_LIMITS.titleChars);
const optionalText = z.string().trim().max(STORY_LIMITS.entityTextChars).optional();
const optionalUrl = z
  .string()
  .trim()
  .max(STORY_LIMITS.urlChars)
  .refine((value) => value === "" || safeHttpsUrl(value), "must be an HTTPS URL")
  .optional();

const eventRefSchema = z.strictObject({
  plotKey: keySchema,
  eventKey: keySchema,
});

const dependencySchema = eventRefSchema.extend({
  relationshipType: z.enum(["causes", "requires", "blocks", "enables", "contradicts"]),
  description: z.string().trim().max(2_000).optional(),
});

const timeConstraintSchema = z
  .strictObject({
    type: z.enum(["absolute", "relative"]),
    absoluteDate: z.string().trim().max(40).optional(),
    relativeTo: eventRefSchema.optional(),
    relativePosition: z.enum(["before", "after", "same_time"]).optional(),
    timeGap: z.string().trim().max(200).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.type === "absolute" && !value.absoluteDate) {
      ctx.addIssue({ code: "custom", message: "absoluteDate is required for absolute time constraints" });
    }
    if (value.type === "relative" && (!value.relativeTo || !value.relativePosition)) {
      ctx.addIssue({ code: "custom", message: "relativeTo and relativePosition are required for relative constraints" });
    }
  });

const eventSchema = z.strictObject({
  key: keySchema,
  name: titleSchema,
  content: z.string().trim().max(STORY_LIMITS.entityTextChars),
  characterKeys: z.array(keySchema).max(STORY_LIMITS.nestedItems).default([]),
  locationKey: keySchema.nullable().default(null),
  dependencies: z.array(dependencySchema).max(STORY_LIMITS.nestedItems).default([]),
  tensionLevel: z.number().int().min(1).max(10).default(5),
  pacing: z.enum(["slow", "moderate", "fast"]).default("moderate"),
  storyBeat: z
    .enum([
      "exposition",
      "inciting_incident",
      "rising_action",
      "midpoint",
      "climax",
      "falling_action",
      "resolution",
    ])
    .default("rising_action"),
  emotionalTone: z.string().trim().max(500).optional(),
  timeConstraint: timeConstraintSchema.optional(),
  chapterNumber: z.number().int().min(1).max(STORY_LIMITS.chapters).optional(),
  notes: optionalText,
});

const chapterSchema = z
  .strictObject({
    key: keySchema,
    title: titleSchema,
    content: z.string().max(STORY_LIMITS.chapterContentChars),
  })
  .superRefine((value, ctx) => {
    const words = countWords(value.content);
    if (words > STORY_LIMITS.chapterWords) {
      ctx.addIssue({
        code: "custom",
        path: ["content"],
        message: `must contain at most ${STORY_LIMITS.chapterWords} words`,
      });
    }
  });

const characterSchema = z.strictObject({
  key: keySchema,
  name: titleSchema,
  age: z.number().finite().nonnegative().max(1_000_000).optional(),
  artUrl: optionalUrl,
  soul: optionalText,
  personality: optionalText,
  voice: optionalText,
  backstory: optionalText,
  affiliations: optionalText,
  notes: optionalText,
  relationships: z
    .array(
      z.strictObject({
        characterKey: keySchema,
        type: z.enum(["ally", "rival", "mentor", "love interest", "family", "neutral"]),
        description: z.string().trim().max(2_000).optional(),
      }),
    )
    .max(STORY_LIMITS.nestedItems)
    .default([]),
});

const placeSchema = z.strictObject({
  key: keySchema,
  name: titleSchema,
  imageUrl: optionalUrl,
  description: optionalText,
  atmosphere: optionalText,
  geography: optionalText,
  history: optionalText,
  significance: optionalText,
  notes: optionalText,
});

const plotSchema = z.strictObject({
  key: keySchema,
  name: titleSchema,
  description: z.string().trim().max(STORY_LIMITS.entityTextChars).default(""),
  events: z.array(eventSchema).max(STORY_LIMITS.nestedItems).default([]),
});

export const createStoryByAdminSchema = z
  .strictObject({
    idempotencyKey: z.string().trim().min(1).max(128),
    ownerUid: z.string().trim().min(1).max(128),
    story: z.strictObject({
      title: titleSchema,
      description: z.string().trim().max(STORY_LIMITS.descriptionChars),
      isPublished: z.boolean().default(false),
      category: z.string().trim().max(STORY_LIMITS.categoryChars).default(""),
      tags: z
        .array(z.string().trim().min(1).max(STORY_LIMITS.tagChars))
        .max(STORY_LIMITS.tags)
        .default([])
        .transform((tags) => [...new Set(tags)]),
      targetAudience: z.string().trim().max(200).default(""),
      language: z.string().trim().max(100).default(""),
      copyright: z.string().trim().max(500).default(""),
      coverImageUrl: optionalUrl.default(""),
      thumbnailUrl: optionalUrl.default(""),
    }),
    chapters: z.array(chapterSchema).min(1).max(STORY_LIMITS.chapters),
    characters: z.array(characterSchema).max(STORY_LIMITS.nestedItems).default([]),
    places: z.array(placeSchema).max(STORY_LIMITS.nestedItems).default([]),
    plots: z.array(plotSchema).max(STORY_LIMITS.nestedItems).default([]),
  })
  .superRefine((value, ctx) => {
    checkUniqueKeys(value.chapters, ["chapters"], ctx);
    checkUniqueKeys(value.characters, ["characters"], ctx);
    checkUniqueKeys(value.places, ["places"], ctx);
    checkUniqueKeys(value.plots, ["plots"], ctx);
    value.plots.forEach((plot, index) => checkUniqueKeys(plot.events, ["plots", index, "events"], ctx));

    const childDocuments = value.chapters.length + value.characters.length + value.places.length + value.plots.length;
    if (childDocuments > STORY_LIMITS.aggregateDocuments) {
      ctx.addIssue({ code: "custom", message: `aggregate may contain at most ${STORY_LIMITS.aggregateDocuments} child documents` });
    }
  });

export type CreateStoryByAdminInput = z.infer<typeof createStoryByAdminSchema>;

function checkUniqueKeys(
  values: Array<{ key: string }>,
  path: Array<string | number>,
  ctx: z.RefinementCtx,
): void {
  const seen = new Set<string>();
  values.forEach((value, index) => {
    if (seen.has(value.key)) {
      ctx.addIssue({ code: "custom", path: [...path, index, "key"], message: `duplicate key: ${value.key}` });
    }
    seen.add(value.key);
  });
}

function safeHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
}

export function requestHash(input: CreateStoryByAdminInput): string {
  return createHash("sha256").update(JSON.stringify(canonicalize(input))).digest("hex");
}

export function idempotencyDocumentId(ownerUid: string, key: string): string {
  return createHash("sha256").update(`${ownerUid}:${key}`).digest("hex");
}
