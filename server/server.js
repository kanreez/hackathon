const path = require("path");
// Load server/.env no matter which folder the server is started from
require("dotenv").config({ path: path.join(__dirname, ".env") });
const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");
const { askAnthropic } = require("./anthropic");
const triage = require("./triage");
const manager = require("./manager");
const { SPECIALISTS, nearestStores } = require("./data");
const { createRepo } = require("./repo");

const missing = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"].filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing ${missing.join(", ")}. Copy server/.env.example to server/.env and fill it in.`);
  process.exit(1);
}
if (!process.env.OPENAI_API_KEY && !process.env.GEMINI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
  console.warn("No AI key set: add ANTHROPIC_API_KEY, OPENAI_API_KEY or GEMINI_API_KEY to server/.env for /api/ai.");
}

const app = express();
const PORT = process.env.PORT || 3000;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const repo = createRepo(supabase);

app.use(cors());
// Photos arrive as base64, so allow bigger bodies than the 100kb default
app.use(express.json({ limit: "15mb" }));

// Verifies the Supabase access token sent by the app
async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Missing token" });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return res.status(401).json({ error: "Invalid token" });

  req.user = data.user;
  next();
}

// Use after requireAuth on домоуправител-only routes
async function requireManager(req, res, next) {
  req.role = await repo.getRole(req.user.id);
  if (req.role !== "manager") return res.status(403).json({ error: "Only the building manager can do this" });
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
  const role = await repo.getRole(req.user.id);
  res.json({
    user: { id: req.user.id, email: req.user.email },
    profile: data,
    role,
    building_id: repo.BUILDING_ID,
    role_switch: DEMO_ROLE_SWITCH,
  });
});

// Demo-only role switch (resident <-> manager). Turn off with DEMO_ROLE_SWITCH=false.
const DEMO_ROLE_SWITCH = process.env.DEMO_ROLE_SWITCH !== "false";
app.put("/api/me/role", requireAuth, async (req, res) => {
  if (!DEMO_ROLE_SWITCH) return res.status(403).json({ error: "Role switch is disabled" });
  const { role } = req.body;
  if (!["resident", "manager"].includes(role)) return res.status(400).json({ error: "role must be resident or manager" });
  res.json({ role: await repo.setRole(req.user.id, role) });
});

// ==========================================
// AI endpoint: Anthropic (Claude), OpenAI (ChatGPT) or Google Gemini
// ==========================================
// Pick the provider in server/.env:  AI_PROVIDER=anthropic, openai or gemini
// Body: { prompt, system?, json? }
//   system: optional instructions (role, tone, rules)
//   json:   true -> the model must answer with valid JSON (reply is still a string; parse it in the app)
const AI_PROVIDER = (process.env.AI_PROVIDER || (process.env.OPENAI_API_KEY ? "openai" : "gemini")).toLowerCase();
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
// Optional second Gemini model, tried when the main one is overloaded
const GEMINI_FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL;
const MODEL_BY_PROVIDER = { anthropic: process.env.ANTHROPIC_MODEL || "claude-haiku-5-5", openai: OPENAI_MODEL, gemini: GEMINI_MODEL };
console.log(`AI provider: ${AI_PROVIDER} (${MODEL_BY_PROVIDER[AI_PROVIDER]})`);

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

