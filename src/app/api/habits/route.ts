import { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { addLog, getLogsByType, deleteLog } from "@/lib/memory";

export async function GET() {
  try {
    const logs = await getLogsByType("habit");
    const checkins = logs.documents.map((doc, i) => {
      const meta = logs.metadatas[i] || {};
      return {
        id: meta.id as string,
        category: (meta.category as string) || "",
        entry: doc,
        date: (meta.date as string) || new Date().toISOString().split("T")[0],
      };
    });

    // Sort newest first
    checkins.sort((a, b) => b.date.localeCompare(a.date));

    return Response.json({ checkins });
  } catch {
    return Response.json({ checkins: [] });
  }
}

export async function POST(req: NextRequest) {
  const { category, entry, date } = await req.json();

  if (!category || typeof category !== "string") {
    return Response.json({ error: "Category is required" }, { status: 400 });
  }
  if (!entry || typeof entry !== "string") {
    return Response.json({ error: "Entry is required" }, { status: 400 });
  }

  const id = uuidv4();
  const checkinDate = date || new Date().toISOString().split("T")[0];
  const timestamp = `${checkinDate}T${new Date().toISOString().split("T")[1]}`;

  // Prefix document with category for better semantic search
  const document = `${category}: ${entry.trim()}`;

  try {
    await addLog(document, "habit", {
      id,
      category,
    }, timestamp);

    return Response.json({
      checkin: { id, category, entry: document, date: checkinDate },
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Failed to save habit";
    return Response.json({ error: errMsg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return Response.json({ error: "ID is required" }, { status: 400 });
  }

  try {
    await deleteLog(id);
    return Response.json({ success: true });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Failed to delete habit";
    return Response.json({ error: errMsg }, { status: 500 });
  }
}
