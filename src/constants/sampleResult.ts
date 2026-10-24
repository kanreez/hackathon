import { ReportResponse } from "../types/triage";

// Hard-coded good response: lets the result screen be built and demoed without Gemini or Wi-Fi
export const SAMPLE_RESULT: ReportResponse = {
  id: null,
  scope: "own",
  ai_result: {
    diagnosis: "Dripping compression fitting under the sink",
    category: "plumbing",
    severity: "low",
    safety_flag: false,
    active_leak: true,
    urgent: true,
    immediate_action: "Close the valve under the sink before you start.",
    route: "diy",
    route_reason: "Small leak inside your flat on a standard fitting.",
    steps: [
      "Close the angle valve under the sink and place a bowl under the fitting.",
      "Dry the pipe and fitting so you can see where the water comes from.",
      "Loosen the nut, check the olive ring for cracks, replace it if damaged.",
      "Re-tighten the nut by hand, then a quarter turn with a wrench. Do not overtighten.",
      "Open the valve slowly and watch for drips for 10 minutes.",
    ],
    materials: [
      { name: "Compression olive ring", spec: "Check size printed on the pipe, commonly 1/2 inch (verify)", measure_first: true },
      { name: "PTFE tape", spec: "Standard plumbing tape", measure_first: false },
    ],
    specialist_trade: "none",
    confidence: 0.86,
    question_if_unsure: null,
    safety_notes: [],
    responsibility_note:
      "This is guidance based on a photo, not a legal verdict. Responsibility can depend on your building's rules and the condominium law (ЗУЕС).",
  },
};
