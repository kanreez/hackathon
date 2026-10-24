// Photo triage: prompt, JSON schema and the hard-coded safety override.
// The override runs in Express AFTER the model answers, so Gemini never decides DIY alone.

const ROUTES = ["diy", "specialist", "manager", "neighbor"];
const SEVERITIES = ["low", "medium", "high", "emergency"];
const SCOPES = ["own", "common", "from_above"];

// Gemini responseSchema (OpenAPI subset)
const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    diagnosis: { type: "STRING" },
    category: {
      type: "STRING",
      enum: ["plumbing", "electrical", "gas", "structural", "glazing", "heating", "ventilation", "appliance", "other"],
    },
    severity: { type: "STRING", enum: SEVERITIES },
    safety_flag: { type: "BOOLEAN" },
    active_leak: { type: "BOOLEAN" },
    immediate_action: { type: "STRING" },
    route: { type: "STRING", enum: ROUTES },
    route_reason: { type: "STRING" },
    steps: { type: "ARRAY", items: { type: "STRING" } },
    materials: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          spec: { type: "STRING" },
          measure_first: { type: "BOOLEAN" },
        },
        required: ["name", "spec", "measure_first"],
      },
    },
    specialist_trade: { type: "STRING", enum: ["plumber", "electrician", "glazier", "locksmith", "none"] },
    confidence: { type: "NUMBER" },
    question_if_unsure: { type: "STRING", nullable: true },
  },
  required: [
    "diagnosis", "category", "severity", "safety_flag", "active_leak", "immediate_action",
    "route", "route_reason", "steps", "materials", "specialist_trade", "confidence",
  ],
};

const SYSTEM_PROMPT = `You triage home problems from a photo for a resident of a Bulgarian apartment building.
Decide ONE route:
- diy: safe, simple, inside the resident's own flat, no special license or tools.
- specialist: inside the flat but unsafe or too hard for a layperson.
- manager: common parts of the building (stairwell, roof, basement, entrance, shared risers). The building manager (домоуправител) handles it.
- neighbor: water or damage coming from the flat above.
Rules:
- Give guidance, never legal verdicts about who is liable. Phrase responsibility as "usually" / "typically".
- immediate_action is one short imperative sentence (e.g. close the valve). Use "Nothing urgent" if none.
- Only fill steps and materials for the diy route; otherwise return empty arrays.
- For materials, spec must tell the resident to verify sizes, and set measure_first true when a size must be measured before buying.
- specialist_trade is "none" unless route is specialist.
- confidence is 0..1. If the photo is blurry or unclear, set low confidence and ask ONE short question in question_if_unsure.
- Write all text in English, short and concrete.`;

function buildPrompt(scope, note) {
  const where = {
    own: "The problem is inside the resident's own flat.",
    common: "The problem is in a common part of the building (stairwell, roof, basement, entrance).",
    from_above: "Water or damage is coming into the resident's flat from the flat above.",
  }[scope];
  return `${where}${note ? ` Resident note: ${String(note).slice(0, 300)}` : ""}\nTriage the problem in the photo.`;
}

// Categories that are never DIY, whatever the model says
const NEVER_DIY = new Set(["gas", "electrical", "structural"]);

function applySafetyOverrides(raw, scope) {
  const r = { ...raw };
  const notes = [];
  r.steps = Array.isArray(r.steps) ? r.steps : [];
  r.materials = Array.isArray(r.materials) ? r.materials : [];
  r.confidence = Math.min(1, Math.max(0, Number(r.confidence) || 0));
  if (!SEVERITIES.includes(r.severity)) r.severity = "medium";
  if (!ROUTES.includes(r.route)) r.route = "specialist";

  const force = (route, why) => {
    if (r.route !== route) notes.push(why);
    r.route = route;
  };

  if (scope === "common") {
    force("manager", "Common parts of the building are the building manager's job.");
  } else if (scope === "from_above") {
    force("neighbor", "Damage from above starts with a conversation with your neighbour.");
  } else if (NEVER_DIY.has(r.category) || (r.category === "glazing" && r.severity !== "low")) {
    force("specialist", "This category is never a DIY job. A qualified specialist should handle it.");
  } else if (r.route === "manager") {
    // Own flat but the model says shared parts (e.g. a shared riser): trust it, still not DIY
    notes.push("This looks like a shared part of the building.");
  }

  if (r.confidence < 0.6 && r.route === "diy") {
    force("specialist", "Not sure enough from the photo, so a specialist is the safer call.");
  }

  if (r.route !== "diy") {
    r.steps = [];
    r.materials = [];
  }
  if (r.route !== "specialist") r.specialist_trade = r.specialist_trade && r.specialist_trade !== "none" ? r.specialist_trade : "none";
  if (r.route === "specialist" && (!r.specialist_trade || r.specialist_trade === "none")) {
    r.specialist_trade = { electrical: "electrician", glazing: "glazier" }[r.category] || "plumber";
  }

  if (scope === "from_above") {
    r.steps = [
      "Photograph the damage with the date visible, from several angles.",
      "Note the time you noticed it and whether it is still active.",
      "Send your neighbour a polite message (draft below) and keep a copy.",
    ];
  }

  // Active leak or emergency: the action goes first and the alert is flagged
  r.urgent = r.severity === "emergency" || r.active_leak === true || r.safety_flag === true;
  if (r.active_leak && !/valve|water|shut|close/i.test(r.immediate_action || "")) {
    const rest = /^nothing urgent/i.test(r.immediate_action || "") ? "" : r.immediate_action || "";
    r.immediate_action = `Close the nearest water valve first. ${rest}`.trim();
  }

  r.safety_notes = notes;
  r.responsibility_note = "This is guidance based on a photo, not a legal verdict. Responsibility can depend on your building's rules and the condominium law (ЗУЕС).";
  return r;
}

// Pre-written polite message for the neighbour route
function neighborMessage(r) {
  return `Hello! I'm your neighbour from below. I noticed water/damage coming into my flat (${r.diagnosis.toLowerCase()}). Could you please check your pipes and appliances when you have a moment? I've photographed the damage and I'm happy to help find the cause. Thank you!`;
}

module.exports = { RESPONSE_SCHEMA, SYSTEM_PROMPT, SCOPES, buildPrompt, applySafetyOverrides, neighborMessage };
