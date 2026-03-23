import { ChromaClient, Collection } from "chromadb";
import { v4 as uuidv4 } from "uuid";
import { getEmbedding } from "./ollama";

const chroma = new ChromaClient({
  path: "http://localhost:8000",
  auth: {
    provider: "token",
    credentials: process.env.CHROMA_TOKEN || "",
  },
});

const COLLECTION_NAME = "daily_logs";

let collection: Collection | null = null;

async function getCollection(): Promise<Collection> {
  if (!collection) {
    collection = await chroma.getOrCreateCollection({
      name: COLLECTION_NAME,
      metadata: { "hnsw:space": "cosine" },
    });
  }
  return collection;
}

export interface LogEntry {
  id: string;
  content: string;
  timestamp: string;
  type: "journal" | "chat" | "todo" | "summary";
  metadata?: Record<string, string>;
}

export async function addLog(
  content: string,
  type: LogEntry["type"] = "chat",
  metadata: Record<string, string> = {},
  customTimestamp?: string
): Promise<string> {
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
}

export async function updateLog(
  id: string,
  metadata: Record<string, string>
): Promise<void> {
  const col = await getCollection();
  const existing = await col.get({ ids: [id] });
  if (existing.ids.length > 0) {
    const currentMeta = (existing.metadatas?.[0] || {}) as Record<string, string>;
    await col.update({
      ids: [id],
      metadatas: [{ ...currentMeta, ...metadata }],
    });
  }
}

export async function queryLogs(
  queryText: string,
  nResults: number = 5,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  where?: any
): Promise<{ documents: string[]; metadatas: Record<string, unknown>[] }> {
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
}

export async function getLogsByType(
  type: string
): Promise<{ documents: string[]; metadatas: Record<string, unknown>[] }> {
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
}

export async function getLogsByDate(
  date: string,
  type?: string
): Promise<{ documents: string[]; metadatas: Record<string, unknown>[] }> {
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
}

export async function getTodayLogs(): Promise<{
  documents: string[];
  metadatas: Record<string, unknown>[];
}> {
  const today = new Date().toISOString().split("T")[0];
  return getLogsByDate(today);
}
