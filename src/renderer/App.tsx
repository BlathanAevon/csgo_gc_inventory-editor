import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  parseInventory,
  serializeInventory,
  type InventoryDoc,
  type InventoryItem,
} from "./lib/inventory";
import agents from "./data/agents.json";
import { urls } from "./data/urls";
import { cs2names, cs2indexes } from "./data/cs2names";
import { options } from "./data/options"
import { def_index } from "./data/def_indexes";

const STICKER_DEF_INDEX = "1209";
const MUSIC_KIT_ITEM_DEF_INDEX = "1314";
const MUSIC_KIT_ATTRIBUTE_ID = "166";
const DEFAULT_GLOVE_DEF_INDEXES = new Set(["5028", "5029"]);
const INVENTORY_PAGE_SIZE = 15;


type FilterId = (typeof options.filter)[number]["id"];
type InventoryEquippedFilter = (typeof options.inventoryEquipped)[number]["id"];


const weaponDefIndexSet = new Set(def_index.weapons.map((item) => item.id));
const knifeDefIndexSet = new Set(def_index.knives.map((item) => item.id));
const gloveDefIndexSet = new Set(def_index.gloves.map((item) => item.id));

const isSkinDefIndex = (defIndex: string) =>
  weaponDefIndexSet.has(defIndex) ||
  knifeDefIndexSet.has(defIndex) ||
  gloveDefIndexSet.has(defIndex);

const defIndexLabels = new Map(
  [...def_index.weapons, ...def_index.knives, ...def_index.gloves].map((item) => [
    item.id,
    item.name,
  ]),
);

type ApiItem = {
  id: string;
  name?: string;
  market_hash_name?: string;
  def_index?: string;
  paint_index?: string;
  image?: string;
  rarity?: { name?: string };
};

type SkinItem = {
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

type StickerItem = {
  id: string;
  name: string;
  sticker_index: string;
  image?: string;
};

type AgentItem = {
  id: string;
  name: string;
  def_index: string;
  image?: string;
  rarity?: { name?: string; color?: string };
  team?: { name?: string };
};

type CollectibleItem = ApiItem & {
  description?: string | null;
  type?: string | null;
  premier_season?: number;
};

type MusicKitItem = ApiItem & {
  description?: string | null;
  exclusive?: boolean;
};

type PreviewItem =
  | ApiItem
  | SkinItem
  | AgentItem
  | StickerItem
  | CollectibleItem
  | MusicKitItem;

const agentItems = agents as AgentItem[];

const isPremierCollectible = (item: CollectibleItem) => {
  const type = item.type?.toLowerCase() ?? "";
  const name = item.name?.toLowerCase() ?? "";
  return (
    item.premier_season != null ||
    type.includes("premier") ||
    name.includes("premier")
  );
};

const isMusicKitStatTrak = (kit: MusicKitItem) =>
  Boolean(kit.name?.includes("StatTrak")) || kit.id?.includes("_st") === true;

const rarityPalette: Record<string, string> = {
  "Consumer Grade": "#b0c3d9",
  "Industrial Grade": "#5e98d9",
  "Mil-Spec Grade": "#4b69ff",
  Restricted: "#8847ff",
  Classified: "#d32ce6",
  Covert: "#eb4b4b",
  Contraband: "#e4ae39",
  Extraordinary: "#eb4b4b",
  Distinguished: "#4b69ff",
  Exceptional: "#8847ff",
  Superior: "#d32ce6",
  Master: "#eb4b4b",
};

type LibraryType = (typeof options.libraryType)[number];

type LibrarySelectionEntry =
  | { kind: "vanilla"; item: ApiItem }
  | { kind: "skin"; item: SkinItem }
  | { kind: "sticker"; item: StickerItem }
  | { kind: "agent"; item: AgentItem }
  | { kind: "case"; item: ApiItem }
  | { kind: "key"; item: ApiItem }
  | { kind: "music"; item: MusicKitItem }
  | { kind: "collectible"; item: CollectibleItem };

type Contributor = {
  login: string;
  avatar_url: string;
  html_url: string;
  contributions: number;
};


const wearSuffixRegex =
  /\s*\((factory new|minimal wear|field-tested|well-worn|battle-scarred)\)\s*$/i;

const normalizeSkinName = (name?: string) => {
  if (!name) return "";
  return name
    .replace(/^★\s*/g, "")
    .replace(/^(stattrak™|souvenir)\s+/i, "")
    .replace(/\s*\|\s*/g, " ")
    .replace(wearSuffixRegex, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
};

const isKnifeSkinName = (name?: string) => {
  const normalized = normalizeSkinName(name);
  return (
    Boolean(normalized) &&
    normalized.includes("knife") &&
    !normalized.includes("glove")
  );
};

const getSkinDisplayName = (name?: string) => {
  if (!name) return "";
  return name.replace(wearSuffixRegex, "").trim();
};

const isCs2SkinName = (name?: string) => {
  if (!name) return false;
  const normalized = normalizeSkinName(name);
  if (normalized.includes("warhammer")) return true;
  if (cs2names.skins.has(normalized)) return true;
  if (name.includes("|")) {
    const afterPipe = normalizeSkinName(name.split("|").slice(1).join("|"));
    return cs2names.skins.has(afterPipe);
  }
  return false;
};

// XD just filter kukri out for "cs2 mode"
const isKukriSkinName = (name?: string) =>
  name ? normalizeSkinName(name).includes("kukri knife") : false;

const isKukriWeaponName = (name?: string) =>
  name ? normalizeSkinName(name).includes("kukri knife") : false;

const isCs2CaseName = (name?: string) =>
  name ? cs2names.cases.has(name.toLowerCase()) : false;

const cs2KeyNames = new Set(
  ["Fever Case Key", "Gallery Case Key", "Kilowatt Case Key"].map((name) =>
    name.toLowerCase(),
  ),
);

const isCs2KeyName = (name?: string) =>
  name ? cs2KeyNames.has(name.toLowerCase()) : false;

const isCs2MusicKitName = (name?: string) =>
  name ? name.toLowerCase().includes("counter-strike 2") : false;

const isPostCsgoYearName = (name?: string) =>
  name ? /(2024|2025)/i.test(name) : false;


const isCs2Collectible = (item: CollectibleItem) => {
  const name = item.name ?? "";
  if (/(2024|2025|2026)/i.test(name)) return true;
  if (item.def_index && cs2indexes.collectibleDefIndexes.has(item.def_index))
    return true;
  return false;
};

const rarityNameToId = new Map(
  options.rarity.map((option) => [option.name.toLowerCase(), option.id]),
);

const getRarityIdFromName = (rarityName?: string) =>
  rarityName ? rarityNameToId.get(rarityName.toLowerCase()) : undefined;

const getRandomPatternTemplate = () =>
  String(Math.floor(Math.random() * 999) + 1);
const DEFAULT_QUALITY_ID = "0";
const DEFAULT_RARITY_ID = "0";
const KNIFE_GLOVE_QUALITY_ID = "3";
const KNIFE_GLOVE_RARITY_ID = "6";

const applyKnifeGloveDefaults = (item: InventoryItem, defIndex: string) => {
  if (knifeDefIndexSet.has(defIndex)) {
    if (defIndex === "42" || defIndex === "59") {
      return;
    }
    item.quality = KNIFE_GLOVE_QUALITY_ID;
    item.rarity = KNIFE_GLOVE_RARITY_ID;
    return;
  }
  if (
    gloveDefIndexSet.has(defIndex) &&
    !DEFAULT_GLOVE_DEF_INDEXES.has(defIndex)
  ) {
    item.quality = KNIFE_GLOVE_QUALITY_ID;
    item.rarity = KNIFE_GLOVE_RARITY_ID;
  }
};

const emptyDoc: InventoryDoc = { rootKey: null, itemsKey: null, items: [] };
// default item is a desert eagle with nothing on it, which is very nice since its the most basic gun there is, I could've used any other weapon but the desert eagle fits best for me.
const getDefaultItem = (id: string): InventoryItem => ({
  id,
  inventory: "3",
  def_index: "1",
  level: "1",
  quality: DEFAULT_QUALITY_ID,
  flags: "0",
  origin: "8",
  in_use: "0",
  rarity: DEFAULT_RARITY_ID,
  attributes: {},
});

const getOptionLabel = (id: string, options: { id: string; name: string }[]) =>
  options.find((option) => option.id === id)?.name ?? "Custom";
const clampWear = (value: number) => Math.min(1, Math.max(0, value));

const randomBetween = (min: number, max: number) =>
  clampWear(min + Math.random() * (max - min));

const getWearRangeFromName = (wearName?: string) => {
  const wear = wearName?.toLowerCase() ?? "";
  if (wear.includes("factory")) return [0, 0.07] as const;
  if (wear.includes("minimal")) return [0.07, 0.15] as const;
  if (wear.includes("field")) return [0.15, 0.37] as const;
  if (wear.includes("well")) return [0.37, 0.44] as const;
  if (wear.includes("battle")) return [0.44, 1] as const;
  return null;
};

const normalizePaintIndex = (value?: string) => {
  if (!value) return "";
  return value.replace(/\.0+$/, "");
};

const normalizeDefIndex = (value: unknown, fallback: string) => {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return fallback;
};

const getWearNameFromSkin = (skin: SkinItem) => {
  if (skin.wear?.name) return skin.wear.name;
  const match = skin.name.match(wearSuffixRegex);
  return match?.[1];
};

// limit wear to the skin's min/max float (if specified)
const getWearRangeForSkin = (skin: SkinItem) => {
  const min = skin.min_float ?? 0;
  const max = skin.max_float ?? 1;
  if (min !== 0 || max !== 1) return [min, max] as const;
  const wearName = getWearNameFromSkin(skin);
  return getWearRangeFromName(wearName);
};

const getRandomFloatForSkin = (skin: SkinItem) => {
  const wearRange = getWearRangeForSkin(skin);
  if (wearRange) return randomBetween(wearRange[0], wearRange[1]);
  return randomBetween(0.02, 0.15);
};

const getSkinGroupKey = (skin: SkinItem) => {
  const weaponId = skin.weapon?.weapon_id ?? 0;
  const stattrakFlag = skin.stattrak ? "1" : "0";
  const souvenirFlag = skin.souvenir ? "1" : "0";
  return `${weaponId}-${skin.paint_index}-${stattrakFlag}-${souvenirFlag}`;
};

const getWearValue = (value?: string) => {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return 0;
  return clampWear(parsed);
};

const getWearLabel = (value: number) => {
  if (value === 0) return "No Wear";
  if (value >= 1) return "Full";
  if (value < 0.07) return "Factory New";
  if (value < 0.14) return "Minimal Wear";
  if (value < 0.37) return "Field-Tested";
  if (value < 0.44) return "Well-Worn";
  return "Battle-Scarred";
};

const getWearColor = (value: number) => {
  if (value === 0) return "#6fdc6f";
  if (value < 0.07) return "#6fdc6f";
  if (value < 0.14) return "#9be27a";
  if (value < 0.37) return "#d7c15a";
  if (value < 0.44) return "#e28a4b";
  return "#e16767";
};

const getLiveImageSrc = (src: string | undefined, nonce: number) => {
  if (!src) return undefined;
  const joiner = src.includes("?") ? "&" : "?";
  return `${src}${joiner}t=${nonce}`;
};

const imageCache = new Map<string, string>();
const imagePromiseCache = new Map<string, Promise<string>>();
// Maximum number of cached images, helps with memory usage (5gb mem usage was too much, of course.)
const MAX_IMAGE_CACHE = 200;

const clearImageCache = () => {
  imageCache.forEach((url) => URL.revokeObjectURL(url));
  imageCache.clear();
  imagePromiseCache.clear();
};

const normalizeImageCacheKey = (src: string) => {
  try {
    const u = new URL(src);

    u.searchParams.delete("t");
    return u.toString();
  } catch (e) {
    return src;
  }
};

const evictOldImagesIfNeeded = () => {
  while (imageCache.size > MAX_IMAGE_CACHE) {
    const firstKey = imageCache.keys().next().value;
    if (!firstKey) break;
    const url = imageCache.get(firstKey);
    if (url) URL.revokeObjectURL(url);
    imageCache.delete(firstKey);
  }
};

const fetchCachedImage = (src: string) => {
  const key = normalizeImageCacheKey(src);
  const cached = imageCache.get(key);
  if (cached) return Promise.resolve(cached);
  const inFlight = imagePromiseCache.get(key);
  if (inFlight) return inFlight;
  const request = fetch(src)
    .then((response) => response.blob())
    .then((blob) => {
      const objectUrl = URL.createObjectURL(blob);
      imageCache.set(key, objectUrl);

      evictOldImagesIfNeeded();
      imagePromiseCache.delete(key);
      return objectUrl;
    })
    .catch(() => {
      imagePromiseCache.delete(key);
      return "";
    });
  imagePromiseCache.set(key, request);
  return request;
};

const useCachedImage = (src?: string, enabled = true) => {
  const [cachedSrc, setCachedSrc] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let didCancel = false;
    if (!src || !enabled) {
      setCachedSrc(null);
      return () => {
        active = false;
        didCancel = true;
      };
    }
    const cached = imageCache.get(src);
    if (cached) {
      setCachedSrc(cached);
      return () => {
        active = false;
      };
    }

    const timer = setTimeout(() => {
      if (didCancel || !active) return;
      fetchCachedImage(src).then((objectUrl) => {
        if (!active) return;
        if (objectUrl) setCachedSrc(objectUrl);
      });
    }, 150);
    return () => {
      active = false;
      didCancel = true;
      clearTimeout(timer);
    };
  }, [src, enabled]);

  return cachedSrc;
};

