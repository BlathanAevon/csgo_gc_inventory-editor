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
  sticker_index: string;
  image?: string;
  rarity?: { name?: string; color?: string };
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

export type PreviewItem =
  | ApiItem
  | SkinItem
  | AgentItem
  | StickerItem
  | CollectibleItem
  | MusicKitItem;

export type LibrarySelectionEntry =
  | { kind: "vanilla"; item: ApiItem }
  | { kind: "skin"; item: SkinItem }
  | { kind: "sticker"; item: StickerItem }
  | { kind: "agent"; item: AgentItem }
  | { kind: "case"; item: ApiItem }
  | { kind: "key"; item: ApiItem }
  | { kind: "music"; item: MusicKitItem }
  | { kind: "collectible"; item: CollectibleItem };

export type Contributor = {
  login: string;
  avatar_url: string;
  html_url: string;
  contributions: number;
};

