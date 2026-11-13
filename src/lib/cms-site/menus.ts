import { supabase } from "@/integrations/supabase/client";
import { toAppError } from "@/lib/db-errors";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabase as any;

export type SiteMenu = {
  id: string;
  name: string;
  menu_key: string;
  location: string;
  enabled: boolean;
};

export type SiteMenuItem = {
  id: string;
  menu_id: string;
  parent_id: string | null;
  label: string;
  link_type: string;
  href: string | null;
  target_id: string | null;
  position: number;
  enabled: boolean;
};

export async function listSiteMenus() {
  const { data, error } = await db().from("site_menus").select("*").order("name");
  if (error) {
    if (/schema cache|PGRST|relation|does not exist/i.test(error.message)) return [] as SiteMenu[];
    throw toAppError(error);
  }
  return (data ?? []) as SiteMenu[];
}

export async function getMenuByKey(menuKey: string) {
  const { data, error } = await db()
    .from("site_menus")
    .select("*")
    .eq("menu_key", menuKey)
    .maybeSingle();
  if (error) {
    if (/schema cache|PGRST|relation/i.test(error.message)) return null;
    throw toAppError(error);
  }
  return data as SiteMenu | null;
}

export async function listMenuItems(menuId: string) {
  const { data, error } = await db()
    .from("site_menu_items")
    .select("*")
    .eq("menu_id", menuId)
    .order("position", { ascending: true });
  if (error) {
    if (/schema cache|PGRST|relation/i.test(error.message)) return [] as SiteMenuItem[];
    throw toAppError(error);
  }
  return (data ?? []) as SiteMenuItem[];
}

export async function upsertMenuItem(input: {
  id?: string;
  menu_id: string;
  label: string;
  href?: string | null;
  link_type?: string;
  position?: number;
  enabled?: boolean;
}) {
  const payload = {
    menu_id: input.menu_id,
    label: input.label.trim(),
    href: input.href ?? null,
    link_type: input.link_type ?? "custom",
    position: input.position ?? 0,
    enabled: input.enabled ?? true,
    updated_at: new Date().toISOString(),
  };
  if (!payload.label) throw new Error("Label is required.");
  if (input.id) {
    const { data, error } = await db()
      .from("site_menu_items")
      .update(payload)
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw toAppError(error);
    return data as SiteMenuItem;
  }
  const { data, error } = await db().from("site_menu_items").insert(payload).select("*").single();
  if (error) throw toAppError(error);
  return data as SiteMenuItem;
}

export async function deleteMenuItem(id: string) {
  const { error } = await db().from("site_menu_items").delete().eq("id", id);
  if (error) throw toAppError(error);
}

export async function reorderMenuItems(menuId: string, orderedIds: string[]) {
  await Promise.all(
    orderedIds.map((id, index) =>
      db().from("site_menu_items").update({ position: index }).eq("id", id).eq("menu_id", menuId),
    ),
  );
}

/** Public header/main nav: DB items when present, otherwise null (caller uses static NAV). */
export async function getPublicNavItems(preferredKeys: string[] = ["header", "main"]) {
  const menus = await Promise.all(preferredKeys.map((key) => getMenuByKey(key)));
  for (let i = 0; i < preferredKeys.length; i++) {
    const menu = menus[i];
    if (!menu || !menu.enabled) continue;
    const items = (await listMenuItems(menu.id)).filter(
      (item) => item.enabled && item.href?.trim(),
    );
    if (!items.length) continue;
    return {
      source: "database" as const,
      menuKey: menu.menu_key,
      items: items.map((item) => ({ href: item.href!.trim(), label: item.label })),
    };
  }
  return null;
}

/** Seed header menu from the static public NAV when empty. */
export async function seedHeaderMenuFromNav(
  nav: Array<{ label: string; href: string }>,
  menuKey = "header",
) {
  const menu = await getMenuByKey(menuKey);
  if (!menu) throw new Error(`Menu "${menuKey}" not found. Apply site_menus migration.`);
  const existing = await listMenuItems(menu.id);
  if (existing.length) return { seeded: false, count: existing.length };
  let position = 0;
  for (const item of nav) {
    await upsertMenuItem({
      menu_id: menu.id,
      label: item.label,
      href: item.href,
      position: position++,
    });
  }
  return { seeded: true, count: nav.length };
}