const useInView = (options?: IntersectionObserverInit) => {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      });
    }, options);
    observer.observe(element);
    return () => observer.disconnect();
  }, [options]);

  return { ref, inView };
};

const CachedImage = ({
  src,
  alt,
  className,
  fallback,
}: {
  src?: string;
  alt: string;
  className?: string;
  fallback?: ReactNode;
}) => {
  const { ref, inView } = useInView({ rootMargin: "100px" });
  const cachedSrc = useCachedImage(src, inView);
  const placeholder = fallback ?? <span>Loading...</span>;
  if (!src) return <span ref={ref}>{fallback ?? <span>No preview</span>}</span>;
  if (!inView || !cachedSrc) return <span ref={ref}>{placeholder}</span>;
  return (
    <span ref={ref}>
      <img src={cachedSrc} alt={alt} className={className} loading="lazy" />
    </span>
  );
};

const getSkinFlags = (item: InventoryItem) => {
  const isStattrak = "80" in item.attributes;
  const isSouvenir = item.quality === "12";
  return { isStattrak, isSouvenir };
};

const getPreviewKey = (item: InventoryItem) => ({
  defIndex: item.def_index,
  finish: item.attributes["6"],
  isSticker: false,
});

const getBaseName = (item: InventoryItem, baseIndex: Map<string, ApiItem>) =>
  baseIndex.get(item.def_index)?.name ??
  defIndexLabels.get(item.def_index) ??
  "";

const getDisplayName = (
  item: InventoryItem,
  baseIndex: Map<string, ApiItem>,
  skinMatch?: SkinItem | null,
  agent?: AgentItem | null,
  sticker?: StickerItem | null,
  musicKit?: MusicKitItem | null,
  collectible?: CollectibleItem | null,
) => {
  if (skinMatch?.name)
    return getSkinDisplayName(skinMatch.name) || skinMatch.name;
  if (agent?.name) return agent.name;
  if (sticker?.name) return sticker.name;
  if (musicKit?.name) return musicKit.name;
  if (collectible?.name) return collectible.name;

  const baseName = getBaseName(item, baseIndex);
  if (baseName) return baseName;

  return "Unknown item";
};

const getPreviewImage = (
  item: InventoryItem,
  preview: PreviewItem | null,
  baseIndex: Map<string, ApiItem>,
  crateIndex: Map<string, ApiItem>,
  keyIndex: Map<string, ApiItem>,
  skinMatch?: SkinItem | null,
  agent?: AgentItem | null,
) => {
  if (skinMatch?.image) return skinMatch.image;
  if (agent?.image) return agent.image;
  const baseItem = baseIndex.get(item.def_index);
  if (baseItem?.image) return baseItem.image;

  const crateItem = crateIndex.get(item.def_index);
  if (crateItem?.image) return crateItem.image;

  const keyItem = keyIndex.get(item.def_index);
  if (keyItem?.image) return keyItem.image;

  if (preview?.image) return preview.image;

  if (gloveDefIndexSet.has(item.def_index)) {
    return baseIndex.get("5029")?.image ?? baseIndex.get("5028")?.image ?? "";
  }

  return "";
};

const findSkinMatch = (
  item: InventoryItem,
  paintIndexMap: Map<string, SkinItem[]>,
  wearValue: number,
) => {
  const paintIndex = normalizePaintIndex(item.attributes["6"]);
  if (!paintIndex) return null;
  const candidates = paintIndexMap.get(paintIndex) ?? [];
  if (candidates.length === 0) return null;

  const weaponId = Number(item.def_index);
  const weaponMatches = candidates.filter(
    (candidate) => candidate.weapon?.weapon_id === weaponId,
  );
  if (weaponMatches.length === 0) return null;
  const pool = weaponMatches;
  const { isStattrak, isSouvenir } = getSkinFlags(item);
  const flagMatches = pool.filter(
    (candidate) =>
      candidate.stattrak === isStattrak && candidate.souvenir === isSouvenir,
  );
  if (flagMatches.length === 0) return null;
  const filteredPool = flagMatches;

  const inRange = filteredPool.find((candidate) => {
    const min = candidate.min_float ?? 0;
    const max = candidate.max_float ?? 1;
    return wearValue >= min && wearValue <= max;
  });
  if (inRange) return inRange;

  let closest = filteredPool[0];
  let closestDistance = Number.POSITIVE_INFINITY;
  filteredPool.forEach((candidate) => {
    const min = candidate.min_float ?? 0;
    const max = candidate.max_float ?? 1;
    const distance =
      wearValue < min ? min - wearValue : wearValue > max ? wearValue - max : 0;
    if (distance < closestDistance) {
      closestDistance = distance;
      closest = candidate;
    }
  });

  return closest;
};

