import { api } from "../services/api";

type AIResponse = { reply: string };

// Always goes through the Node backend (server/server.js), which keeps the
// Gemini API key off the device and checks the user's Supabase token.
export async function askAI(prompt: string): Promise<string> {
  const res = await api.post<AIResponse>("/api/ai", { prompt });
  return res.reply;
}
