import { api } from "../services/api";

type AIResponse = { reply: string };
type AIOptions = { system?: string }; // instructions: role, tone, rules

// Always goes through the Node backend (server/server.js), which keeps the
// Gemini API key off the device and checks the user's Supabase token.
export async function askAI(prompt: string, options: AIOptions = {}): Promise<string> {
  const res = await api.post<AIResponse>("/api/ai", { prompt, system: options.system });
  return res.reply;
}

/**
 * Ask for structured data instead of chat text. Describe the shape you want in the prompt:
 *
 *   type Idea = { title: string; why: string };
 *   const { ideas } = await askAIJson<{ ideas: Idea[] }>(
 *     'Give 3 study tips as JSON: {"ideas":[{"title":string,"why":string}]}'
 *   );
 */
export async function askAIJson<T>(prompt: string, options: AIOptions = {}): Promise<T> {
  const res = await api.post<AIResponse>("/api/ai", { prompt, system: options.system, json: true });
  try {
    return JSON.parse(res.reply) as T;
  } catch {
    throw new Error("The AI did not return valid JSON. Try rephrasing the prompt.");
  }
}
