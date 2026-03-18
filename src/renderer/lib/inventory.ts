import { parseKeyValues, stringifyKeyValues, type KvObject } from "./kv";

export type InventoryAttributeMap = Record<string, string>;
export type InventoryEquippedStateMap = Record<string, string>;

export interface InventoryItem {
  id: string;
  inventory: string;
  def_index: string;
  level: string;
  quality: string;
  flags: string;
  origin: string;
  in_use: string;
  rarity: string;
  attributes: InventoryAttributeMap;
  equipped_state?: InventoryEquippedStateMap;
}

export interface InventoryDoc {
  rootKey: string | null;
  itemsKey: string | null;
  items: InventoryItem[];
}

const normalizeToStringMap = (obj: KvObject): Record<string, string> => {
  const result: Record<string, string> = {};
  Object.entries(obj).forEach(([key, value]) => {
    if (typeof value === "string") {
      result[key] = value;
    }
  });
  return result;
};

export const parseInventory = (text: string): InventoryDoc => {
  const parsed = parseKeyValues(text);
  let rootKey: string | null = null;
  let itemsKey: string | null = null;
  let container: KvObject = parsed as KvObject;

  const rootKeys = Object.keys(container);
  if (rootKeys.length === 1 && typeof container[rootKeys[0]] === "object") {
    rootKey = rootKeys[0];
    container = container[rootKeys[0]] as KvObject;
  }

  if (container.items && typeof container.items === "object") {
    itemsKey = "items";
    container = container.items as KvObject;
  } else if (container.Items && typeof container.Items === "object") {
    itemsKey = "Items";
    container = container.Items as KvObject;
  }

  const items = Object.entries(container)
    .filter(([, value]) => typeof value === "object")
    .map(([key, value]) => {
      const entry = value as KvObject;
      const attributesObj = (entry.attributes ?? entry.Attributes) as KvObject | undefined;
      const attributes = attributesObj ? normalizeToStringMap(attributesObj) : {};
      const equippedObj = (entry.equipped_state ?? entry.EquippedState) as KvObject | undefined;
      const equipped_state = equippedObj ? normalizeToStringMap(equippedObj) : undefined;

      return {
        id: key,
        inventory: String(entry.inventory ?? "0"),
        def_index: String(entry.def_index ?? "0"),
        level: String(entry.level ?? "1"),
        quality: String(entry.quality ?? "0"),
        flags: String(entry.flags ?? "0"),
        origin: String(entry.origin ?? "8"),
        in_use: String(entry.in_use ?? "0"),
        rarity: String(entry.rarity ?? "0"),
        attributes,
        equipped_state
      } satisfies InventoryItem;
    })
    .sort((a, b) => Number(a.id) - Number(b.id));

  return { rootKey, itemsKey, items };
};

const buildItemObject = (item: InventoryItem): KvObject => {
  const result: KvObject = {
    inventory: item.inventory,
    def_index: item.def_index,
    level: item.level,
    quality: item.quality,
    flags: item.flags,
    origin: item.origin,
    in_use: item.in_use,
    rarity: item.rarity
  };

  const attributeEntries = Object.entries(item.attributes).filter(([, value]) => value.trim().length > 0);
  if (attributeEntries.length > 0) {
    const attributes: KvObject = {};
    attributeEntries.forEach(([key, value]) => {
      attributes[key] = value;
    });
    result.attributes = attributes;
  }

  if (item.equipped_state) {
    const equippedEntries = Object.entries(item.equipped_state).filter(([, value]) => value.trim().length > 0);
    if (equippedEntries.length > 0) {
      const equipped: KvObject = {};
      equippedEntries.forEach(([key, value]) => {
        equipped[key] = value;
      });
      result.equipped_state = equipped;
    }
  }

  return result;
};

export const serializeInventory = (doc: InventoryDoc) => {
  const sortedItems = [...doc.items].sort((a, b) => Number(a.id) - Number(b.id));
  const itemsObject: KvObject = {};

  sortedItems.forEach((item) => {
    itemsObject[item.id] = buildItemObject(item);
  });

  let payload: KvObject = itemsObject;
  if (doc.itemsKey) {
    payload = { [doc.itemsKey]: itemsObject };
  }

  if (doc.rootKey) {
    payload = { [doc.rootKey]: payload };
  }

  return stringifyKeyValues(payload);
};
// This file contains logic for parsing and serializing the inventory.txt format used by csgo_gc ^_^