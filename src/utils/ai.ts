import { api } from "../services/api";

const AI_ENDPOINT = process.env.EXPO_PUBLIC_AI_ENDPOINT;

type AIResponse = { reply: string };

export async function askAI(prompt: string): Promise<string> {
  // Via the Node backend (keeps the API key off the device)
  if (!AI_ENDPOINT || AI_ENDPOINT.startsWith(process.env.EXPO_PUBLIC_API_URL ?? "")) {
    const res = await api.post<AIResponse>("/api/ai", { prompt });
    return res.reply;
  }

  const res = await fetch(AI_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok) throw new Error(`AI request failed (${res.status})`);
  const data = (await res.json()) as AIResponse;
  return data.reply;
}