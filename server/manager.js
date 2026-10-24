// Домоуправител variant: turns a resident's report + the building context into an action plan.

const MANAGER_SCHEMA = {
  type: "OBJECT",
  properties: {
    diagnosis: { type: "STRING" },
    severity: { type: "STRING", enum: ["low", "medium", "high", "emergency"] },
    immediate_action: { type: "STRING" },
    plan_steps: { type: "ARRAY", items: { type: "STRING" } },
    suggested_contractor: {
      type: "OBJECT",
      nullable: true,
      properties: {
        name: { type: "STRING" },
        phone: { type: "STRING" },
        why: { type: "STRING" },
      },
      required: ["name", "phone", "why"],
    },
    budget_note: { type: "STRING" },
    uses_context: { type: "ARRAY", items: { type: "STRING" } },
    resident_notice: { type: "STRING" },
  },
  required: ["diagnosis", "severity", "immediate_action", "plan_steps", "budget_note", "uses_context", "resident_notice"],
};

const MANAGER_SYSTEM = `You help the building manager (домоуправител) of a Bulgarian apartment building act on a resident's report about a common part of the building.
You get the resident's report and the building context the manager entered (building type and year, pipes, valve and panel locations, trusted contractors, past repairs).
Rules:
- Use the building context wherever it helps: name the valve location for leaks, prefer a contractor from the context who did similar work, mention related past repairs.
- uses_context lists each context fact you actually used, as short plain sentences (e.g. "Glass & Frames Ltd replaced stairwell windows here in 2024"). Never list facts that are not in the context.
- suggested_contractor must come from the context contractors list, or be null if none fits.
- plan_steps: 3-6 short concrete steps for the manager.
- budget_note: rough guidance only, say it is an estimate. Never invent exact prices.
- resident_notice: a short, polite notice the manager can post or send to all residents.
- Give guidance, never legal verdicts about who is liable.
- Write all text in English, short and concrete.`;

function buildManagerPrompt(report, context) {
  const r = report.ai_result || {};
  return [
    "RESIDENT REPORT",
    `Diagnosis from the photo: ${r.diagnosis}`,
    `Category: ${r.category}. Severity: ${r.severity}. Location: ${report.scope === "common" ? "common part of the building" : report.scope}.`,
    report.note ? `Resident note: ${report.note}` : null,
    r.immediate_action ? `Suggested immediate action: ${r.immediate_action}` : null,
    "",
    "BUILDING CONTEXT (JSON)",
    JSON.stringify(
      {
        name: context.name,
        year: context.year,
        type: context.type,
        pipe_material: context.pipe_material,
        valve_location: context.valve_location_text,
        panel_location: context.panel_location_text,
        contractors: context.contractors,
        past_repairs: context.past_repairs,
      },
      null,
      2
    ),
    "",
    "Write the action plan.",
  ]
    .filter((l) => l !== null)
    .join("\n");
}

// Keeps the plan honest: the contractor must exist in the context
function cleanPlan(raw, context) {
  const plan = { ...raw };
  plan.plan_steps = Array.isArray(plan.plan_steps) ? plan.plan_steps : [];
  plan.uses_context = Array.isArray(plan.uses_context) ? plan.uses_context : [];
  const contractors = context.contractors || [];
  const match = plan.suggested_contractor
    ? contractors.find((c) => c.name.toLowerCase() === String(plan.suggested_contractor.name).toLowerCase())
    : null;
  plan.suggested_contractor = match ? { ...plan.suggested_contractor, name: match.name, phone: match.phone } : null;
  plan.valve_location_text = context.valve_location_text || null;
  plan.valve_photo_url = context.valve_photo_url || null;
  return plan;
}

module.exports = { MANAGER_SCHEMA, MANAGER_SYSTEM, buildManagerPrompt, cleanPlan };
