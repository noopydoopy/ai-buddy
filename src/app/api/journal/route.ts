import { NextRequest } from "next/server";
import { addLog, getLogsByType } from "@/lib/memory";
import { extractAndSaveTodos } from "@/lib/extract-todos";
import { v4 as uuidv4 } from "uuid";

export async function GET() {
  try {
    const logs = await getLogsByType("journal");
    const entries = logs.documents.map((doc, i) => {
      const meta = logs.metadatas[i] || {};
      return {
        id: (meta.id as string) || uuidv4(),
        content: doc,
        date: (meta.timestamp as string) || new Date().toISOString(),
        mood: (meta.mood as string) || undefined,
      };
    });

    // Sort newest first
    entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return Response.json({ entries });
  } catch {
    return Response.json({ entries: [] });
  }
}

export async function POST(req: NextRequest) {
  const { content, mood } = await req.json();

  if (!content || typeof content !== "string") {
    return Response.json({ error: "Content is required" }, { status: 400 });
  }

  const id = uuidv4();
  const timestamp = new Date().toISOString();

  try {
    await addLog(content, "journal", {
      mood: mood || "",
      id,
    });

    // Extract todos from journal content (best-effort, non-blocking)
    extractAndSaveTodos(content).catch(() => {});

    return Response.json({
      entry: { id, content, date: timestamp, mood: mood || undefined },
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Failed to save journal";
    return Response.json({ error: errMsg }, { status: 500 });
  }
}
