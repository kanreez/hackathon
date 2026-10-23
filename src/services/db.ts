import { supabase } from "./supabase";

/**
 * Generic CRUD for any Supabase table. Create the table in the dashboard,
 * then use it right away:
 *
 *   const events = await listRows<Event>("events", { orderBy: "created_at" });
 *   const one = await getRow<Event>("events", id);
 *   const created = await createRow<Event>("events", { title: "Demo" });
 *   await updateRow<Event>("events", id, { title: "New title" });
 *   await deleteRow("events", id);
 *
 * Every table needs Row Level Security policies that allow these actions
 * (see supabase/items.sql for an example).
 */

type ListOptions = {
  orderBy?: string;
  ascending?: boolean;
  limit?: number;
  // Simple equality filters, e.g. { user_id: someId, category: "food" }
  match?: Record<string, string | number | boolean>;
  // Case-insensitive text search on one column, e.g. { column: "title", query: "pizza" }
  search?: { column: string; query: string };
};

export async function listRows<T>(table: string, options: ListOptions = {}): Promise<T[]> {
  let query = supabase.from(table).select("*");

  if (options.match) query = query.match(options.match);
  if (options.search?.query) query = query.ilike(options.search.column, `%${options.search.query}%`);
  if (options.orderBy) query = query.order(options.orderBy, { ascending: options.ascending ?? false });
  if (options.limit) query = query.limit(options.limit);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as T[];
}

export async function getRow<T>(table: string, id: string | number): Promise<T | null> {
  const { data, error } = await supabase.from(table).select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as T | null;
}

export async function createRow<T>(table: string, values: Partial<T>): Promise<T> {
  // `as any`: the client has no generated table types, so it can't check columns
  const { data, error } = await supabase.from(table).insert(values as any).select().single();
  if (error) throw error;
  return data as T;
}

export async function updateRow<T>(table: string, id: string | number, values: Partial<T>): Promise<T> {
  const { data, error } = await supabase.from(table).update(values as any).eq("id", id).select().single();
  if (error) throw error;
  return data as T;
}

export async function deleteRow(table: string, id: string | number): Promise<void> {
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw error;
}