async function askOpenAI({ prompt, system, json, image, schema }) {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is missing in server/.env");
  const messages = [
    ...(system || json
      ? [{ role: "system", content: [system, json ? "Respond only with valid JSON." : "", schema ? `JSON shape: ${JSON.stringify(schema)}` : ""].filter(Boolean).join("\n") }]
      : []),
    {
      role: "user",
      content: image
        ? [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:${image.mimeType};base64,${image.data}` } },
          ]
        : prompt,
    },
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

async function askGemini({ prompt, system, json, image, schema }) {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is missing in server/.env");
  const body = {
    contents: [
      {
        parts: [
          ...(image ? [{ inlineData: { mimeType: image.mimeType, data: image.data } }] : []),
          { text: prompt },
        ],
      },
    ],
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    ...(json
      ? { generationConfig: { responseMimeType: "application/json", ...(schema ? { responseSchema: schema } : {}) } }
      : {}),
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

const PROVIDERS = { anthropic: askAnthropic, openai: askOpenAI, gemini: askGemini };
const ask = (opts) => (PROVIDERS[AI_PROVIDER] || askGemini)(opts);

app.post("/api/ai", requireAuth, async (req, res) => {
  const { prompt, system, json } = req.body;
  if (!prompt) return res.status(400).json({ error: "Missing prompt" });

  try {
    const result = await ask({ prompt, system, json });
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json({ reply: result.reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// Reports: photo -> AI triage -> safety override -> result
// ==========================================
// Body: { image: base64, mimeType?, scope: own|common|from_above, note? }
app.post("/api/reports", requireAuth, async (req, res) => {
  const { image, mimeType, scope, note } = req.body;
  if (!image) return res.status(400).json({ error: "Missing photo" });
  if (!triage.SCOPES.includes(scope)) return res.status(400).json({ error: "scope must be own, common or from_above" });

  try {
    const result = await ask({
      prompt: triage.buildPrompt(scope, note),
      system: triage.SYSTEM_PROMPT,
      json: true,
      schema: triage.RESPONSE_SCHEMA,
      image: { mimeType: mimeType || "image/jpeg", data: image },
    });
    if (result.error) return res.status(result.status).json({ error: result.error });

    const raw = parseJson(result.reply);
    if (!raw) return res.status(502).json({ error: "The AI returned an unreadable answer. Try another photo." });

    const aiResult = triage.applySafetyOverrides(raw, scope);
    if (aiResult.route === "neighbor") aiResult.neighbor_message = triage.neighborMessage(aiResult);

    // Only reports for the manager need the photo kept
    const photoUrl = aiResult.route === "manager" ? await repo.uploadPhoto(req.user.id, image, mimeType || "image/jpeg") : null;
    const report = await repo.createReport({
      reporter_id: req.user.id,
      scope,
      note: note ? String(note).slice(0, 300) : null,
      photo_url: photoUrl,
      ai_result: aiResult,
      route: aiResult.route,
      status: aiResult.route === "manager" ? "sent" : "new",
    });

    res.json({ id: report.id, scope, status: report.status, ai_result: aiResult });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const parseJson = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const REPORT_STATUSES = ["new", "sent", "in_progress", "fixed"];

app.get("/api/reports/:id", requireAuth, async (req, res) => {
  try {
    const report = await repo.getReport(req.params.id);
    if (!report) return res.status(404).json({ error: "Report not found" });
    if (report.reporter_id !== req.user.id && (await repo.getRole(req.user.id)) !== "manager") {
      return res.status(403).json({ error: "Not your report" });
    }
    res.json({ report });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch("/api/reports/:id/status", requireAuth, requireManager, async (req, res) => {
  const { status } = req.body;
  if (!REPORT_STATUSES.includes(status)) return res.status(400).json({ error: `status must be one of ${REPORT_STATUSES.join(", ")}` });
  try {
    const report = await repo.updateReport(req.params.id, { status });
    if (!report) return res.status(404).json({ error: "Report not found" });
    res.json({ report });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// Домоуправител: inbox, AI action plan, building context
// ==========================================
app.get("/api/manager/inbox", requireAuth, requireManager, async (_req, res) => {
  try {
    res.json({ reports: await repo.listInbox(repo.BUILDING_ID) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/manager/plan/:id", requireAuth, requireManager, async (req, res) => {
  try {
    const report = await repo.getReport(req.params.id);
    if (!report) return res.status(404).json({ error: "Report not found" });
    const context = await repo.getContext(report.building_id);

    const result = await ask({
      prompt: manager.buildManagerPrompt(report, context),
      system: manager.MANAGER_SYSTEM,
      json: true,
      schema: manager.MANAGER_SCHEMA,
    });
    if (result.error) return res.status(result.status).json({ error: result.error });
    const raw = parseJson(result.reply);
    if (!raw) return res.status(502).json({ error: "The AI returned an unreadable plan. Try again." });

    const plan = manager.cleanPlan(raw, context);
    const updated = await repo.updateReport(report.id, { manager_plan: plan });
    res.json({ report: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const CONTEXT_FIELDS = [
  "name", "address", "year", "type", "pipe_material", "valve_location_text", "valve_photo_url",
  "panel_location_text", "contractors", "past_repairs",
];

app.get("/api/buildings/:id/context", requireAuth, async (req, res) => {
  try {
    res.json({ context: await repo.getContext(req.params.id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/buildings/:id/context", requireAuth, requireManager, async (req, res) => {
  const body = req.body || {};
  const context = Object.fromEntries(CONTEXT_FIELDS.filter((k) => k in body).map((k) => [k, body[k]]));
  if (context.year != null && context.year !== "" && !Number.isInteger(Number(context.year))) {
    return res.status(400).json({ error: "year must be a whole number" });
  }
  if ("year" in context) context.year = context.year ? Number(context.year) : null;
  for (const k of ["contractors", "past_repairs"]) {
    if (k in context && !Array.isArray(context[k])) return res.status(400).json({ error: `${k} must be a list` });
  }
  try {
    res.json({ context: await repo.saveContext(req.params.id, context) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/specialists", requireAuth, (req, res) => {
  const trade = req.query.trade;
  res.json({ specialists: SPECIALISTS.filter((s) => !trade || s.trade === trade) });
});

app.get("/api/stores", requireAuth, (req, res) => {
  res.json({ stores: nearestStores(parseFloat(req.query.lat), parseFloat(req.query.lng)) });
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));