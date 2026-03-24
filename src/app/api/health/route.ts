import { listModels } from "@/lib/ollama";

export async function GET() {
  const status = {
    llm: false,
    database: false,
    models: [] as string[],
  };

  try {
    const models = await listModels();
    status.llm = true;
    status.models = models.map((m) => m.name);
  } catch {
    // LLM not running
  }

  try {
    const chromaUrl = process.env.CHROMA_URL || "http://localhost:8000";
    const res = await fetch(`${chromaUrl}/api/v2/heartbeat`);
    status.database = res.ok;
  } catch {
    // ChromaDB not running
  }

  return Response.json(status);
}
