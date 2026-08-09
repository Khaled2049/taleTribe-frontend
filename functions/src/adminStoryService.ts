import { randomUUID } from "crypto";
import * as admin from "firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import {
  CreateStoryByAdminInput,
  STORY_LIMITS,
  countWords,
  idempotencyDocumentId,
  requestHash,
} from "./adminStorySchemas";

export class AdminStoryError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code: string,
  ) {
    super(message);
  }
}

export interface StoryImportResponse {
  storyId: string;
  title: string;
  chapterCount: number;
  isPublished: boolean;
  ids: {
    chapters: Record<string, string>;
    characters: Record<string, string>;
    places: Record<string, string>;
    plots: Record<string, string>;
    events: Record<string, string>;
  };
  indexing: "triggered_async";
  idempotentReplay: boolean;
}

export interface AllocatedIds {
  storyId: string;
  chapters: Record<string, string>;
  characters: Record<string, string>;
  places: Record<string, string>;
  plots: Record<string, string>;
  events: Record<string, string>;
}

interface MaterializedAggregate {
  story: Record<string, unknown>;
  chapters: Array<{ id: string; data: Record<string, unknown> }>;
  characters: Array<{ id: string; data: Record<string, unknown> }>;
  places: Array<{ id: string; data: Record<string, unknown> }>;
  plots: Array<{ id: string; data: Record<string, unknown> }>;
}

function eventMapKey(plotKey: string, eventKey: string): string {
  return `${plotKey}:${eventKey}`;
}

function allocateIds(
  db: admin.firestore.Firestore,
  input: CreateStoryByAdminInput,
): AllocatedIds {
  const storyId = db.collection("stories").doc().id;
  const ids: AllocatedIds = {
    storyId,
    chapters: {},
    characters: {},
    places: {},
    plots: {},
    events: {},
  };

  input.chapters.forEach((chapter) => {
    ids.chapters[chapter.key] = db.collection("stories").doc().id;
  });
  input.characters.forEach((character) => {
    ids.characters[character.key] = db.collection("stories").doc().id;
  });
  input.places.forEach((place) => {
    ids.places[place.key] = db.collection("stories").doc().id;
  });
  input.plots.forEach((plot) => {
    ids.plots[plot.key] = db.collection("stories").doc().id;
    plot.events.forEach((event) => {
      ids.events[eventMapKey(plot.key, event.key)] = randomUUID();
    });
  });
  return ids;
}

function requiredId(map: Record<string, string>, key: string, field: string): string {
  const ownsKey = Object.prototype.hasOwnProperty.call(map, key);
  const id = ownsKey ? map[key] : undefined;
  if (typeof id !== "string" || !id) {
    throw new AdminStoryError(422, `Unresolved ${field}: ${key}`, "unresolved_reference");
  }
  return id;
}

