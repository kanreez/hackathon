import { api } from "./api";

// Account calls that need the server: username lookups check every profile, not just your own
export type Me = {
  user: { id: string; email: string };
  profile: { username: string | null; full_name: string | null } | null;
};

export const getMe = () => api.get<Me>("/api/me");

export const checkUsername = (name: string) =>
  api.get<{ available: boolean; problem: string | null }>(`/api/usernames/check?name=${encodeURIComponent(name)}`);

export async function saveUsername(username: string) {
  return (await api.put<{ username: string }>("/api/me/username", { username })).username;
}
