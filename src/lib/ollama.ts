import { Ollama } from "ollama";

const ollama = new Ollama({ host: "http://localhost:11434" });

export const MODELS = {
  chat: "llama3.2",
  embedding: "nomic-embed-text",
} as const;

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function chat(
  messages: ChatMessage[],
  model: string = MODELS.chat
): Promise<string> {
  const response = await ollama.chat({ model, messages });
  return response.message.content;
}

export async function chatStream(
  messages: ChatMessage[],
  model: string = MODELS.chat
) {
  return ollama.chat({ model, messages, stream: true });
}

export async function getEmbedding(text: string): Promise<number[]> {
  const response = await ollama.embed({
    model: MODELS.embedding,
    input: text,
  });
  return response.embeddings[0];
}

export async function listModels() {
  const response = await ollama.list();
  return response.models;
}

export default ollama;