export function materializeAggregate(
  input: CreateStoryByAdminInput,
  ids: AllocatedIds,
  author: string,
  now: Timestamp,
): MaterializedAggregate {
  const eventDependents = new Map<string, Array<Record<string, unknown>>>();

  for (const plot of input.plots) {
    for (const event of plot.events) {
      const sourceKey = eventMapKey(plot.key, event.key);
      const sourceId = requiredId(ids.events, sourceKey, "event");
      const sourcePlotId = requiredId(ids.plots, plot.key, "plot");
      for (const dependency of event.dependencies) {
        const targetKey = eventMapKey(dependency.plotKey, dependency.eventKey);
        if (sourceKey === targetKey) {
          throw new AdminStoryError(422, `Event ${sourceKey} cannot depend on itself`, "self_dependency");
        }
        requiredId(ids.events, targetKey, "dependency event");
        requiredId(ids.plots, dependency.plotKey, "dependency plot");
        const dependents = eventDependents.get(targetKey) ?? [];
        dependents.push(compact({
          eventId: sourceId,
          plotLineId: sourcePlotId,
          relationshipType: dependency.relationshipType,
          description: dependency.description,
        }));
        eventDependents.set(targetKey, dependents);
      }
    }
  }

  const chapters = input.chapters.map((chapter, index) => ({
    id: ids.chapters[chapter.key],
    data: {
      id: ids.chapters[chapter.key],
      title: chapter.title,
      content: chapter.content,
      order: index,
      chapterNumber: index + 1,
      wordCount: countWords(chapter.content),
      userId: input.ownerUid,
      createdAt: now,
      updatedAt: now,
    },
  }));

  const characters = input.characters.map((character) => ({
    id: ids.characters[character.key],
    data: compact({
      id: ids.characters[character.key],
      name: character.name,
      age: character.age,
      artUrl: character.artUrl,
      soul: character.soul,
      personality: character.personality,
      voice: character.voice,
      backstory: character.backstory,
      affiliations: character.affiliations,
      notes: character.notes,
      relationships: character.relationships.map((relationship) => {
        const target = input.characters.find((candidate) => candidate.key === relationship.characterKey);
        if (!target) {
          throw new AdminStoryError(
            422,
            `Unresolved relationship character: ${relationship.characterKey}`,
            "unresolved_reference",
          );
        }
        return compact({
          characterId: requiredId(ids.characters, relationship.characterKey, "relationship character"),
          name: target.name,
          type: relationship.type,
          description: relationship.description,
        });
      }),
      userId: input.ownerUid,
      createdAt: now,
      updatedAt: now,
    }),
  }));

  const places = input.places.map((place) => ({
    id: ids.places[place.key],
    data: compact({
      id: ids.places[place.key],
      name: place.name,
      imageUrl: place.imageUrl,
      description: place.description,
      atmosphere: place.atmosphere,
      geography: place.geography,
      history: place.history,
      significance: place.significance,
      notes: place.notes,
      userId: input.ownerUid,
      storyId: ids.storyId,
      createdAt: now,
      updatedAt: now,
    }),
  }));

  const nowIso = now.toDate().toISOString();
  const plots = input.plots.map((plot) => {
    const plotId = ids.plots[plot.key];
    const events = plot.events.map((event, orderIndex) => {
      const compositeKey = eventMapKey(plot.key, event.key);
      const eventId = requiredId(ids.events, compositeKey, "event");
      if (event.chapterNumber && event.chapterNumber > input.chapters.length) {
        throw new AdminStoryError(
          422,
          `Event ${compositeKey} references missing chapter ${event.chapterNumber}`,
          "unresolved_reference",
        );
      }
      const dependencies = event.dependencies.map((dependency) => compact({
        eventId: requiredId(ids.events, eventMapKey(dependency.plotKey, dependency.eventKey), "dependency event"),
        plotLineId: requiredId(ids.plots, dependency.plotKey, "dependency plot"),
        relationshipType: dependency.relationshipType,
        description: dependency.description,
      }));
      const timeConstraint = event.timeConstraint ? compact({
        type: event.timeConstraint.type,
        absoluteDate: event.timeConstraint.absoluteDate,
        relativeToEventId: event.timeConstraint.relativeTo ? requiredId(
          ids.events,
          eventMapKey(event.timeConstraint.relativeTo.plotKey, event.timeConstraint.relativeTo.eventKey),
          "relative event",
        ) : undefined,
        relativePosition: event.timeConstraint.relativePosition,
        timeGap: event.timeConstraint.timeGap,
      }) : undefined;

      return compact({
        id: eventId,
        name: event.name,
        content: event.content,
        userId: input.ownerUid,
        characterIds: event.characterKeys.map((key) => requiredId(ids.characters, key, "event character")),
        locationId: event.locationKey ? requiredId(ids.places, event.locationKey, "event location") : null,
        dependencies,
        dependents: eventDependents.get(compositeKey) ?? [],
        tensionLevel: event.tensionLevel,
        pacing: event.pacing,
        storyBeat: event.storyBeat,
        emotionalTone: event.emotionalTone,
        timeConstraint,
        orderIndex,
        chapterNumber: event.chapterNumber,
        notes: event.notes,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    });
    return {
      id: plotId,
      data: compact({
        id: plotId,
        name: plot.name,
        description: plot.description,
        events,
        createdAt: now,
        updatedAt: now,
      }),
    };
  });

  const story = compact({
    id: ids.storyId,
    title: input.story.title,
    description: input.story.description,
    userId: input.ownerUid,
    author,
    isPublished: input.story.isPublished,
    createdAt: now,
    updatedAt: now,
    chapterCount: chapters.length,
    nextChapterOrder: chapters.length,
    chapterIndex: chapters.map((chapter, index) => ({
      title: chapter.data.title,
      order: index,
      chapterNumber: index + 1,
    })),
    views: 0,
    likes: 0,
    category: input.story.category,
    tags: input.story.tags,
    targetAudience: input.story.targetAudience,
    language: input.story.language,
    copyright: input.story.copyright,
    coverImageUrl: input.story.coverImageUrl,
    thumbnailUrl: input.story.thumbnailUrl,
  });

  const documents = [
    story,
    ...chapters.map((item) => item.data),
    ...characters.map((item) => item.data),
    ...places.map((item) => item.data),
    ...plots.map((item) => item.data),
  ];
  for (const document of documents) {
    const size = Buffer.byteLength(JSON.stringify(document), "utf8");
    if (size > STORY_LIMITS.documentBytes) {
      throw new AdminStoryError(
        413,
        "A generated Firestore document exceeds the safe size limit",
        "document_too_large",
      );
    }
  }

  return { story, chapters, characters, places, plots };
}

/** Create an entire story aggregate atomically, or replay an identical import. */
export async function createStoryAggregate(
  db: admin.firestore.Firestore,
  input: CreateStoryByAdminInput,
): Promise<{ created: boolean; response: StoryImportResponse }> {
  try {
    await admin.auth().getUser(input.ownerUid);
  } catch (error) {
    if ((error as { code?: string }).code === "auth/user-not-found") {
      throw new AdminStoryError(404, "Story owner does not exist", "owner_not_found");
    }
    throw error;
  }

  const ids = allocateIds(db, input);
  const importRef = db
    .collection("adminStoryImports")
    .doc(idempotencyDocumentId(input.ownerUid, input.idempotencyKey));
  const hash = requestHash(input);
  const now = Timestamp.now();

  return db.runTransaction(async (transaction) => {
    const prior = await transaction.get(importRef);
    if (prior.exists) {
      const data = prior.data() ?? {};
      if (data.requestHash !== hash) {
        throw new AdminStoryError(
          409,
          "This idempotency key was already used with a different payload",
          "idempotency_conflict",
        );
      }
      return {
        created: false,
        response: { ...(data.response as StoryImportResponse), idempotentReplay: true },
      };
    }

    const userRef = db.collection("users").doc(input.ownerUid);
    const userSnapshot = await transaction.get(userRef);
    const username = userSnapshot.data()?.username;
    if (!userSnapshot.exists || typeof username !== "string" || !username.trim()) {
      throw new AdminStoryError(404, "Story owner profile does not exist", "owner_profile_not_found");
    }

    const storiesSnapshot = await transaction.get(
      db.collection("stories").where("userId", "==", input.ownerUid).limit(STORY_LIMITS.storiesPerUser),
    );
    if (storiesSnapshot.size >= STORY_LIMITS.storiesPerUser) {
      throw new AdminStoryError(409, "Story owner has reached the story limit", "story_limit");
    }

    const aggregate = materializeAggregate(input, ids, username.trim(), now);
    const storyRef = db.collection("stories").doc(ids.storyId);
    transaction.create(storyRef, aggregate.story);
    aggregate.chapters.forEach(({ id, data }) => transaction.create(storyRef.collection("chapters").doc(id), data));
    aggregate.characters.forEach(({ id, data }) => transaction.create(storyRef.collection("characters").doc(id), data));
    aggregate.places.forEach(({ id, data }) => transaction.create(storyRef.collection("places").doc(id), data));
    aggregate.plots.forEach(({ id, data }) => transaction.create(storyRef.collection("plots").doc(id), data));

    const response: StoryImportResponse = {
      storyId: ids.storyId,
      title: input.story.title,
      chapterCount: input.chapters.length,
      isPublished: input.story.isPublished,
      ids: {
        chapters: ids.chapters,
        characters: ids.characters,
        places: ids.places,
        plots: ids.plots,
        events: ids.events,
      },
      indexing: "triggered_async",
      idempotentReplay: false,
    };
    transaction.create(importRef, {
      ownerUid: input.ownerUid,
      storyId: ids.storyId,
      requestHash: hash,
      response,
      createdAt: now,
    });
    return { created: true, response };
  });
}

function compact<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => compact(item)) as T;
  }
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, child]) => child !== undefined)
        .map(([key, child]) => [key, compact(child)]),
    ) as T;
  }
  return value;
}
