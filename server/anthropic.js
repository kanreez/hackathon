// Claude (Anthropic) provider for the plain-language garage search (first in the fallback chain)
const Anthropic = require("@anthropic-ai/sdk");

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";

// Converts the Gemini-style schema (uppercase types, nullable) into JSON Schema for Claude structured outputs
function toJsonSchema(node) {
  const type = node.type.toLowerCase();
  let out = { type };
  if (node.enum) out.enum = node.enum;
  if (type === "object") {
    out.properties = Object.fromEntries(Object.entries(node.properties).map(([k, v]) => [k, toJsonSchema(v)]));
    out.required = node.required || [];
    out.additionalProperties = false;
  }
  if (type === "array") out.items = toJsonSchema(node.items);
  // Objects and enums can't take a ["type", "null"] union, so they become anyOf
  if (node.nullable) out = type === "object" || out.enum ? { anyOf: [out, { type: "null" }] } : { ...out, type: [type, "null"] };
  return out;
}

const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;

// timeoutMs: give up quickly so the server can fall back to the next provider
async function askAnthropic({ prompt, system, json, image, schema, maxTokens = 1024, timeoutMs = 15000 }) {
  if (!anthropic) throw new Error("ANTHROPIC_API_KEY is missing in server/.env");
  const content = [
    ...(image ? [{ type: "image", source: { type: "base64", media_type: image.mimeType, data: image.data } }] : []),
    { type: "text", text: prompt },
  ];
  try {
    const response = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      ...(system || (json && !schema)
        ? { system: [system, json && !schema ? "Respond only with valid JSON." : ""].filter(Boolean).join(" ") }
        : {}),
      messages: [{ role: "user", content }],
      ...(schema ? { output_config: { format: { type: "json_schema", schema: toJsonSchema(schema) } } } : {}),
    }, { timeout: timeoutMs, maxRetries: 1 });
    // A refusal is an answer ("not something to search for"), not a failure to fall back from
    if (response.stop_reason === "refusal") return { refused: true };
    if (response.stop_reason === "max_tokens") return { status: 502, error: "Answer was cut off" };
    const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    return { reply: text };
  } catch (err) {
    if (err instanceof Anthropic.APIError) return { status: err.status || 502, error: err.message };
    throw err;
  }
}

module.exports = { askAnthropic, toJsonSchema, ANTHROPIC_MODEL };
