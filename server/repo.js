// Data access for reports, building context and roles.
// Uses the Supabase tables from supabase/reports.sql when they exist, otherwise an in-memory
// store (seeded below) so the demo works before the database is set up. Memory is lost on restart.
const crypto = require("crypto");

const BUILDING_ID = process.env.BUILDING_ID || "demo-building";
const PHOTO_BUCKET = "photos";

const daysAgo = (d) => new Date(Date.now() - d * 86400000).toISOString();

const SEED_CONTEXT = {
  building_id: BUILDING_ID,
  name: "Block 12, entrance B (sample)",
  address: "ul. Sample 12, Lozenets, Sofia",
  year: 1984,
  type: "panel",
  pipe_material: "Galvanised steel risers, PPR inside most flats",
  valve_location_text: "Main water valve in the basement, left of the stairs, behind the blue door",
  valve_photo_url: null,
  panel_location_text: "Electrical panel on each landing, key with the manager",
  contractors: [
    { name: "Glass & Frames Ltd (sample)", trade: "glazier", phone: "+359 88 000 0005" },
    { name: "Plumber Georgiev (sample)", trade: "plumber", phone: "+359 88 000 0001" },
  ],
  past_repairs: [
    { year: 2024, what: "Replaced stairwell windows on floors 1-4", contractor: "Glass & Frames Ltd (sample)" },
    { year: 2023, what: "Replaced basement section of the cold water riser", contractor: "Plumber Georgiev (sample)" },
  ],
};

const seedReport = (days, diagnosis, severity, status, extra = {}) => ({
  id: crypto.randomUUID(),
  reporter_id: null,
  building_id: BUILDING_ID,
  photo_url: null,
  scope: "common",
  note: null,
  route: "manager",
  status,
  manager_plan: null,
  created_at: daysAgo(days),
  ai_result: { diagnosis, severity, category: "other", route: "manager", immediate_action: "Nothing urgent", ...extra },
});

const SEED_REPORTS = [
  seedReport(2, "Stairwell light out on floor 5", "low", "in_progress", { category: "electrical" }),
  seedReport(6, "Entrance door closer broken, door slams", "low", "fixed"),
  seedReport(9, "Damp patch on basement ceiling near riser", "medium", "fixed", { category: "plumbing" }),
  seedReport(14, "Cracked tile on entrance steps", "low", "sent", { category: "structural" }),
];

function createRepo(supabase) {
  const mem = { reports: [...SEED_REPORTS], context: { ...SEED_CONTEXT }, roles: new Map() };
  const tableOk = {};

  // Checks once per table whether Supabase has it; falls back to memory if not
  async function hasTable(table) {
    if (tableOk[table] === undefined) {
      // A HEAD probe reports a missing table as success, so read one real row
      const { error } = await supabase.from(table).select("*").limit(1);
      tableOk[table] = !error;
      if (error) console.warn(`${table}: using in-memory store (${error.message})`);
    }
    return tableOk[table];
  }

  async function uploadPhoto(userId, base64, mimeType) {
    const ext = (mimeType.split("/")[1] || "jpg").replace("jpeg", "jpg");
    const path = `reports/${userId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(path, Buffer.from(base64, "base64"), { contentType: mimeType });
    if (error) {
      console.warn(`photo upload skipped (${error.message}). Create a public "${PHOTO_BUCKET}" bucket.`);
      return null;
    }
    return supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
  }

  async function createReport(fields) {
    const row = { building_id: BUILDING_ID, ...fields };
    if (await hasTable("reports")) {
      const { data, error } = await supabase.from("reports").insert(row).select("*").single();
      if (error) throw new Error(error.message);
      return data;
    }
    const report = { id: crypto.randomUUID(), created_at: new Date().toISOString(), manager_plan: null, ...row };
    mem.reports.unshift(report);
    return report;
  }

  async function getReport(id) {
    if (await hasTable("reports")) {
      const { data, error } = await supabase.from("reports").select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    }
    return mem.reports.find((r) => r.id === id) ?? null;
  }

  async function updateReport(id, patch) {
    if (await hasTable("reports")) {
      const { data, error } = await supabase.from("reports").update(patch).eq("id", id).select("*").maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    }
    const report = mem.reports.find((r) => r.id === id);
    if (report) Object.assign(report, patch);
    return report ?? null;
  }

  // Reports routed to the manager for this building, newest first
  async function listInbox(buildingId) {
    if (await hasTable("reports")) {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .eq("building_id", buildingId)
        .eq("route", "manager")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw new Error(error.message);
      return data;
    }
    return mem.reports.filter((r) => r.building_id === buildingId && r.route === "manager");
  }

  async function getContext(buildingId) {
    if (await hasTable("building_context")) {
      const { data, error } = await supabase
        .from("building_context")
        .select("*")
        .eq("building_id", buildingId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ?? { ...SEED_CONTEXT, building_id: buildingId };
    }
    return mem.context;
  }

  async function saveContext(buildingId, context) {
    const row = { ...context, building_id: buildingId };
    if (await hasTable("building_context")) {
      const { data, error } = await supabase.from("building_context").upsert(row).select("*").single();
      if (error) throw new Error(error.message);
      return data;
    }
    mem.context = row;
    return row;
  }

  // Role comes from profiles.role; memory keeps demo switches when that column is missing
  async function getRole(userId) {
    const { data, error } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
    if (!error && data?.role) return data.role;
    return mem.roles.get(userId) ?? "resident";
  }

  async function setRole(userId, role) {
    const { data, error } = await supabase.from("profiles").update({ role }).eq("id", userId).select("role");
    if (error || !data?.length) mem.roles.set(userId, role);
    return role;
  }

  return { BUILDING_ID, uploadPhoto, createReport, getReport, updateReport, listInbox, getContext, saveContext, getRole, setRole };
}

module.exports = { createRepo };
