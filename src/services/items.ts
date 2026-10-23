import { Item, mockItems } from "../constants/mockData";
import { createRow, deleteRow, getRow, listRows, updateRow } from "./db";
import { supabase } from "./supabase";

/**
 * Data source for the Explore list, item detail and item form.
 *
 * USE_MOCK = true  → works with no database: uses mockData.ts, and changes live
 *                    in memory until the app reloads. Good for designing screens.
 * USE_MOCK = false → reads and writes the Supabase table below.
 *                    Create it first with supabase/items.sql.
 *
 * On hackathon day: rename the table and the Item type to fit the theme
 * (events, listings, reports...), then set USE_MOCK to false.
 */
export const USE_MOCK = true;
const TABLE = "items";

let memory: Item[] = [...mockItems];

export type ItemInput = Omit<Item, "id" | "user_id" | "created_at">;

export async function listItems(): Promise<Item[]> {
  if (USE_MOCK) return [...memory];
  return listRows<Item>(TABLE, { orderBy: "created_at" });
}

export async function getItem(id: string): Promise<Item | null> {
  if (USE_MOCK) return memory.find((i) => i.id === id) ?? null;
  return getRow<Item>(TABLE, id);
}

export async function createItem(input: ItemInput): Promise<Item> {
  if (USE_MOCK) {
    const item: Item = { ...input, id: String(Date.now()), created_at: new Date().toISOString() };
    memory = [item, ...memory];
    return item;
  }
  const { data } = await supabase.auth.getUser();
  return createRow<Item>(TABLE, { ...input, user_id: data.user?.id });
}

export async function updateItem(id: string, input: Partial<ItemInput>): Promise<Item> {
  if (USE_MOCK) {
    memory = memory.map((i) => (i.id === id ? { ...i, ...input } : i));
    const updated = memory.find((i) => i.id === id);
    if (!updated) throw new Error("Item not found");
    return updated;
  }
  return updateRow<Item>(TABLE, id, input);
}

export async function deleteItem(id: string): Promise<void> {
  if (USE_MOCK) {
    memory = memory.filter((i) => i.id !== id);
    return;
  }
  return deleteRow(TABLE, id);
}