const App = () => {
  const [inventoryDoc, setInventoryDoc] = useState<InventoryDoc>(emptyDoc);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [baseWeapons, setBaseWeapons] = useState<ApiItem[]>([]);
  const [crateItems, setCrateItems] = useState<ApiItem[]>([]);
  const [keyItems, setKeyItems] = useState<ApiItem[]>([]);
  const [skinsNotGrouped, setSkinsNotGrouped] = useState<SkinItem[]>([]);
  const [knifeSkins, setKnifeSkins] = useState<SkinItem[]>([]);
  const [stickerItems, setStickerItems] = useState<StickerItem[]>([]);
  const [collectibleItems, setCollectibleItems] = useState<CollectibleItem[]>(
    [],
  );
  const [musicKitItems, setMusicKitItems] = useState<MusicKitItem[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [skinsLoaded, setSkinsLoaded] = useState(false);
  const [knifeSkinsLoaded, setKnifeSkinsLoaded] = useState(false);
  const [stickersLoaded, setStickersLoaded] = useState(false);
  const [collectiblesLoaded, setCollectiblesLoaded] = useState(false);
  const [musicKitsLoaded, setMusicKitsLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterId>("all");
  const [inventoryRarity, setInventoryRarity] = useState("Any");
  const [inventoryQuality, setInventoryQuality] = useState("Any");
  const [inventoryEquipped, setInventoryEquipped] =
    useState<InventoryEquippedFilter>("all");
  const [activePage, setActivePage] = useState<
    "inventory" | "library" | "credits"
  >("inventory");
  const [libraryTab, setLibraryTab] = useState<LibraryType>("vanilla");
  const [libraryFilter, setLibraryFilter] = useState<"all" | "popular">("all");
  const [librarySearch, setLibrarySearch] = useState("");
  const [libraryRarity, setLibraryRarity] = useState("Any");
  const [libraryQuality, setLibraryQuality] = useState("Any");
  const [libraryWeapon, setLibraryWeapon] = useState("Any");
  const [cs2Mode, setCs2Mode] = useState(false);
  const [libraryMultiSelect, setLibraryMultiSelect] = useState(false);
  const [librarySelection, setLibrarySelection] = useState<
    Record<string, LibrarySelectionEntry>
  >({});
  const [libraryAddProgress, setLibraryAddProgress] = useState<{
    total: number;
    current: number;
  } | null>(null);
  const [inventoryPage, setInventoryPage] = useState(1);
  const [wearPickerOpen, setWearPickerOpen] = useState(false);
  const [wearPickerOptions, setWearPickerOptions] = useState<SkinItem[]>([]);
  const [wearPickerSkin, setWearPickerSkin] = useState<SkinItem | null>(null);
  const [inventoryImageNonce, setInventoryImageNonce] = useState(0);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    itemId: string;
  } | null>(null);
  const [attributesOpen, setAttributesOpen] = useState(false);
  const [inspectOpen, setInspectOpen] = useState(false);
  const [credits, setCredits] = useState<Contributor[]>([]);
  const [creditsLoading, setCreditsLoading] = useState(false);
  const [creditsError, setCreditsError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setDataLoading(true);

    const loaders = [
      fetch(urls.base_weapons)
        .then((response) => response.json())
        .then((data) => {
          if (!mounted) return;
          setBaseWeapons(data as ApiItem[]);
        })
        .catch(() => {
          if (mounted) {
            setStatus("Failed to load base weapon list.");
          }
        }),

      fetch(urls.crates)
        .then((response) => response.json())
        .then((data) => {
          if (!mounted) return;
          setCrateItems(data as ApiItem[]);
        })
        .catch(() => {
          if (mounted) {
            setStatus("Failed to load crate list.");
          }
        }),

      fetch(urls.keys)
        .then((response) => response.json())
        .then((data) => {
          if (!mounted) return;
          setKeyItems(data as ApiItem[]);
        })
        .catch(() => {
          if (mounted) {
            setStatus("Failed to load key list.");
          }
        }),

      Promise.resolve(),
    ];

    Promise.allSettled(loaders).finally(() => {
      if (mounted) {
        setDataLoading(false);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const updateHeight = () => {
      document.documentElement.style.setProperty(
        "--app-height",
        `${window.innerHeight}px`,
      );
    };
    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  useEffect(() => {
    if (activePage !== "library") return;
    if (
      skinsLoaded &&
      knifeSkinsLoaded &&
      stickersLoaded &&
      collectiblesLoaded &&
      musicKitsLoaded
    )
      return;
    let mounted = true;
    setLibraryLoading(true);
    const loaders = [] as Promise<void>[];

    if (!skinsLoaded) {
      loaders.push(
        fetch(urls.skins_not_grouped)
          .then((response) => response.json())
          .then((data) => {
            if (!mounted) return;
            setSkinsNotGrouped(data as SkinItem[]);
            setSkinsLoaded(true);
          })
          .catch(() => {
            if (mounted) {
              setStatus("Failed to load skins list.");
            }
          }),
      );
    }

    if (!knifeSkinsLoaded) {
      loaders.push(
        fetch(urls.knives)
          .then((response) => response.json())
          .then((data) => {
            if (!mounted) return;
            const allSkins = data as SkinItem[];
            const knifeOnly = allSkins.filter((skin) => {
              const weaponId = skin.weapon?.weapon_id
                ? String(skin.weapon.weapon_id)
                : "";
              return knifeDefIndexSet.has(weaponId);
            });
            setKnifeSkins(knifeOnly);
            setKnifeSkinsLoaded(true);
          })
          .catch(() => {
            if (mounted) {
              setStatus("Failed to load knife skins list.");
            }
          }),
      );
    }

    if (!stickersLoaded) {
      loaders.push(
        fetch(urls.stickers)
          .then((response) => response.json())
          .then((data) => {
            if (!mounted) return;
            setStickerItems(data as StickerItem[]);
            setStickersLoaded(true);
          })
          .catch(() => {
            if (mounted) {
              setStatus("Failed to load sticker list.");
            }
          }),
      );
    }

    if (!collectiblesLoaded) {
      loaders.push(
        fetch(urls.colletibles)
          .then((response) => response.json())
          .then((data) => {
            if (!mounted) return;
            setCollectibleItems(data as CollectibleItem[]);
            setCollectiblesLoaded(true);
          })
          .catch(() => {
            if (mounted) {
              setStatus("Failed to load collectibles list.");
            }
          }),
      );
    }

    if (!musicKitsLoaded) {
      loaders.push(
        fetch(urls.music_kits)
          .then((response) => response.json())
          .then((data) => {
            if (!mounted) return;
            setMusicKitItems(data as MusicKitItem[]);
            setMusicKitsLoaded(true);
          })
          .catch(() => {
            if (mounted) {
              setStatus("Failed to load music kits list.");
            }
          }),
      );
    }

    Promise.allSettled(loaders).finally(() => {
      if (mounted) {
        setLibraryLoading(false);
      }
    });

    return () => {
      mounted = false;
    };
  }, [
    activePage,
    skinsLoaded,
    knifeSkinsLoaded,
    stickersLoaded,
    collectiblesLoaded,
    musicKitsLoaded,
  ]);

  useEffect(() => {
    if (!libraryMultiSelect) {
      setLibrarySelection({});
    }
  }, [libraryMultiSelect]);

  useEffect(() => {
    if (activePage !== "credits") return;
    let mounted = true;
    setCreditsLoading(true);
    setCreditsError(null);
    fetch(urls.contributors)
      .then((response) => response.json())
      .then((data) => {
        if (!mounted) return;
        if (!Array.isArray(data)) {
          setCreditsError("Failed to load contributors.");
          setCredits([]);
          return;
        }
        const mapped = data
          .map((entry) => ({
            login: entry.login,
            avatar_url: entry.avatar_url,
            html_url: entry.html_url,
            contributions: entry.contributions ?? 0,
          }))
          .filter((entry) => Boolean(entry.login && entry.avatar_url));
        const main = mapped.find(
          (entry) => entry.login.toLowerCase() === "dricotec",
        );
        const others = mapped.filter(
          (entry) => entry.login.toLowerCase() !== "dricotec",
        );
        setCredits(main ? [main, ...others] : others);
      })
      .catch(() => {
        if (!mounted) return;
        setCreditsError("Failed to load contributors.");
        setCredits([]);
      })
      .finally(() => {
        if (mounted) setCreditsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [activePage]);

  const agentsIndex = useMemo(() => {
    const map = new Map<string, AgentItem>();
    agentItems.forEach((agent) => {
      if (!agent.def_index) return;
      map.set(String(agent.def_index), agent);
    });
    return map;
  }, []);

  const baseWeaponIndex = useMemo(() => {
    const map = new Map<string, ApiItem>();
    baseWeapons.forEach((item) => {
      if (!item.def_index) return;
      map.set(String(item.def_index), item);
    });
    return map;
  }, [baseWeapons]);

  const crateIndex = useMemo(() => {
    const map = new Map<string, ApiItem>();
    crateItems.forEach((item) => {
      if (!item.def_index) return;
      map.set(String(item.def_index), item);
    });
    return map;
  }, [crateItems]);

  const keyIndex = useMemo(() => {
    const map = new Map<string, ApiItem>();
    keyItems.forEach((item) => {
      if (!item.def_index) return;
      map.set(String(item.def_index), item);
    });
    return map;
  }, [keyItems]);

  const collectiblesByDefIndex = useMemo(() => {
    const map = new Map<string, CollectibleItem>();
    collectibleItems.forEach((item) => {
      if (!item.def_index) return;
      if (isPremierCollectible(item)) return;
      map.set(String(item.def_index), item);
    });
    return map;
  }, [collectibleItems]);

  const musicKitsByDefIndex = useMemo(() => {
    const map = new Map<string, MusicKitItem>();
    musicKitItems.forEach((item) => {
      if (!item.def_index) return;
      map.set(String(item.def_index), item);
    });
    return map;
  }, [musicKitItems]);

  const allSkins = useMemo(() => {
    const map = new Map<string, SkinItem>();
    [...skinsNotGrouped, ...knifeSkins].forEach((skin) => {
      if (!skin.id) return;
      map.set(skin.id, skin);
    });
    return Array.from(map.values());
  }, [skinsNotGrouped, knifeSkins]);

  const skinsByPaintIndex = useMemo(() => {
    const map = new Map<string, SkinItem[]>();
    allSkins.forEach((skin) => {
      if (!skin.paint_index) return;
      const paintIndex = normalizePaintIndex(skin.paint_index);
      const list = map.get(paintIndex) ?? [];
      list.push(skin);
      map.set(paintIndex, list);
    });
    return map;
  }, [allSkins]);

  const getMusicKitForItem = (item: InventoryItem) => {
    if (item.def_index !== MUSIC_KIT_ITEM_DEF_INDEX) return null;
    const kitId = item.attributes[MUSIC_KIT_ATTRIBUTE_ID]?.trim() ?? "";
    if (!kitId) return null;
    return musicKitsByDefIndex.get(kitId) ?? null;
  };

  const stickersByIndex = useMemo(() => {
    const map = new Map<string, StickerItem>();
    stickerItems.forEach((sticker) => {
      if (!sticker.sticker_index) return;
      map.set(String(sticker.sticker_index), sticker);
    });
    return map;
  }, [stickerItems]);

  const skinGroups = useMemo(() => {
    const map = new Map<string, SkinItem[]>();
    allSkins.forEach((skin) => {
      if (!skin.paint_index) return;
      const key = getSkinGroupKey(skin);
      const list = map.get(key) ?? [];
      list.push(skin);
      map.set(key, list);
    });
    map.forEach((list) =>
      list.sort((a, b) => (a.min_float ?? 0) - (b.min_float ?? 0)),
    );
    return map;
  }, [allSkins]);

  const librarySkins = useMemo(() => {
    return Array.from(skinGroups.values()).map((list) => {
      return (
        list.find((skin) =>
          skin.wear?.name?.toLowerCase().includes("factory"),
        ) ?? list[0]
      );
    });
  }, [skinGroups]);

  const getSkinImageForGroup = (skin: SkinItem | null) => {
    if (!skin) return "";
    if (skin.image) return skin.image;
    const group = skinGroups.get(getSkinGroupKey(skin)) ?? [];
    return group.find((entry) => entry.image)?.image ?? "";
  };

  const items = inventoryDoc.items;
  const selectedItem = items.find((item) => item.id === selectedId) ?? null;
  const selectedDefIndex = selectedItem?.def_index ?? "";
  const isWeapon = weaponDefIndexSet.has(selectedDefIndex);
  const isKnife = knifeDefIndexSet.has(selectedDefIndex);
  const isGlove = gloveDefIndexSet.has(selectedDefIndex);
  const isSkinItem = isWeapon || isKnife || isGlove;
  const isStickerItem = selectedDefIndex === STICKER_DEF_INDEX;
  const selectedAgent = selectedItem
    ? agentsIndex.get(selectedItem.def_index)
    : null;
  const selectedMusicKit = selectedItem
    ? getMusicKitForItem(selectedItem)
    : null;
  const selectedCollectible = selectedItem
    ? (collectiblesByDefIndex.get(selectedItem.def_index) ?? null)
    : null;
  const stickerKit = selectedItem?.attributes["113"]?.trim() ?? "";
  const stickerInfo = stickerKit ? stickersByIndex.get(stickerKit) : undefined;
  const isSticker = isStickerItem && Boolean(stickerKit);
  const wearValue = selectedItem
    ? getWearValue(selectedItem.attributes["8"])
    : 0;
  const wearLabel = getWearLabel(wearValue);
  const wearColor = getWearColor(wearValue);
  const defIndexLabel = defIndexLabels.get(selectedDefIndex);

  useEffect(() => {
    setInventoryImageNonce((value) => value + 1);
  }, [items]);

  const filteredItems = useMemo(() => {
    const filterMatch = (item: InventoryItem) => {
      let baseMatch = true;
      if (activeFilter === "vanilla") {
        const hasSkin = Boolean(item.attributes["6"]?.trim());
        baseMatch = baseWeaponIndex.has(item.def_index) && !hasSkin;
      } else if (activeFilter === "all") {
        baseMatch = true;
      } else if (activeFilter === "weapons") {
        baseMatch = weaponDefIndexSet.has(item.def_index);
      } else if (activeFilter === "knives") {
        baseMatch = knifeDefIndexSet.has(item.def_index);
      } else if (activeFilter === "gloves") {
        baseMatch = gloveDefIndexSet.has(item.def_index);
      } else if (activeFilter === "stickers") {
        baseMatch = item.def_index === STICKER_DEF_INDEX;
      } else if (activeFilter === "agents") {
        baseMatch = agentsIndex.has(item.def_index);
      }
      const matchesRarity =
        inventoryRarity === "Any" || item.rarity === inventoryRarity;
      const matchesQuality =
        inventoryQuality === "Any" || item.quality === inventoryQuality;
      const equippedKeys = Object.keys(item.equipped_state ?? {});
      const matchesEquipped =
        inventoryEquipped === "all" ||
        (inventoryEquipped === "equipped" && equippedKeys.length > 0) ||
        (inventoryEquipped === "2" && equippedKeys.includes("2")) ||
        (inventoryEquipped === "3" && equippedKeys.includes("3"));
      return baseMatch && matchesRarity && matchesQuality && matchesEquipped;
    };

    const scopedItems = items.filter(filterMatch);
    if (!search.trim()) return scopedItems;
    const term = search.trim().toLowerCase();
    return scopedItems.filter((item) => {
      const agent = agentsIndex.get(item.def_index) ?? null;
      const wear = getWearValue(item.attributes["8"]);
      const skinMatch = findSkinMatch(item, skinsByPaintIndex, wear);
      const sticker =
        item.def_index === STICKER_DEF_INDEX
          ? (stickersByIndex.get(item.attributes["113"]?.trim() ?? "") ?? null)
          : null;
      const musicKit = getMusicKitForItem(item);
      const collectible = collectiblesByDefIndex.get(item.def_index) ?? null;
      const name = getDisplayName(
        item,
        baseWeaponIndex,
        skinMatch,
        agent,
        sticker,
        musicKit,
        collectible,
      );
      return (
        item.def_index.includes(term) ||
        item.id.includes(term) ||
        name.toLowerCase().includes(term)
      );
    });
  }, [
    items,
    search,
    activeFilter,
    inventoryRarity,
    inventoryQuality,
    inventoryEquipped,
    skinsByPaintIndex,
    baseWeaponIndex,
    agentsIndex,
    collectiblesByDefIndex,
    musicKitsByDefIndex,
  ]);

  const totalInventoryPages = Math.max(
    1,
    Math.ceil(filteredItems.length / INVENTORY_PAGE_SIZE),
  );
  const pagedItems = useMemo(() => {
    const start = (inventoryPage - 1) * INVENTORY_PAGE_SIZE;
    return filteredItems.slice(start, start + INVENTORY_PAGE_SIZE);
  }, [filteredItems, inventoryPage]);

  useEffect(() => {
    setInventoryPage(1);
  }, [
    search,
    activeFilter,
    inventoryRarity,
    inventoryQuality,
    inventoryEquipped,
    items.length,
  ]);

  useEffect(() => {
    const handleClose = () => setContextMenu(null);
    window.addEventListener("click", handleClose);
    return () => window.removeEventListener("click", handleClose);
  }, []);

  useEffect(() => {
    if (inventoryPage > totalInventoryPages) {
      setInventoryPage(totalInventoryPages);
    }
  }, [inventoryPage, totalInventoryPages]);

  const handleLoad = async () => {
    const result = await window.inventoryApi.openInventory();
    if (!result) return;
    const parsed = parseInventory(result.content);
    clearImageCache();
    setInventoryDoc(parsed);
    setFilePath(result.filePath);
    setSelectedId(parsed.items[0]?.id ?? null);
    setStatus(`Loaded ${parsed.items.length} items.`);
  };

  const handleSave = async () => {
    const content = serializeInventory(inventoryDoc);
    const result = await window.inventoryApi.saveInventory({
      filePath: filePath ?? undefined,
      content,
    });
    if (!result) return;
    setFilePath(result.filePath);
    setStatus("Inventory saved.");
  };

  const handleAdd = () => {
    const nextId = String(
      items.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1,
    );
    const newItem = getDefaultItem(nextId);
    setInventoryDoc({
      ...inventoryDoc,
      items: [...items, newItem],
    });
    setSelectedId(nextId);
  };

  const handleRemove = () => {
    if (!selectedItem) return;
    const nextItems = items.filter((item) => item.id !== selectedItem.id);
    setInventoryDoc({ ...inventoryDoc, items: nextItems });
    setSelectedId(nextItems[0]?.id ?? null);
  };

  const updateItem = (updated: InventoryItem) => {
    setInventoryDoc({
      ...inventoryDoc,
      items: items.map((item) => (item.id === updated.id ? updated : item)),
    });
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus(`Copied ${label}.`);
    } catch {
      setStatus("Failed to copy.");
    }
  };

  const toggleLibrarySelection = (
    key: string,
    entry: LibrarySelectionEntry,
  ) => {
    setLibrarySelection((prev) => {
      if (prev[key]) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: entry };
    });
  };

  const addSelectedLibraryItems = () => {
    const selected = Object.values(librarySelection);
    if (selected.length === 0) return;
    setLibraryAddProgress({ total: selected.length, current: 0 });
    setStatus(
      `Adding ${selected.length} item${selected.length === 1 ? "" : "s"}...`,
    );

    let nextId =
      items.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
    const nextItems = [...items];
    let addedCount = 0;

    for (const entry of selected) {
      let newItem: InventoryItem | null = null;
      if (entry.kind === "skin") {
        const label = getSkinDisplayName(entry.item.name) || entry.item.name;
        const input = window.prompt(
          `Wear for ${label} (0-1). Leave blank for random.`,
          "",
        );
        if (input === null) {
          setStatus("Multi-add canceled.");
          break;
        }
        const trimmed = input.trim();
        const wearFloat = trimmed ? Number(trimmed) : null;
        const wearOverride =
          trimmed && Number.isNaN(wearFloat)
            ? null
            : wearFloat != null
              ? clampWear(wearFloat)
              : null;
        if (trimmed && Number.isNaN(wearFloat)) {
          setStatus(`Invalid wear for ${label}; using random.`);
        }
        newItem = getDefaultItem(String(nextId++));
        const weaponId = entry.item.weapon?.weapon_id
          ? String(entry.item.weapon.weapon_id)
          : newItem.def_index;
        newItem.def_index = weaponId;
        const wearRange = getWearRangeForSkin(entry.item);
        const wearFloatFinal =
          wearOverride != null
            ? wearOverride
            : wearRange
              ? randomBetween(wearRange[0], wearRange[1])
              : getRandomFloatForSkin(entry.item);
        newItem.attributes = {
          ...newItem.attributes,
          "6": entry.item.paint_index,
          "7": getRandomPatternTemplate(),
          "8": wearFloatFinal.toFixed(6),
        };
        const rarityId = getRarityIdFromName(entry.item.rarity?.name);
        newItem.rarity = rarityId ?? DEFAULT_RARITY_ID;
        if (entry.item.souvenir) {
          newItem.quality = "12";
        } else if (entry.item.stattrak) {
          newItem.quality = "9";
          newItem.attributes["80"] = "0";
          newItem.attributes["81"] = "0";
        } else {
          newItem.quality = DEFAULT_QUALITY_ID;
        }
        applyKnifeGloveDefaults(newItem, weaponId);
      } else if (entry.kind === "sticker") {
        newItem = getDefaultItem(String(nextId++));
        newItem.def_index = STICKER_DEF_INDEX;
        newItem.attributes["113"] = entry.item.sticker_index;
        newItem.rarity = DEFAULT_RARITY_ID;
        newItem.quality = DEFAULT_QUALITY_ID;
      } else if (entry.kind === "agent") {
        newItem = getDefaultItem(String(nextId++));
        newItem.def_index = entry.item.def_index;
        const rarityId = getRarityIdFromName(entry.item.rarity?.name);
        newItem.rarity = rarityId ?? DEFAULT_RARITY_ID;
        newItem.quality = DEFAULT_QUALITY_ID;
      } else if (
        entry.kind === "case" ||
        entry.kind === "key" ||
        entry.kind === "vanilla"
      ) {
        newItem = getDefaultItem(String(nextId++));
        newItem.def_index = normalizeDefIndex(
          entry.item.def_index,
          newItem.def_index,
        );
        const rarityId = getRarityIdFromName(entry.item.rarity?.name);
        newItem.rarity = rarityId ?? DEFAULT_RARITY_ID;
        newItem.quality = DEFAULT_QUALITY_ID;
        applyKnifeGloveDefaults(newItem, newItem.def_index);
      } else if (entry.kind === "music") {
        newItem = getDefaultItem(String(nextId++));
        newItem.def_index = MUSIC_KIT_ITEM_DEF_INDEX;
        if (entry.item.def_index) {
          newItem.attributes[MUSIC_KIT_ATTRIBUTE_ID] = entry.item.def_index;
        }
        const rarityId = getRarityIdFromName(entry.item.rarity?.name);
        newItem.rarity = rarityId ?? DEFAULT_RARITY_ID;
        const isStatTrak = isMusicKitStatTrak(entry.item);
        if (isStatTrak) {
          newItem.quality = "9";
          newItem.attributes["80"] = newItem.attributes["80"] ?? "0";
          newItem.attributes["81"] = newItem.attributes["81"] ?? "0";
        } else {
          newItem.quality = DEFAULT_QUALITY_ID;
        }
      } else if (entry.kind === "collectible") {
        newItem = getDefaultItem(String(nextId++));
        newItem.def_index = entry.item.def_index ?? newItem.def_index;
        const rarityId = getRarityIdFromName(entry.item.rarity?.name);
        newItem.rarity = rarityId ?? DEFAULT_RARITY_ID;
        newItem.quality = DEFAULT_QUALITY_ID;
      }

      if (newItem) {
        nextItems.push(newItem);
        addedCount += 1;
        setLibraryAddProgress({ total: selected.length, current: addedCount });
      }
    }

    if (addedCount > 0) {
      setInventoryDoc({ ...inventoryDoc, items: nextItems });
      setSelectedId(nextItems[nextItems.length - 1]?.id ?? selectedId);
    }
    setLibrarySelection({});
    setLibraryAddProgress(null);
    setStatus(`Added ${addedCount} item${addedCount === 1 ? "" : "s"}.`);
  };

  const updateField = (key: keyof InventoryItem, value: string) => {
    if (!selectedItem) return;
    updateItem({ ...selectedItem, [key]: value });
  };

  const updateAttribute = (attrId: string, value: string) => {
    if (!selectedItem) return;
    const attributes = { ...selectedItem.attributes };
    const cleanedValue = value.trim();
    if (cleanedValue) {
      attributes[attrId] =
        attrId === "6" ? normalizePaintIndex(cleanedValue) : cleanedValue;
    } else {
      delete attributes[attrId];
    }
    updateItem({ ...selectedItem, attributes });
  };

  const toggleStatTrak = (enabled: boolean) => {
    if (!selectedItem) return;
    const attributes = { ...selectedItem.attributes };
    if (enabled) {
      attributes["80"] = attributes["80"] ?? "0";
      attributes["81"] = attributes["81"] ?? "0";
    } else {
      delete attributes["80"];
      delete attributes["81"];
    }
    updateItem({ ...selectedItem, attributes });
  };

  const toggleSticker = (enabled: boolean) => {
    if (!selectedItem) return;
    if (selectedItem.def_index !== STICKER_DEF_INDEX) return;
    const attributes = { ...selectedItem.attributes };
    if (enabled) {
      attributes["113"] = attributes["113"] ?? "0";
    } else {
      delete attributes["113"];
    }
    updateItem({ ...selectedItem, attributes });
  };

  const skinMatch = selectedItem
    ? findSkinMatch(selectedItem, skinsByPaintIndex, wearValue)
    : null;
  const skinMatchWithImage = skinMatch
    ? { ...skinMatch, image: getSkinImageForGroup(skinMatch) }
    : null;
  const preview =
    skinMatchWithImage ??
    selectedAgent ??
    (isStickerItem ? (stickerInfo ?? null) : null) ??
    selectedMusicKit ??
    selectedCollectible;
  const previewImage = selectedItem
    ? getPreviewImage(
        selectedItem,
        preview,
        baseWeaponIndex,
        crateIndex,
        keyIndex,
        skinMatchWithImage,
        selectedAgent,
      )
    : "";
  const livePreviewImage = getLiveImageSrc(previewImage, inventoryImageNonce);

  const previewRarityName =
    preview && "rarity" in preview
      ? (preview as { rarity?: { name?: string } }).rarity?.name
      : undefined;

  const displayName = selectedItem
    ? getDisplayName(
        selectedItem,
        baseWeaponIndex,
        skinMatch,
        selectedAgent,
        stickerInfo ?? null,
        selectedMusicKit,
        selectedCollectible,
      )
    : "";

  const handleWearChange = (value: number) => {
    if (!selectedItem) return;
    const normalized = clampWear(value);
    updateAttribute("8", normalized.toFixed(6));
  };

  const finishCatalogValue = selectedItem
    ? normalizePaintIndex(selectedItem.attributes["6"] ?? "")
    : "";

  const getRarityColor = (rarity?: { name?: string; color?: string }) =>
    rarity?.color ??
    (rarity?.name ? rarityPalette[rarity.name] : undefined) ??
    "#3a3f4f";

  const isPopularEntry = (name: string, rarityName?: string) => {
    const lowered = name.toLowerCase();
    if (
      rarityName &&
      ["Covert", "Classified", "Contraband", "Master", "Superior"].includes(
        rarityName,
      )
    ) {
      return true;
    }
    return [
      "doppler",
      "gamma",
      "fade",
      "marble",
      "sapphire",
      "ruby",
      "emerald",
    ].some((token) => lowered.includes(token));
  };

  const inventoryStats = useMemo(() => {
    const total = items.length;
    const weapons = items.filter((item) =>
      weaponDefIndexSet.has(item.def_index),
    ).length;
    const knives = items.filter((item) =>
      knifeDefIndexSet.has(item.def_index),
    ).length;
    const gloves = items.filter((item) =>
      gloveDefIndexSet.has(item.def_index),
    ).length;
    const skinned = items.filter((item) =>
      Boolean(item.attributes["6"]?.trim()),
    ).length;
    const stickers = items.filter(
      (item) => item.def_index === STICKER_DEF_INDEX,
    ).length;
    const agentsCount = items.filter((item) =>
      agentsIndex.has(item.def_index),
    ).length;
    const cases = items.filter((item) => crateIndex.has(item.def_index)).length;
    const keys = items.filter((item) => keyIndex.has(item.def_index)).length;
    return {
      total,
      weapons,
      knives,
      gloves,
      skinned,
      stickers,
      agentsCount,
      cases,
      keys,
    };
  }, [items, agentsIndex, crateIndex, keyIndex]);

  const handleDuplicate = () => {
    if (!selectedItem) return;
    const nextId = String(
      items.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1,
    );
    const clone: InventoryItem = {
      ...selectedItem,
      id: nextId,
      attributes: { ...selectedItem.attributes },
    };
    setInventoryDoc({
      ...inventoryDoc,
      items: [...items, clone],
    });
    setSelectedId(nextId);
    setStatus(`Duplicated item ${selectedItem.id}.`);
  };

  const handleRandomWear = () => {
    if (!selectedItem) return;
    if (!isSkinItem) return;
    if (skinMatch) {
      const wearRange = getWearRangeForSkin(skinMatch);
      const nextFloat = wearRange
        ? randomBetween(wearRange[0], wearRange[1])
        : getRandomFloatForSkin(skinMatch);
      updateAttribute("8", clampWear(nextFloat).toFixed(6));
      return;
    }
    const wearRange = getWearRangeFromName(wearLabel);
    const nextFloat = wearRange
      ? randomBetween(wearRange[0], wearRange[1])
      : Math.random();
    updateAttribute("8", clampWear(nextFloat).toFixed(6));
  };

  const createItemFromSkin = (
    skin: SkinItem,
    wearRangeOverride?: readonly [number, number] | null,
  ) => {
    const nextId = String(
      items.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1,
    );
    const newItem = getDefaultItem(nextId);
    const weaponId = skin.weapon?.weapon_id
      ? String(skin.weapon.weapon_id)
      : newItem.def_index;
    newItem.def_index = weaponId;
    const wearRange = wearRangeOverride ?? getWearRangeForSkin(skin);
    const wearFloat = wearRange
      ? randomBetween(wearRange[0], wearRange[1])
      : getRandomFloatForSkin(skin);
    newItem.attributes = {
      ...newItem.attributes,
      "6": skin.paint_index,
      "7": getRandomPatternTemplate(),
      "8": wearFloat.toFixed(6),
    };
    const rarityId = getRarityIdFromName(skin.rarity?.name);
    newItem.rarity = rarityId ?? DEFAULT_RARITY_ID;
    if (skin.souvenir) {
      newItem.quality = "12";
    } else if (skin.stattrak) {
      newItem.quality = "9";
      newItem.attributes["80"] = "0";
      newItem.attributes["81"] = "0";
    } else {
      newItem.quality = DEFAULT_QUALITY_ID;
    }
    applyKnifeGloveDefaults(newItem, weaponId);
    setInventoryDoc({
      ...inventoryDoc,
      items: [...items, newItem],
    });
    setSelectedId(nextId);
    setStatus(`Added ${skin.name}.`);
  };

  const openWearPicker = (skin: SkinItem) => {
    const options = skinGroups.get(getSkinGroupKey(skin)) ?? [skin];
    if (options.length <= 1) {
      createItemFromSkin(options[0]);
      return;
    }
    setWearPickerOptions(options);
    setWearPickerSkin(skin);
    setWearPickerOpen(true);
  };

  const applyStickerFromLibrary = (sticker: StickerItem) => {
    if (selectedItem && selectedItem.def_index === STICKER_DEF_INDEX) {
      updateAttribute("113", sticker.sticker_index);
      setStatus(`Updated sticker item ${selectedItem.id} to ${sticker.name}.`);
      return;
    }
    const nextId = String(
      items.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1,
    );
    const newItem = getDefaultItem(nextId);
    newItem.def_index = STICKER_DEF_INDEX;
    newItem.attributes["113"] = sticker.sticker_index;
    newItem.rarity = DEFAULT_RARITY_ID;
    newItem.quality = DEFAULT_QUALITY_ID;
    setInventoryDoc({
      ...inventoryDoc,
      items: [...items, newItem],
    });
    setSelectedId(nextId);
    setStatus(`Added sticker item: ${sticker.name}.`);
  };

  const addAgentFromLibrary = (agent: AgentItem) => {
    const nextId = String(
      items.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1,
    );
    const newItem = getDefaultItem(nextId);
    newItem.def_index = normalizeDefIndex(agent.def_index, newItem.def_index);
    const rarityId = getRarityIdFromName(agent.rarity?.name);
    newItem.rarity = rarityId ?? DEFAULT_RARITY_ID;
    newItem.quality = DEFAULT_QUALITY_ID;
    setInventoryDoc({
      ...inventoryDoc,
      items: [...items, newItem],
    });
    setSelectedId(nextId);
    setStatus(`Added ${agent.name}.`);
  };

  const addContainerFromLibrary = (container: ApiItem) => {
    const nextId = String(
      items.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1,
    );
    const newItem = getDefaultItem(nextId);
    newItem.def_index = normalizeDefIndex(
      container.def_index,
      newItem.def_index,
    );
    const rarityId = getRarityIdFromName(container.rarity?.name);
    newItem.rarity = rarityId ?? DEFAULT_RARITY_ID;
    newItem.quality = DEFAULT_QUALITY_ID;
    applyKnifeGloveDefaults(newItem, newItem.def_index);
    setInventoryDoc({
      ...inventoryDoc,
      items: [...items, newItem],
    });
    setSelectedId(nextId);
    setStatus(`Added ${container.name ?? "Item"}.`);
  };

  const addCollectibleFromLibrary = (collectible: CollectibleItem) => {
    const nextId = String(
      items.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1,
    );
    const newItem = getDefaultItem(nextId);
    newItem.def_index = normalizeDefIndex(
      collectible.def_index,
      newItem.def_index,
    );
    const rarityId = getRarityIdFromName(collectible.rarity?.name);
    newItem.rarity = rarityId ?? DEFAULT_RARITY_ID;
    newItem.quality = DEFAULT_QUALITY_ID;
    setInventoryDoc({
      ...inventoryDoc,
      items: [...items, newItem],
    });
    setSelectedId(nextId);
    setStatus(`Added ${collectible.name ?? "Collectible"}.`);
  };

  const addMusicKitFromLibrary = (kit: MusicKitItem) => {
    const nextId = String(
      items.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1,
    );
    const newItem = getDefaultItem(nextId);
    newItem.def_index = MUSIC_KIT_ITEM_DEF_INDEX;
    if (kit.def_index) {
      newItem.attributes[MUSIC_KIT_ATTRIBUTE_ID] = kit.def_index;
    }
    const rarityId = getRarityIdFromName(kit.rarity?.name);
    newItem.rarity = rarityId ?? DEFAULT_RARITY_ID;
    const isStatTrak = isMusicKitStatTrak(kit);
    if (isStatTrak) {
      newItem.quality = "9";
      newItem.attributes["80"] = newItem.attributes["80"] ?? "0";
      newItem.attributes["81"] = newItem.attributes["81"] ?? "0";
    } else {
      newItem.quality = DEFAULT_QUALITY_ID;
    }
    setInventoryDoc({
      ...inventoryDoc,
      items: [...items, newItem],
    });
    setSelectedId(nextId);
    setStatus(`Added ${kit.name ?? "Music Kit"}.`);
  };

  const libraryEntries = useMemo(() => {
    const term = librarySearch.trim().toLowerCase();
    const matchesSearch = (text: string) =>
      !term || text.toLowerCase().includes(term);
    const matchesPopularity = (name: string, rarityName?: string) =>
      libraryFilter === "all" || isPopularEntry(name, rarityName);
    const matchesRarity = (rarityName?: string) =>
      libraryRarity === "Any" || rarityName === libraryRarity;
    const matchesQuality = (skin: SkinItem) => {
      if (libraryQuality === "Any") return true;
      if (libraryQuality === "Souvenir") return Boolean(skin.souvenir);
      if (libraryQuality === "StatTrak") return Boolean(skin.stattrak);
      return !skin.souvenir && !skin.stattrak;
    };
    const matchesMusicKitQuality = (kit: MusicKitItem) => {
      if (libraryQuality === "Any") return true;
      if (libraryQuality === "Souvenir") return false;
      const isStatTrak = isMusicKitStatTrak(kit);
      if (libraryQuality === "StatTrak") return isStatTrak;
      return !isStatTrak;
    };
    const matchesWeapon = (skin: SkinItem) => {
      if (libraryWeapon === "Any") return true;
      const weaponId = skin.weapon?.weapon_id
        ? String(skin.weapon.weapon_id)
        : "";
      return weaponId === libraryWeapon;
    };

    const showAll = libraryTab === "all";
    const vanillaEntries = baseWeapons.filter((weapon) => {
      if (!(showAll || libraryTab === "vanilla")) return false;
      if (!cs2Mode && isKukriWeaponName(weapon.name)) return false;
      return matchesSearch(`${weapon.name ?? ""} ${weapon.def_index ?? ""}`);
    });
    const vanillaKnifeEntries = baseWeapons.filter((weapon) => {
      if (!(showAll || libraryTab === "knives")) return false;
      if (!cs2Mode && isKukriWeaponName(weapon.name)) return false;
      const defIndex = weapon.def_index ? String(weapon.def_index) : "";
      if (!knifeDefIndexSet.has(defIndex)) return false;
      if (defIndex === "42" || defIndex === "59") return false;
      return matchesSearch(`${weapon.name ?? ""} ${weapon.def_index ?? ""}`);
    });
    const skinEntries = librarySkins.filter((skin) => {
      if (!cs2Mode && isCs2SkinName(skin.name)) return false;
      if (!cs2Mode && isKukriSkinName(skin.name)) return false;
      if (
        !(
          showAll ||
          libraryTab === "skins" ||
          libraryTab === "knives" ||
          libraryTab === "gloves"
        )
      )
        return false;
      if (!matchesPopularity(skin.name, skin.rarity?.name)) return false;
      if (!matchesRarity(skin.rarity?.name)) return false;
      if (!matchesQuality(skin)) return false;
      if (!matchesWeapon(skin)) return false;
      const weaponId = skin.weapon?.weapon_id
        ? String(skin.weapon.weapon_id)
        : "";
      if (
        libraryTab === "knives" &&
        !knifeDefIndexSet.has(weaponId) &&
        !isKnifeSkinName(skin.name)
      )
        return false;
      if (libraryTab === "gloves" && !gloveDefIndexSet.has(weaponId))
        return false;
      const displayName = getSkinDisplayName(skin.name);
      return matchesSearch(`${displayName} ${skin.name} ${skin.paint_index}`);
    });

    const stickerEntries = stickerItems.filter((sticker) => {
      if (!(showAll || libraryTab === "stickers")) return false;
      return matchesSearch(`${sticker.name} ${sticker.sticker_index}`);
    });

    const agentEntries = agentItems.filter((agent) => {
      if (!(showAll || libraryTab === "agents")) return false;
      if (!matchesPopularity(agent.name, agent.rarity?.name)) return false;
      if (!matchesRarity(agent.rarity?.name)) return false;
      return matchesSearch(`${agent.name} ${agent.def_index}`);
    });

    const caseEntries = crateItems.filter((crate) => {
      if (!cs2Mode && isCs2CaseName(crate.name)) return false;
      if (!cs2Mode && isPostCsgoYearName(crate.name)) return false;
      if (!(showAll || libraryTab === "cases")) return false;
      return matchesSearch(`${crate.name ?? ""} ${crate.def_index ?? ""}`);
    });

    const keyEntries = keyItems.filter((key) => {
      if (!cs2Mode && isCs2KeyName(key.name)) return false;
      if (!cs2Mode && isPostCsgoYearName(key.name)) return false;
      if (!(showAll || libraryTab === "keys")) return false;
      return matchesSearch(`${key.name ?? ""} ${key.def_index ?? ""}`);
    });

    const musicKitEntries = musicKitItems.filter((kit) => {
      if (!(showAll || libraryTab === "music")) return false;
      if (!cs2Mode && isCs2MusicKitName(kit.name)) return false;
      if (!matchesPopularity(kit.name ?? "", kit.rarity?.name)) return false;
      if (!matchesRarity(kit.rarity?.name)) return false;
      if (!matchesMusicKitQuality(kit)) return false;
      return matchesSearch(`${kit.name ?? ""} ${kit.def_index ?? ""}`);
    });

    const collectibleEntries = collectibleItems.filter((collectible) => {
      if (!(showAll || libraryTab === "collectibles")) return false;
      if (isPremierCollectible(collectible)) return false;
      if (!cs2Mode && isCs2Collectible(collectible)) return false;
      if (!matchesPopularity(collectible.name ?? "", collectible.rarity?.name))
        return false;
      if (!matchesRarity(collectible.rarity?.name)) return false;
      return matchesSearch(
        `${collectible.name ?? ""} ${collectible.def_index ?? ""}`,
      );
    });

    return {
      vanillaEntries,
      vanillaKnifeEntries,
      skinEntries,
      stickerEntries,
      agentEntries,
      caseEntries,
      keyEntries,
      musicKitEntries,
      collectibleEntries,
    };
  }, [
    libraryTab,
    libraryFilter,
    librarySearch,
    libraryRarity,
    libraryQuality,
    libraryWeapon,
    cs2Mode,
    librarySkins,
    stickerItems,
    baseWeapons,
    crateItems,
    keyItems,
    musicKitItems,
    collectibleItems,
  ]);

  const {
    vanillaEntries,
    vanillaKnifeEntries,
    skinEntries,
    stickerEntries,
    agentEntries,
    caseEntries,
    keyEntries,
    musicKitEntries,
    collectibleEntries,
  } = libraryEntries;

  const selectedLibraryCount = Object.keys(librarySelection).length;

  return (
    <div className="app">
      <div className="app__body">
        <aside className="sidebar">
          <div className="sidebar__title">Menu</div>
          <button
            className={`sidebar__link ${activePage === "inventory" ? "is-active" : ""}`}
            onClick={() => setActivePage("inventory")}
          >
            Inventory
          </button>
          <button
            className={`sidebar__link ${activePage === "library" ? "is-active" : ""}`}
            onClick={() => setActivePage("library")}
          >
            Library
          </button>
          <button
            className={`sidebar__link ${activePage === "credits" ? "is-active" : ""}`}
            onClick={() => setActivePage("credits")}
          >
            Credits
          </button>
          <div className="sidebar__footer">made by drico</div>
        </aside>

        <main
          className={`app__main mainmenu-content__container mainmenu-content__container--inventory ${
            activePage === "inventory" ? "app__main--inventory" : ""
          }`}
        >
          {activePage === "inventory" && (
            <div className="home-grid">
              <div className="home-left">
                <section className="panel panel--list transition-all duration-200 inv-category Active">
                  <div className="panel__header content-navbar">
                    <h2>Inventory</h2>
                    <span className="hint">
                      {dataLoading ? "Loading library data…" : ""}
                    </span>
                  </div>
                  <div className="dock-bar">
                    <button className="btn" onClick={handleLoad}>
                      Load
                    </button>
                    <button className="btn btn--primary" onClick={handleSave}>
                      Save
                    </button>
                    <button className="btn" onClick={handleAdd}>
                      Add
                    </button>
                    <button
                      className="btn btn--danger"
                      onClick={handleRemove}
                      disabled={!selectedItem}
                    >
                      Remove
                    </button>
                  </div>
                  <div className="inventory-toolbar inv-category__list-container">
                    <div className="inv-search-navbar">
                      <input
                        className="input inv-search-textentry"
                        placeholder="Search your inventory"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                      />
                    </div>
                    <div className="filter-row">
                      {options.filter.map((option) => (
                        <button
                          key={option.id}
                          className={`chip ${activeFilter === option.id ? "is-active" : ""}`}
                          onClick={() => setActiveFilter(option.id)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <div className="inventory-advanced-filters">
                      <label>
                        Rarity
                        <select
                          className="input"
                          value={inventoryRarity}
                          onChange={(event) =>
                            setInventoryRarity(event.target.value)
                          }
                        >
                          {options.inventoryRarity.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Quality
                        <select
                          className="input"
                          value={inventoryQuality}
                          onChange={(event) =>
                            setInventoryQuality(event.target.value)
                          }
                        >
                          {options.inventoryQuality.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Equipped
                        <select
                          className="input"
                          value={inventoryEquipped}
                          onChange={(event) =>
                            setInventoryEquipped(
                              event.target.value as InventoryEquippedFilter,
                            )
                          }
                        >
                          {options.inventoryEquipped.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                  <div className="inventory-grid">
                    {pagedItems.map((item) => {
                      const agent = agentsIndex.get(item.def_index) ?? null;
                      const wear = getWearValue(item.attributes["8"]);
                      const match = findSkinMatch(
                        item,
                        skinsByPaintIndex,
                        wear,
                      );
                      const sticker =
                        item.def_index === STICKER_DEF_INDEX
                          ? (stickersByIndex.get(
                              item.attributes["113"]?.trim() ?? "",
                            ) ?? null)
                          : null;
                      const equippedKeys = Object.keys(
                        item.equipped_state ?? {},
                      );
                      const isEquipped = equippedKeys.length > 0;
                      const isCtEquipped = equippedKeys.includes("2");
                      const isTEquipped = equippedKeys.includes("3");
                      const musicKit = getMusicKitForItem(item);
                      const collectible =
                        collectiblesByDefIndex.get(item.def_index) ?? null;
                      const rarityName =
                        match?.rarity?.name ??
                        agent?.rarity?.name ??
                        musicKit?.rarity?.name ??
                        collectible?.rarity?.name ??
                        undefined;
                      const rarityColor = getRarityColor(
                        match?.rarity ??
                          agent?.rarity ??
                          musicKit?.rarity ??
                          collectible?.rarity ??
                          (rarityName ? { name: rarityName } : undefined),
                      );
                      const name = getDisplayName(
                        item,
                        baseWeaponIndex,
                        match,
                        agent,
                        sticker,
                        musicKit,
                        collectible,
                      );
                      const image = getPreviewImage(
                        item,
                        match ?? agent ?? musicKit ?? collectible,
                        baseWeaponIndex,
                        crateIndex,
                        keyIndex,
                        match,
                        agent,
                      );
                      const liveImage = getLiveImageSrc(
                        image,
                        inventoryImageNonce,
                      );
                      return (
                        <button
                          key={item.id}
                          className={`library-card item-tile inventory-card ${
                            item.id === selectedId ? "is-selected" : ""
                          }`}
                          onClick={() => setSelectedId(item.id)}
                          onContextMenu={(event) => {
                            event.preventDefault();
                            setSelectedId(item.id);
                            setContextMenu({
                              x: event.clientX,
                              y: event.clientY,
                              itemId: item.id,
                            });
                          }}
                        >
                          <div className="library-card__thumb item-tile__bg">
                            <CachedImage
                              src={liveImage}
                              alt={name}
                              className="item-tile__image"
                            />
                            {isEquipped && (
                              <div
                                className="item-tile__equipped"
                                title="Equipped"
                              >
                                <span
                                  className={`item-tile__equipped-dot item-tile__equipped-dot--ct ${
                                    isCtEquipped ? "is-active" : ""
                                  }`}
                                />
                                <span
                                  className={`item-tile__equipped-dot item-tile__equipped-dot--t ${
                                    isTEquipped ? "is-active" : ""
                                  }`}
                                />
                              </div>
                            )}
                          </div>
                          <div
                            className="rarity-bar"
                            style={{ backgroundColor: rarityColor }}
                          />
                          <div className="library-card__meta">
                            <strong className="item-tile__name">{name}</strong>
                            <span className="item-tile__meta">
                              ID {item.id}
                            </span>
                            <span className="item-tile__meta">
                              def_index {item.def_index}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <div className="inventory-pagination">
                    <button
                      className="btn btn--ghost"
                      type="button"
                      disabled={inventoryPage <= 1}
                      onClick={() =>
                        setInventoryPage((page) => Math.max(1, page - 1))
                      }
                    >
                      ← Prev
                    </button>
                    <span className="pagination__meta">
                      Page {inventoryPage} of {totalInventoryPages}
                    </span>
                    <button
                      className="btn btn--ghost"
                      type="button"
                      disabled={inventoryPage >= totalInventoryPages}
                      onClick={() =>
                        setInventoryPage((page) =>
                          Math.min(totalInventoryPages, page + 1),
                        )
                      }
                    >
                      Next →
                    </button>
                  </div>
                </section>
              </div>
            </div>
          )}

          {activePage === "library" && (
            <section className="panel panel--library transition-all duration-200 inv-category Active">
              <div className="panel__header content-navbar">
                <h2>Inventory Library</h2>
                <span className="hint">
                  {libraryLoading ? "Loading library…" : ""}
                </span>
                <div className="library-tabs content-navbar__tabs">
                  {options.libraryType.map((tab) => (
                    <button
                      key={tab}
                      className={`chip ${libraryTab === tab ? "is-active" : ""}`}
                      onClick={() => setLibraryTab(tab)}
                    >
                      {tab === "vanilla"
                        ? "Vanilla"
                        : tab === "all"
                          ? "All"
                          : tab === "cases"
                            ? "Cases"
                            : tab === "keys"
                              ? "Keys"
                              : tab === "music"
                                ? "Music Kits"
                                : tab === "collectibles"
                                  ? "Collectibles"
                                  : tab === "knives"
                                    ? "Knives"
                                    : tab === "gloves"
                                      ? "Gloves"
                                      : tab.charAt(0).toUpperCase() +
                                        tab.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="library-toolbar">
                <div className="inv-search-navbar">
                  <input
                    className="input inv-search-textentry"
                    placeholder={`Search ${libraryTab === "all" ? "library" : libraryTab}`}
                    value={librarySearch}
                    onChange={(event) => setLibrarySearch(event.target.value)}
                  />
                </div>
                <div className="library-mode">
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={cs2Mode}
                      onChange={(event) => setCs2Mode(event.target.checked)}
                    />
                    CS2 Mode
                  </label>
                  <span className="hint">
                    CS2 items are hidden in CSGO mode.
                  </span>
                </div>
                <div className="library-bulk">
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={libraryMultiSelect}
                      onChange={(event) =>
                        setLibraryMultiSelect(event.target.checked)
                      }
                    />
                    Multi-add
                  </label>
                  <button
                    className="btn btn--ghost"
                    type="button"
                    disabled={
                      !selectedLibraryCount || Boolean(libraryAddProgress)
                    }
                    onClick={addSelectedLibraryItems}
                  >
                    Add selected ({selectedLibraryCount})
                  </button>
                  {libraryAddProgress && (
                    <span className="hint">
                      Adding {libraryAddProgress.current}/
                      {libraryAddProgress.total}…
                    </span>
                  )}
                  {libraryMultiSelect && selectedLibraryCount > 0 && (
                    <button
                      className="btn btn--ghost"
                      type="button"
                      onClick={() => setLibrarySelection({})}
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="filter-row">
                  {[
                    { id: "all", label: "All" },
                    { id: "popular", label: "Popular" },
                  ].map((option) => (
                    <button
                      key={option.id}
                      className={`chip ${libraryFilter === option.id ? "is-active" : ""}`}
                      onClick={() =>
                        setLibraryFilter(option.id as typeof libraryFilter)
                      }
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <div className="library-selects">
                  <label>
                    Rarity
                    <select
                      className="input"
                      value={libraryRarity}
                      onChange={(event) => setLibraryRarity(event.target.value)}
                    >
                      {options.libraryRarity.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Quality
                    <select
                      className="input"
                      value={libraryQuality}
                      onChange={(event) =>
                        setLibraryQuality(event.target.value)
                      }
                    >
                      {options.libraryQuality.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Weapon
                    <select
                      className="input"
                      value={libraryWeapon}
                      onChange={(event) => setLibraryWeapon(event.target.value)}
                    >
                      <option value="Any">Any</option>
                      {[
                        ...def_index.weapons,
                        ...def_index.knives,
                        ...def_index.gloves,
                      ].map((weapon) => (
                        <option key={weapon.id} value={weapon.id}>
                          {weapon.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
              <div className="library-grid">
                {vanillaKnifeEntries.map((weapon) => {
                  const selectionKey = `vanilla:${weapon.id}`;
                  const isSelected = Boolean(librarySelection[selectionKey]);
                  const handleSelect = () =>
                    toggleLibrarySelection(selectionKey, {
                      kind: "vanilla",
                      item: weapon,
                    });
                  const knifeRarityColor = getRarityColor({ name: "Covert" });
                  return (
                    <div
                      key={`knife-${weapon.id}`}
                      className={`library-card item-tile ${isSelected ? "is-selected" : ""}`}
                    >
                      <button
                        className="library-card__add"
                        type="button"
                        onClick={() =>
                          libraryMultiSelect
                            ? handleSelect()
                            : addContainerFromLibrary(weapon)
                        }
                      >
                        +
                      </button>
                      <div
                        className="library-card__thumb item-tile__bg is-clickable"
                        onClick={() =>
                          libraryMultiSelect
                            ? handleSelect()
                            : addContainerFromLibrary(weapon)
                        }
                      >
                        <CachedImage
                          src={weapon.image}
                          alt={weapon.name ?? "Weapon"}
                          className="item-tile__image"
                        />
                      </div>
                      <div
                        className="rarity-bar"
                        style={{ backgroundColor: knifeRarityColor }}
                      />
                      <div className="library-card__meta">
                        <strong className="item-tile__name">
                          {weapon.name ?? "Weapon"}
                        </strong>
                        {weapon.def_index && (
                          <span className="item-tile__meta">
                            def_index {weapon.def_index}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {vanillaEntries.map((weapon) => {
                  const selectionKey = `vanilla:${weapon.id}`;
                  const isSelected = Boolean(librarySelection[selectionKey]);
                  const handleSelect = () =>
                    toggleLibrarySelection(selectionKey, {
                      kind: "vanilla",
                      item: weapon,
                    });
                  return (
                    <div
                      key={weapon.id}
                      className={`library-card item-tile ${isSelected ? "is-selected" : ""}`}
                    >
                      <button
                        className="library-card__add"
                        type="button"
                        onClick={() =>
                          libraryMultiSelect
                            ? handleSelect()
                            : addContainerFromLibrary(weapon)
                        }
                      >
                        +
                      </button>
                      <div
                        className="library-card__thumb item-tile__bg is-clickable"
                        onClick={() =>
                          libraryMultiSelect
                            ? handleSelect()
                            : addContainerFromLibrary(weapon)
                        }
                      >
                        <CachedImage
                          src={weapon.image}
                          alt={weapon.name ?? "Weapon"}
                          className="item-tile__image"
                        />
                      </div>
                      <div className="rarity-bar" />
                      <div className="library-card__meta">
                        <strong className="item-tile__name">
                          {weapon.name ?? "Weapon"}
                        </strong>
                        {weapon.def_index && (
                          <span className="item-tile__meta">
                            def_index {weapon.def_index}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {skinEntries.map((skin) => {
                  const selectionKey = `skin:${skin.id}`;
                  const isSelected = Boolean(librarySelection[selectionKey]);
                  const handleSelect = () =>
                    toggleLibrarySelection(selectionKey, {
                      kind: "skin",
                      item: skin,
                    });
                  const weaponId = skin.weapon?.weapon_id
                    ? String(skin.weapon.weapon_id)
                    : "";
                  const isKnifeEntry =
                    knifeDefIndexSet.has(weaponId) ||
                    isKnifeSkinName(skin.name);
                  const rarityColor = isKnifeEntry
                    ? getRarityColor({ name: "Covert" })
                    : getRarityColor(skin.rarity);
                  return (
                    <div
                      key={skin.id}
                      className={`library-card item-tile ${isSelected ? "is-selected" : ""}`}
                    >
                      <button
                        className="library-card__add"
                        type="button"
                        onClick={() =>
                          libraryMultiSelect
                            ? handleSelect()
                            : openWearPicker(skin)
                        }
                      >
                        +
                      </button>
                      <div
                        className="library-card__thumb item-tile__bg is-clickable"
                        onClick={() =>
                          libraryMultiSelect
                            ? handleSelect()
                            : openWearPicker(skin)
                        }
                      >
                        <CachedImage
                          src={getSkinImageForGroup(skin)}
                          alt={skin.name}
                          className="item-tile__image"
                        />
                      </div>
                      <div
                        className="rarity-bar"
                        style={{ backgroundColor: rarityColor }}
                      />
                      <div className="library-card__meta">
                        <strong className="item-tile__name">
                          {getSkinDisplayName(skin.name) || skin.name}
                        </strong>
                        <span className="item-tile__meta">
                          Paint {skin.paint_index}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {stickerEntries.map((sticker) => {
                  const selectionKey = `sticker:${sticker.id}`;
                  const isSelected = Boolean(librarySelection[selectionKey]);
                  const handleSelect = () =>
                    toggleLibrarySelection(selectionKey, {
                      kind: "sticker",
                      item: sticker,
                    });
                  return (
                    <div
                      key={sticker.id}
                      className={`library-card item-tile ${isSelected ? "is-selected" : ""}`}
                    >
                      <button
                        className="library-card__add"
                        type="button"
                        onClick={() =>
                          libraryMultiSelect
                            ? handleSelect()
                            : applyStickerFromLibrary(sticker)
                        }
                      >
                        +
                      </button>
                      <div
                        className="library-card__thumb item-tile__bg is-clickable"
                        onClick={() =>
                          libraryMultiSelect
                            ? handleSelect()
                            : applyStickerFromLibrary(sticker)
                        }
                      >
                        <CachedImage
                          src={sticker.image}
                          alt={sticker.name}
                          className="item-tile__image"
                        />
                      </div>
                      <div className="rarity-bar" />
                      <div className="library-card__meta">
                        <strong className="item-tile__name">
                          {sticker.name}
                        </strong>
                        <span className="item-tile__meta">
                          Sticker {sticker.sticker_index}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {agentEntries.map((agent) => {
                  const selectionKey = `agent:${agent.id}`;
                  const isSelected = Boolean(librarySelection[selectionKey]);
                  const handleSelect = () =>
                    toggleLibrarySelection(selectionKey, {
                      kind: "agent",
                      item: agent,
                    });
                  return (
                    <div
                      key={agent.id}
                      className={`library-card item-tile ${isSelected ? "is-selected" : ""}`}
                    >
                      <button
                        className="library-card__add"
                        type="button"
                        onClick={() =>
                          libraryMultiSelect
                            ? handleSelect()
                            : addAgentFromLibrary(agent)
                        }
                      >
                        +
                      </button>
                      <div
                        className="library-card__thumb item-tile__bg is-clickable"
                        onClick={() =>
                          libraryMultiSelect
                            ? handleSelect()
                            : addAgentFromLibrary(agent)
                        }
                      >
                        <CachedImage
                          src={agent.image}
                          alt={agent.name}
                          className="item-tile__image"
                        />
                      </div>
                      <div
                        className="rarity-bar"
                        style={{
                          backgroundColor: getRarityColor(agent.rarity),
                        }}
                      />
                      <div className="library-card__meta">
                        <strong className="item-tile__name">
                          {agent.name}
                        </strong>
                        <span className="item-tile__meta">
                          def_index {agent.def_index}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {caseEntries.map((crate) => {
                  const selectionKey = `case:${crate.id}`;
                  const isSelected = Boolean(librarySelection[selectionKey]);
                  const handleSelect = () =>
                    toggleLibrarySelection(selectionKey, {
                      kind: "case",
                      item: crate,
                    });
                  return (
                    <div
                      key={crate.id}
                      className={`library-card item-tile ${isSelected ? "is-selected" : ""}`}
                    >
                      <button
                        className="library-card__add"
                        type="button"
                        onClick={() =>
                          libraryMultiSelect
                            ? handleSelect()
                            : addContainerFromLibrary(crate)
                        }
                      >
                        +
                      </button>
                      <div
                        className="library-card__thumb item-tile__bg is-clickable"
                        onClick={() =>
                          libraryMultiSelect
                            ? handleSelect()
                            : addContainerFromLibrary(crate)
                        }
                      >
                        <CachedImage
                          src={crate.image}
                          alt={crate.name ?? "Case"}
                          className="item-tile__image"
                        />
                      </div>
                      <div
                        className="rarity-bar"
                        style={{
                          backgroundColor: getRarityColor(crate.rarity),
                        }}
                      />
                      <div className="library-card__meta">
                        <strong className="item-tile__name">
                          {crate.name ?? "Case"}
                        </strong>
                        {crate.def_index && (
                          <span className="item-tile__meta">
                            def_index {crate.def_index}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {keyEntries.map((key) => {
                  const selectionKey = `key:${key.id}`;
                  const isSelected = Boolean(librarySelection[selectionKey]);
                  const handleSelect = () =>
                    toggleLibrarySelection(selectionKey, {
                      kind: "key",
                      item: key,
                    });
                  return (
                    <div
                      key={key.id}
                      className={`library-card item-tile ${isSelected ? "is-selected" : ""}`}
                    >
                      <button
                        className="library-card__add"
                        type="button"
                        onClick={() =>
                          libraryMultiSelect
                            ? handleSelect()
                            : addContainerFromLibrary(key)
                        }
                      >
                        +
                      </button>
                      <div
                        className="library-card__thumb item-tile__bg is-clickable"
                        onClick={() =>
                          libraryMultiSelect
                            ? handleSelect()
                            : addContainerFromLibrary(key)
                        }
                      >
                        <CachedImage
                          src={key.image}
                          alt={key.name ?? "Key"}
                          className="item-tile__image"
                        />
                      </div>
                      <div
                        className="rarity-bar"
                        style={{ backgroundColor: getRarityColor(key.rarity) }}
                      />
                      <div className="library-card__meta">
                        <strong className="item-tile__name">
                          {key.name ?? "Key"}
                        </strong>
                        {key.def_index && (
                          <span className="item-tile__meta">
                            def_index {key.def_index}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {musicKitEntries.map((kit) => {
                  const selectionKey = `music:${kit.id}`;
                  const isSelected = Boolean(librarySelection[selectionKey]);
                  const handleSelect = () =>
                    toggleLibrarySelection(selectionKey, {
                      kind: "music",
                      item: kit,
                    });
                  return (
                    <div
                      key={kit.id}
                      className={`library-card item-tile ${isSelected ? "is-selected" : ""}`}
                    >
                      <button
                        className="library-card__add"
                        type="button"
                        onClick={() =>
                          libraryMultiSelect
                            ? handleSelect()
                            : addMusicKitFromLibrary(kit)
                        }
                      >
                        +
                      </button>
                      <div
                        className="library-card__thumb item-tile__bg is-clickable"
                        onClick={() =>
                          libraryMultiSelect
                            ? handleSelect()
                            : addMusicKitFromLibrary(kit)
                        }
                      >
                        <CachedImage
                          src={kit.image}
                          alt={kit.name ?? "Music Kit"}
                          className="item-tile__image"
                        />
                      </div>
                      <div
                        className="rarity-bar"
                        style={{ backgroundColor: getRarityColor(kit.rarity) }}
                      />
                      <div className="library-card__meta">
                        <strong className="item-tile__name">
                          {kit.name ?? "Music Kit"}
                        </strong>
                        {kit.def_index && (
                          <span className="item-tile__meta">
                            Kit {kit.def_index}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {collectibleEntries.map((collectible) => {
                  const selectionKey = `collectible:${collectible.id}`;
                  const isSelected = Boolean(librarySelection[selectionKey]);
                  const handleSelect = () =>
                    toggleLibrarySelection(selectionKey, {
                      kind: "collectible",
                      item: collectible,
                    });
                  return (
                    <div
                      key={collectible.id}
                      className={`library-card item-tile ${isSelected ? "is-selected" : ""}`}
                    >
                      <button
                        className="library-card__add"
                        type="button"
                        onClick={() =>
                          libraryMultiSelect
                            ? handleSelect()
                            : addCollectibleFromLibrary(collectible)
                        }
                      >
                        +
                      </button>
                      <div
                        className="library-card__thumb item-tile__bg is-clickable"
                        onClick={() =>
                          libraryMultiSelect
                            ? handleSelect()
                            : addCollectibleFromLibrary(collectible)
                        }
                      >
                        <CachedImage
                          src={collectible.image}
                          alt={collectible.name ?? "Collectible"}
                          className="item-tile__image"
                        />
                      </div>
                      <div
                        className="rarity-bar"
                        style={{
                          backgroundColor: getRarityColor(collectible.rarity),
                        }}
                      />
                      <div className="library-card__meta">
                        <strong className="item-tile__name">
                          {collectible.name ?? "Collectible"}
                        </strong>
                        {collectible.def_index && (
                          <span className="item-tile__meta">
                            def_index {collectible.def_index}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
          {activePage === "credits" && (
            <section className="panel panel--credits transition-all duration-200 inv-category Active">
              <div className="panel__header content-navbar">
                <h2>Credits</h2>
                <span className="hint">Open-source contributors</span>
              </div>
              <div className="credits-panel">
                {creditsLoading && (
                  <div className="hint">Loading contributors…</div>
                )}
                {creditsError && <div className="hint">{creditsError}</div>}
                {!creditsLoading && !creditsError && credits.length === 0 && (
                  <div className="hint">No contributors found.</div>
                )}
                {!creditsLoading && credits.length > 0 && (
                  <>
                    {credits[0]?.login?.toLowerCase() === "dricotec" && (
                      <div className="credits-section">
                        <div className="credits-section__title">
                          Main Developer
                        </div>
                        <div className="credits-grid">
                          {credits
                            .filter(
                              (entry) =>
                                entry.login.toLowerCase() === "dricotec",
                            )
                            .map((entry) => (
                              <a
                                key={entry.login}
                                className="credits-card"
                                href={entry.html_url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <img src={entry.avatar_url} alt={entry.login} />
                                <div>
                                  <strong>{entry.login}</strong>
                                  <span>Main Developer</span>
                                </div>
                              </a>
                            ))}
                        </div>
                      </div>
                    )}
                    <div className="credits-section">
                      <div className="credits-section__title">Contributors</div>
                      <div className="credits-grid">
                        {credits
                          .filter(
                            (entry) => entry.login.toLowerCase() !== "dricotec",
                          )
                          .map((entry) => (
                            <a
                              key={entry.login}
                              className="credits-card"
                              href={entry.html_url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <img src={entry.avatar_url} alt={entry.login} />
                              <div>
                                <strong>{entry.login}</strong>
                                <span>{entry.contributions} contributions</span>
                              </div>
                            </a>
                          ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </section>
          )}
        </main>
      </div>

      <footer className="app__footer">
        <span>{status ?? "Ready."}</span>
        {filePath && <span>File: {filePath}</span>}
      </footer>
      {contextMenu && (
        <div
          className="context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="context-menu__title">Item options</div>
          <button
            className="context-menu__item"
            onClick={() => {
              setInspectOpen(true);
              setContextMenu(null);
            }}
          >
            Inspect
          </button>
          <button
            className="context-menu__item"
            onClick={() => {
              setAttributesOpen(true);
              setContextMenu(null);
            }}
          >
            Edit attributes
          </button>
          <button
            className="context-menu__item"
            onClick={() => {
              handleDuplicate();
              setContextMenu(null);
            }}
          >
            Duplicate
          </button>
          <button
            className="context-menu__item"
            onClick={() => {
              handleRemove();
              setContextMenu(null);
            }}
          >
            Remove
          </button>
          {selectedItem && (
            <>
              <button
                className="context-menu__item"
                onClick={() => {
                  copyToClipboard(selectedItem.id, "item id");
                  setContextMenu(null);
                }}
              >
                Copy item id
              </button>
              <button
                className="context-menu__item"
                onClick={() => {
                  copyToClipboard(selectedItem.def_index, "def_index");
                  setContextMenu(null);
                }}
              >
                Copy def_index
              </button>
              <button
                className="context-menu__item"
                onClick={() => {
                  copyToClipboard(displayName, "name");
                  setContextMenu(null);
                }}
              >
                Copy name
              </button>
            </>
          )}
          <div className="context-menu__footer">made by drico</div>
        </div>
      )}
      {inspectOpen && selectedItem && (
        <div className="modal-backdrop" onClick={() => setInspectOpen(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal__header content-navbar inv-popup">
              <div>
                <h3>Inspect</h3>
                <p>{displayName}</p>
              </div>
              <button
                className="btn btn--ghost"
                onClick={() => setInspectOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="details-preview">
              <div className="details-preview__thumb">
                <CachedImage
                  src={livePreviewImage}
                  alt={displayName || "Preview"}
                  fallback={
                    <div className="preview-placeholder">
                      No image available
                    </div>
                  }
                />
              </div>
              <div className="details-preview__meta">
                <h3>{displayName}</h3>
                <p>def_index {selectedItem.def_index}</p>
                {skinMatch?.wear?.name && <p>{skinMatch.wear.name}</p>}
                <p>
                  {previewRarityName ??
                    getOptionLabel(selectedItem.rarity, options.rarity)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      {attributesOpen && selectedItem && (
        <div
          className="modal-backdrop"
          onClick={() => setAttributesOpen(false)}
        >
          <div
            className="modal attributes-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal__header content-navbar inv-popup">
              <div>
                <h3>Attributes</h3>
                <p>{displayName}</p>
              </div>
              <button
                className="btn btn--ghost"
                onClick={() => setAttributesOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="details">
              <div className="details-preview">
                <div className="details-preview__thumb">
                  <CachedImage
                    src={livePreviewImage}
                    alt={displayName || "Preview"}
                    fallback={
                      <div className="preview-placeholder">
                        No image available
                      </div>
                    }
                  />
                </div>
                <div className="details-preview__meta">
                  <h3>{displayName}</h3>
                  <p>def_index {selectedItem.def_index}</p>
                  {isSticker && (
                    <p>{stickerInfo?.name ?? `Sticker kit ${stickerKit}`}</p>
                  )}
                  {defIndexLabel && (
                    <p>
                      {isKnife
                        ? "Knife"
                        : isGlove
                          ? "Glove"
                          : isWeapon
                            ? "Weapon"
                            : "Item"}
                      : {defIndexLabel}
                    </p>
                  )}
                  {skinMatch?.wear?.name && <p>{skinMatch.wear.name}</p>}
                  <p>
                    {previewRarityName ??
                      getOptionLabel(selectedItem.rarity, options.rarity)}
                  </p>
                </div>
              </div>
              <div className="form-grid">
                <label>
                  Item ID
                  <input
                    className="input"
                    value={selectedItem.id}
                    onChange={(event) => updateField("id", event.target.value)}
                  />
                </label>
                <label>
                  Inventory slot
                  <input
                    className="input"
                    value={selectedItem.inventory}
                    onChange={(event) =>
                      updateField("inventory", event.target.value)
                    }
                  />
                </label>
                <label>
                  def_index
                  <input
                    className="input"
                    value={selectedItem.def_index}
                    onChange={(event) =>
                      updateField("def_index", event.target.value)
                    }
                  />
                </label>
                <label>
                  Level
                  <input
                    className="input"
                    value={selectedItem.level}
                    onChange={(event) =>
                      updateField("level", event.target.value)
                    }
                  />
                </label>
                <label>
                  Quality
                  <select
                    className="input"
                    value={selectedItem.quality}
                    onChange={(event) =>
                      updateField("quality", event.target.value)
                    }
                  >
                    {options.quality.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                    {!options.quality.some(
                      (option) => option.id === selectedItem.quality,
                    ) && (
                      <option value={selectedItem.quality}>
                        Custom ({selectedItem.quality})
                      </option>
                    )}
                  </select>
                </label>
                <label>
                  Rarity
                  <select
                    className="input"
                    value={selectedItem.rarity}
                    onChange={(event) =>
                      updateField("rarity", event.target.value)
                    }
                  >
                    {options.rarity.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                    {!options.rarity.some(
                      (option) => option.id === selectedItem.rarity,
                    ) && (
                      <option value={selectedItem.rarity}>
                        Custom ({selectedItem.rarity})
                      </option>
                    )}
                  </select>
                </label>
                <label>
                  Flags
                  <input
                    className="input"
                    value={selectedItem.flags}
                    onChange={(event) =>
                      updateField("flags", event.target.value)
                    }
                  />
                </label>
                <label>
                  Origin
                  <input
                    className="input"
                    value={selectedItem.origin}
                    onChange={(event) =>
                      updateField("origin", event.target.value)
                    }
                  />
                </label>
              </div>

              {isSkinItem ? (
                <>
                  <div className="form-grid form-grid--secondary">
                    <label>
                      Finish catalog (attribute 6)
                      <input
                        className="input"
                        value={finishCatalogValue}
                        onChange={(event) =>
                          updateAttribute("6", event.target.value)
                        }
                      />
                    </label>
                    <label>
                      Pattern template (attribute 7)
                      <input
                        className="input"
                        value={selectedItem.attributes["7"] ?? ""}
                        onChange={(event) =>
                          updateAttribute("7", event.target.value)
                        }
                      />
                    </label>
                    <label>
                      Float (attribute 8)
                      <input
                        className="input"
                        value={
                          selectedItem.attributes["8"] ?? wearValue.toFixed(6)
                        }
                        onChange={(event) =>
                          updateAttribute("8", event.target.value)
                        }
                      />
                    </label>
                  </div>
                  <div className="wear-card">
                    <div className="wear-card__header">
                      <div>
                        <strong>Wear slider</strong>
                        <span>0 (No Wear) → 1 (Battle-Scarred)</span>
                      </div>
                      <span className="wear-card__label">{wearLabel}</span>
                    </div>
                    <input
                      className="wear-card__slider"
                      type="range"
                      min="0"
                      max="1"
                      step="0.001"
                      value={wearValue}
                      onChange={(event) =>
                        handleWearChange(Number(event.target.value))
                      }
                      style={{ "--wear-color": wearColor } as CSSProperties}
                    />
                    <div className="wear-card__meta">
                      <span>Wear: {wearValue.toFixed(3)}</span>
                    </div>
                  </div>
                </>
              ) : null}

              {isStickerItem && (
                <div className="sticker-card">
                  <div className="sticker-card__header">
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={Boolean(stickerKit)}
                        onChange={(event) =>
                          toggleSticker(event.target.checked)
                        }
                      />
                      Sticker
                    </label>
                    <button
                      className="btn btn--ghost"
                      type="button"
                      onClick={() => toggleSticker(true)}
                    >
                      Add sticker
                    </button>
                  </div>
                  {Boolean(stickerKit) && (
                    <div className="form-grid form-grid--secondary">
                      <label>
                        Sticker
                        <select
                          className="input"
                          value={stickerInfo?.sticker_index ?? stickerKit}
                          onChange={(event) =>
                            updateAttribute("113", event.target.value)
                          }
                        >
                          <option value="">Select sticker</option>
                          {stickerItems.map((sticker) => (
                            <option
                              key={sticker.id}
                              value={sticker.sticker_index}
                            >
                              {sticker.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Sticker kit (attribute 113)
                        <input
                          className="input"
                          value={stickerKit}
                          onChange={(event) =>
                            updateAttribute("113", event.target.value)
                          }
                        />
                      </label>
                    </div>
                  )}
                </div>
              )}

              <div className="stattrak">
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={"80" in selectedItem.attributes}
                    onChange={(event) => toggleStatTrak(event.target.checked)}
                  />
                  Enable StatTrak™ attributes
                </label>
                {"80" in selectedItem.attributes && (
                  <div className="form-grid form-grid--secondary">
                    <label>
                      StatTrak™ count (attribute 80)
                      <input
                        className="input"
                        value={selectedItem.attributes["80"] ?? "0"}
                        onChange={(event) =>
                          updateAttribute("80", event.target.value)
                        }
                      />
                    </label>
                    <label>
                      StatTrak™ type (attribute 81)
                      <input
                        className="input"
                        value={selectedItem.attributes["81"] ?? "0"}
                        onChange={(event) =>
                          updateAttribute("81", event.target.value)
                        }
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {wearPickerOpen && (
        <div
          className="modal-backdrop"
          onClick={() => setWearPickerOpen(false)}
        >
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal__header content-navbar inv-popup">
              <div>
                <h3>Select wear</h3>
                {wearPickerSkin?.name && <p>{wearPickerSkin.name}</p>}
              </div>
              <button
                className="btn btn--ghost"
                onClick={() => setWearPickerOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="modal__grid">
              {wearPickerOptions.map((option) => (
                <button
                  key={option.id}
                  className="modal__card item-tile"
                  onClick={() => {
                    const wearName = option.wear?.name ?? option.name;
                    const wearRange =
                      getWearRangeFromName(wearName) ??
                      getWearRangeForSkin(option);
                    createItemFromSkin(option, wearRange);
                    setWearPickerOpen(false);
                  }}
                >
                  <div className="modal__thumb item-tile__bg">
                    <CachedImage
                      src={getSkinImageForGroup(option)}
                      alt={option.name}
                      className="item-tile__image"
                    />
                  </div>
                  <div className="modal__meta">
                    <strong className="item-tile__name">
                      {option.wear?.name ?? "Wear"}
                    </strong>
                    <span className="item-tile__meta">
                      Float {option.min_float ?? 0} – {option.max_float ?? 1}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
