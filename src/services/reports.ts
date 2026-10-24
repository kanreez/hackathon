import { ReportResponse, Scope, Specialist, Store } from "../types/triage";
import { api } from "./api";

export function submitReport(input: { image: string; mimeType?: string; scope: Scope; note?: string }) {
  return api.post<ReportResponse>("/api/reports", input);
}

export async function fetchSpecialists(trade: string) {
  const res = await api.get<{ specialists: Specialist[] }>(`/api/specialists?trade=${encodeURIComponent(trade)}`);
  return res.specialists;
}

export async function fetchStores(lat?: number, lng?: number) {
  const q = lat != null && lng != null ? `?lat=${lat}&lng=${lng}` : "";
  const res = await api.get<{ stores: Store[] }>(`/api/stores${q}`);
  return res.stores;
}
