import { listModels } from "@/lib/ollama";

export async function GET() {
  const status = {
    ollama: false,
    chromadb: false,
    models: [] as string[],
  };

  try {
    const models = await listModels();
    status.ollama = true;
    status.models = models.map((m) => m.name);
  } catch {
    // Ollama not running
  }

  try {
    const res = await fetch("http://localhost:8000/api/v2/heartbeat");
    status.chromadb = res.ok;
  } catch {
    // ChromaDB not running
  }

  return Response.json(status);
}
