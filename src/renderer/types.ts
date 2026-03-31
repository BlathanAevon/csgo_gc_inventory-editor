export type ApiItem = {
  id: string;
  name?: string;
  market_hash_name?: string;
  def_index?: string;
  paint_index?: string;
  image?: string;
  rarity?: { name?: string };
};

export type SkinItem = {
  id: string;
  name: string;
  paint_index: string;
  image?: string;
  weapon?: { weapon_id?: number };
  min_float?: number;
  max_float?: number;
  wear?: { name?: string };
  rarity?: { name?: string };
  stattrak?: boolean;
  souvenir?: boolean;
};

export type StickerItem = {
  id: string;
  name: string;
  sticker_index?: string;
  image?: string;
  rarity?: { name?: string; color?: string };
  // Additional fields that may exist in API
  rarity_id?: string | number;
  collectible_id?: string | number;
  unique_id?: string | number;
  [key: string]: any; // Allow any other fields from API
};

export type AgentItem = {
  id: string;
  name: string;
  def_index: string;
  image?: string;
  rarity?: { name?: string; color?: string };
  team?: { name?: string };
};

export type CollectibleItem = ApiItem & {
  description?: string | null;
  type?: string | null;
  premier_season?: number;
};

export type MusicKitItem = ApiItem & {
  description?: string | null;
  exclusive?: boolean;
};

export type GraffitiItem = ApiItem & {
  description?: string | null;
  original?: {
    name?: string;
    image_inventory?: string;
  };
};

export type PatchItem = ApiItem & {
  description?: string | null;
  original?: {
    name?: string;
    image_inventory?: string;
  };
};

export type PreviewItem =
  | ApiItem
  | SkinItem
  | AgentItem
  | StickerItem
  | CollectibleItem
  | MusicKitItem
  | GraffitiItem
  | PatchItem;

export type LibrarySelectionEntry =
  | { kind: "vanilla"; item: ApiItem }
  | { kind: "skin"; item: SkinItem }
  | { kind: "sticker"; item: StickerItem }
  | { kind: "agent"; item: AgentItem }
  | { kind: "case"; item: ApiItem }
  | { kind: "key"; item: ApiItem }
  | { kind: "music"; item: MusicKitItem }
  | { kind: "collectible"; item: CollectibleItem }
  | { kind: "graffiti"; item: GraffitiItem }
  | { kind: "patch"; item: PatchItem };
