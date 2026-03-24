import { ChromaClient, Collection } from "chromadb";
import { v4 as uuidv4 } from "uuid";
import { getEmbedding } from "./ollama";

const chromaUrl = new URL(process.env.CHROMA_URL || "http://localhost:8000");

const chroma = new ChromaClient({
  host: chromaUrl.hostname,
  port: parseInt(chromaUrl.port) || 8000,
  ssl: chromaUrl.protocol === "https:",
  headers: {
    Authorization: `Bearer ${process.env.CHROMA_TOKEN || ""}`,
  },
});

const COLLECTION_NAME = "daily_logs";

let collection: Collection | null = null;

async function getCollection(): Promise<Collection> {
  if (!collection) {
    collection = await chroma.getOrCreateCollection({
      name: COLLECTION_NAME,
      metadata: { "hnsw:space": "cosine" },
      embeddingFunction: null,
    });
  }
  return collection;
}

// Reset cached collection (e.g., after ChromaDB restart)
export function resetCollection(): void {
  collection = null;
}

// Wrapper that retries once on stale collection error
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    // Reset and retry once — handles ChromaDB restart
    resetCollection();
    return await fn();
  }
}

export interface LogEntry {
  id: string;
  content: string;
  timestamp: string;
  type: "journal" | "chat" | "todo" | "summary" | "habit";
  metadata?: Record<string, string>;
}

export async function addLog(
  content: string,
  type: LogEntry["type"] = "chat",
  metadata: Record<string, string> = {},
  customTimestamp?: string
): Promise<string> {
  return withRetry(async () => {
    const col = await getCollection();
    const id = metadata.id || uuidv4();
    const timestamp = customTimestamp || new Date().toISOString();
    const date = timestamp.split("T")[0];
    const embedding = await getEmbedding(content);

    await col.add({
      ids: [id],
      embeddings: [embedding],
      documents: [content],
      metadatas: [{ type, timestamp, date, ...metadata }],
    });

    return id;
  });
}

export async function updateLog(
  id: string,
  metadata: Record<string, string>
): Promise<void> {
  return withRetry(async () => {
    const col = await getCollection();
    const existing = await col.get({ ids: [id] });
    if (existing.ids.length > 0) {
      const currentMeta = (existing.metadatas?.[0] || {}) as Record<string, string>;
      await col.update({
        ids: [id],
        metadatas: [{ ...currentMeta, ...metadata }],
      });
    }
  });
}

export async function deleteLog(id: string): Promise<void> {
  return withRetry(async () => {
    const col = await getCollection();
    await col.delete({ ids: [id] });
  });
}

export async function queryLogs(
  queryText: string,
  nResults: number = 5,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  where?: any
): Promise<{ documents: string[]; metadatas: Record<string, unknown>[] }> {
  return withRetry(async () => {
    const col = await getCollection();
    const queryEmbedding = await getEmbedding(queryText);

    const results = await col.query({
      queryEmbeddings: [queryEmbedding],
      nResults,
      where,
    });

    return {
      documents: (results.documents[0] || []).filter(Boolean) as string[],
      metadatas: (results.metadatas?.[0] || []) as Record<string, unknown>[],
    };
  });
}

export async function getLogsByType(
  type: string
): Promise<{ documents: string[]; metadatas: Record<string, unknown>[] }> {
  return withRetry(async () => {
    const col = await getCollection();

    try {
      const results = await col.get({
        where: { type },
      });

      return {
        documents: (results.documents || []).filter(Boolean) as string[],
        metadatas: (results.metadatas || []) as Record<string, unknown>[],
      };
    } catch {
      return { documents: [], metadatas: [] };
    }
  });
}

export async function getLogsByDate(
  date: string,
  type?: string
): Promise<{ documents: string[]; metadatas: Record<string, unknown>[] }> {
  return withRetry(async () => {
    const col = await getCollection();

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = type ? { $and: [{ date }, { type }] } : { date };
      const results = await col.get({ where });

      return {
        documents: (results.documents || []).filter(Boolean) as string[],
        metadatas: (results.metadatas || []) as Record<string, unknown>[],
      };
    } catch {
      return { documents: [], metadatas: [] };
    }
  });
}

export async function getTodayLogs(): Promise<{
  documents: string[];
  metadatas: Record<string, unknown>[];
}> {
  const today = new Date().toISOString().split("T")[0];
  return getLogsByDate(today);
}
