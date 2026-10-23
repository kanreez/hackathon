const path = require("path");
// Load server/.env no matter which folder the server is started from
require("dotenv").config({ path: path.join(__dirname, ".env") });
const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

const missing = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"].filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing ${missing.join(", ")}. Copy server/.env.example to server/.env and fill it in.`);
  process.exit(1);
}
if (!process.env.OPENAI_API_KEY && !process.env.GEMINI_API_KEY) {
  console.warn("No AI key set: add OPENAI_API_KEY or GEMINI_API_KEY to server/.env for /api/ai.");
}

const app = express();
const PORT = process.env.PORT || 3000;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

app.use(cors());
app.use(express.json());

// Verifies the Supabase access token sent by the app
async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Missing token" });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return res.status(401).json({ error: "Invalid token" });

  req.user = data.user;
  next();
}

app.get("/", (_req, res) => res.json({ status: "ok" }));

app.get("/api/me", requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", req.user.id)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ user: { id: req.user.id, email: req.user.email }, profile: data });
});

// ==========================================
// AI endpoint: OpenAI (ChatGPT) or Google Gemini
// ==========================================
// Pick the provider in server/.env:  AI_PROVIDER=openai  or  AI_PROVIDER=gemini
// Body: { prompt, system?, json? }
//   system: optional instructions (role, tone, rules)
//   json:   true -> the model must answer with valid JSON (reply is still a string; parse it in the app)
const AI_PROVIDER = (process.env.AI_PROVIDER || (process.env.OPENAI_API_KEY ? "openai" : "gemini")).toLowerCase();
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
// Optional second Gemini model, tried when the main one is overloaded
const GEMINI_FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL;
console.log(`AI provider: ${AI_PROVIDER} (${AI_PROVIDER === "openai" ? OPENAI_MODEL : GEMINI_MODEL})`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isTemporary = (status) => status === 503 || status === 429 || status === 502;

// Calls fn up to 3 times while the provider says it's busy
async function withRetries(attempts, fn) {
  let result;
  for (const { arg, wait } of attempts) {
    if (wait) await sleep(wait);
    result = await fn(arg);
    if (!isTemporary(result.status)) break;
    console.warn(`AI ${arg} returned ${result.status}, retrying...`);
  }
  return result;
}

async function askOpenAI({ prompt, system, json }) {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is missing in server/.env");
  const messages = [
    ...(system || json
      ? [{ role: "system", content: [system, json ? "Respond only with valid JSON." : ""].filter(Boolean).join("\n") }]
      : []),
    { role: "user", content: prompt },
  ];
  const r = await withRetries(
    [{ arg: OPENAI_MODEL, wait: 0 }, { arg: OPENAI_MODEL, wait: 1000 }, { arg: OPENAI_MODEL, wait: 2500 }],
    async (model) => {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({
          model,
          messages,
          ...(json ? { response_format: { type: "json_object" } } : {}),
        }),
      });
      return { status: response.status, ok: response.ok, data: await response.json() };
    }
  );
  if (!r.ok) return { status: r.status, error: r.data.error?.message || "AI request failed" };
  return { reply: r.data.choices?.[0]?.message?.content || "" };
}

async function askGemini({ prompt, system, json }) {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is missing in server/.env");
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    ...(json ? { generationConfig: { responseMimeType: "application/json" } } : {}),
  };
  const r = await withRetries(
    [
      { arg: GEMINI_MODEL, wait: 0 },
      { arg: GEMINI_MODEL, wait: 1000 },
      { arg: GEMINI_MODEL, wait: 2500 },
      ...(GEMINI_FALLBACK_MODEL ? [{ arg: GEMINI_FALLBACK_MODEL, wait: 0 }] : []),
    ],
    async (model) => {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
      );
      return { status: response.status, ok: response.ok, data: await response.json() };
    }
  );
  if (!r.ok) return { status: r.status, error: r.data.error?.message || "AI request failed" };
  return { reply: r.data.candidates?.[0]?.content?.parts?.[0]?.text || "" };
}

app.post("/api/ai", requireAuth, async (req, res) => {
  const { prompt, system, json } = req.body;
  if (!prompt) return res.status(400).json({ error: "Missing prompt" });

  try {
    const result = AI_PROVIDER === "openai"
      ? await askOpenAI({ prompt, system, json })
      : await askGemini({ prompt, system, json });
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json({ reply: result.reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));