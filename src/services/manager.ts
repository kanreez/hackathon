import { BuildingContext, Report, ReportStatus } from "../types/triage";
import { api } from "./api";

export type Role = "resident" | "manager";
export type Me = { role: Role; building_id: string; role_switch: boolean };

export const fetchMe = () => api.get<Me>("/api/me");

export async function switchRole(role: Role) {
  return (await api.put<{ role: Role }>("/api/me/role", { role })).role;
}

export async function fetchReport(id: string) {
  return (await api.get<{ report: Report }>(`/api/reports/${id}`)).report;
}

export async function fetchInbox() {
  return (await api.get<{ reports: Report[] }>("/api/manager/inbox")).reports;
}

export async function setReportStatus(id: string, status: ReportStatus) {
  return (await api.patch<{ report: Report }>(`/api/reports/${id}/status`, { status })).report;
}

export async function generatePlan(id: string) {
  return (await api.post<{ report: Report }>(`/api/manager/plan/${id}`)).report;
}

export async function fetchContext(buildingId: string) {
  return (await api.get<{ context: BuildingContext }>(`/api/buildings/${buildingId}/context`)).context;
}

export async function saveContext(buildingId: string, context: Partial<BuildingContext>) {
  return (await api.put<{ context: BuildingContext }>(`/api/buildings/${buildingId}/context`, context)).context;
}
