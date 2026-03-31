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
import { options } from "./data/options";
import { def_index } from "./data/def_indexes";
import {
  ApiItem,
  SkinItem,
  StickerItem,
  AgentItem,
  CollectibleItem,
  MusicKitItem,
  GraffitiItem,
  PreviewItem,
  LibrarySelectionEntry,
} from "./types";

const STICKER_DEF_INDEX = "1209";
const MUSIC_KIT_ITEM_DEF_INDEX = "1314";
const MUSIC_KIT_ATTRIBUTE_ID = "166";
const GRAFFITI_ATTRIBUTE_ID = "113";
const GRAFFITI_TINT_ATTRIBUTE_ID = "233";
const GRAFFITI_USES_ATTRIBUTE_ID = "232";
const GRAFFITI_DEFAULT_DEF_INDEX = "1348";
const GRAFFITI_DEF_INDEXES = new Set(["1348", "1349"]);
const DEFAULT_GLOVE_DEF_INDEXES = new Set(["5028", "5029"]);

type FilterId = (typeof options.filter)[number]["id"];
type InventoryEquippedFilter = (typeof options.inventoryEquipped)[number]["id"];

const weaponDefIndexSet = new Set(def_index.weapons.map((item) => item.id));
const knifeDefIndexSet = new Set(def_index.knives.map((item) => item.id));
const gloveDefIndexSet = new Set(def_index.gloves.map((item) => item.id));
const cratesDefIndexSet = new Set(def_index.crates.map((item) => item.id));
const keysDefIndexSet = new Set(def_index.keys.map((item) => item.id));

const isSkinDefIndex = (defIndex: string) =>
  weaponDefIndexSet.has(defIndex) ||
  knifeDefIndexSet.has(defIndex) ||
  gloveDefIndexSet.has(defIndex);

const defIndexLabels = new Map(
  [
    ...def_index.weapons,
    ...def_index.knives,
    ...def_index.gloves,
    ...def_index.crates,
    ...def_index.keys,
  ].map((item) => [item.id, item.name]),
);

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

const isKukriSkinName = (name?: string) =>
  name ? normalizeSkinName(name).includes("kukri knife") : false;

const isKukriWeaponName = (name?: string) =>
  name ? normalizeSkinName(name).includes("kukri knife") : false;

const rarityNameToId = new Map(
  options.rarity.map((option) => [option.name.toLowerCase(), option.id]),
);

const getRarityIdFromName = (rarityName?: string) =>
  rarityName
    ? rarityNameToId.get(rarityName.toLowerCase()) ??
      {
        "high grade": "3",
        remarkable: "4",
        exotic: "5",
      }[rarityName.toLowerCase()]
    : undefined;

const getRandomPatternTemplate = () =>
  String(Math.floor(Math.random() * 999) + 1);
const DEFAULT_QUALITY_ID = "0";
const DEFAULT_RARITY_ID = "0";
const KNIFE_GLOVE_QUALITY_ID = "3";
const KNIFE_GLOVE_RARITY_ID = "6";
const STICKER_QUALITY_ID = "4";
const STICKER_RARITY_ID = "4";
const GRAFFITI_QUALITY_ID = "4";

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

const emptyDoc: InventoryDoc = { rootKey: "items", itemsKey: null, items: [] };
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

const useInView = () => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setInView(entry.isIntersecting);
        });
      },
      { rootMargin: "300px" },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, inView };
};

interface CachedImageProps {
  src?: string;
  alt: string;
  className?: string;
  fallback?: ReactNode;
}

export const CachedImage = ({
  src,
  alt,
  className,
  fallback,
}: CachedImageProps) => {
  const { ref, inView } = useInView();
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const handleLoad = () => {
    setLoaded(true);
    setError(false);
  };

  const handleError = () => {
    setError(true);
    setLoaded(false);
  };

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;

    if (src && !loaded && !error) {
      img.src = src;
    }
  }, [src, loaded, error]);

  if (!src)
    return <span ref={ref}>{fallback ?? <span>No preview</span>}</span>;

  return (
    <span ref={ref}>
      {inView ? (
        <>
          <img
            ref={imgRef}
            src={src}
            alt={alt}
            className={className}
            onLoad={handleLoad}
            onError={handleError}
            style={{ display: loaded && !error ? "block" : "none" }}
          />
          {!loaded && !error && (fallback ?? <span>Loading...</span>)}
          {error && (fallback ?? <span>Failed to load</span>)}
        </>
      ) : (
        (fallback ?? <span>Loading...</span>)
      )}
    </span>
  );
};

const getSkinFlags = (item: InventoryItem) => {
  const isStattrak = "80" in item.attributes;
  const isSouvenir = item.quality === "12";
  return { isStattrak, isSouvenir };
};

const getStickerSlots = (
  item: InventoryItem,
  stickersByIndex: Map<string, StickerItem>,
): (StickerItem | null)[] => {
  const stickerAttrIds = ["113", "117", "121", "125"];
  return stickerAttrIds.map((attrId) => {
    const stickerId = item.attributes[attrId]?.trim() ?? "";
    return stickerId ? stickersByIndex.get(stickerId) ?? null : null;
  });
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
  graffiti?: GraffitiItem | null,
  musicKit?: MusicKitItem | null,
  collectible?: CollectibleItem | null,
) => {
  if (skinMatch?.name)
    return getSkinDisplayName(skinMatch.name) || skinMatch.name;
  if (agent?.name) return agent.name;
  if (sticker?.name) return sticker.name;
  if (graffiti?.name) return graffiti.name;
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
  const [graffitiItems, setGraffitiItems] = useState<GraffitiItem[]>([]);
  const [collectibleItems, setCollectibleItems] = useState<CollectibleItem[]>(
    [],
  );
  const [musicKitItems, setMusicKitItems] = useState<MusicKitItem[]>([]);
  const [skinsLoaded, setSkinsLoaded] = useState(false);
  const [knifeSkinsLoaded, setKnifeSkinsLoaded] = useState(false);
  const [stickersLoaded, setStickersLoaded] = useState(false);
  const [graffitiLoaded, setGraffitiLoaded] = useState(false);
  const [collectiblesLoaded, setCollectiblesLoaded] = useState(false);
  const [musicKitsLoaded, setMusicKitsLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [addStatus, setAddStatus] = useState<{
    message: string;
    tone: "success" | "error";
  } | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterId>("all");
  const [inventoryRarity, setInventoryRarity] = useState("Any");
  const [inventoryQuality, setInventoryQuality] = useState("Any");
  const [inventoryEquipped, setInventoryEquipped] =
    useState<InventoryEquippedFilter>("all");
  const [activePage, setActivePage] = useState<
    "inventory" | "library"
  >("inventory");
  const [libraryTab, setLibraryTab] = useState<LibraryType>("vanilla");
  const [libraryFilter, setLibraryFilter] = useState<"all" | "popular">("all");
  const [librarySearch, setLibrarySearch] = useState("");
  const [libraryRarity, setLibraryRarity] = useState("Any");
  const [libraryQuality, setLibraryQuality] = useState("Any");
  const [libraryWeapon, setLibraryWeapon] = useState("Any");
  const [libraryMultiSelect, setLibraryMultiSelect] = useState(false);
  const [librarySelection, setLibrarySelection] = useState<
    Record<string, LibrarySelectionEntry>
  >({});
  const [libraryAddProgress, setLibraryAddProgress] = useState<{
    total: number;
    current: number;
  } | null>(null);
  const [wearPickerOpen, setWearPickerOpen] = useState(false);
  const [wearPickerOptions, setWearPickerOptions] = useState<SkinItem[]>([]);
  const [wearPickerSkin, setWearPickerSkin] = useState<SkinItem | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    itemId: string;
  } | null>(null);
  const [attributesOpen, setAttributesOpen] = useState(false);
  const [inspectOpen, setInspectOpen] = useState(false);

  useEffect(() => {
    if (!addStatus) return;
    const timer = window.setTimeout(() => setAddStatus(null), 1200);
    return () => window.clearTimeout(timer);
  }, [addStatus]);

  useEffect(() => {
    let mounted = true;

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

      fetch(urls.graffiti)
        .then((response) => response.json())
        .then((data) => {
          if (!mounted) return;
          setGraffitiItems(data as GraffitiItem[]);
          setGraffitiLoaded(true);
        })
        .catch(() => {
          if (mounted) {
            setStatus("Failed to load graffiti list.");
          }
        }),
    ];

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
    if (
      skinsLoaded &&
      knifeSkinsLoaded &&
      stickersLoaded &&
      graffitiLoaded &&
      collectiblesLoaded &&
      musicKitsLoaded
    )
      return;
    let mounted = true;
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

    // Stickers are now loaded eagerly in the initial useEffect, not lazily

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

    return () => {
      mounted = false;
    };
  }, [
    activePage,
    skinsLoaded,
    knifeSkinsLoaded,
    stickersLoaded,
    graffitiLoaded,
    collectiblesLoaded,
    musicKitsLoaded,
  ]);

  useEffect(() => {
    if (!libraryMultiSelect) {
      setLibrarySelection({});
    }
  }, [libraryMultiSelect]);

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

  const stickerIndex = useMemo(() => {
    const map = new Map<string, StickerItem>();
    stickerItems.forEach((sticker) => {
      const key = sticker.sticker_index || sticker.id;
      if (!key) return;
      map.set(String(key), sticker);
    });
    return map;
  }, [stickerItems]);

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

  const graffitiByDefIndex = useMemo(() => {
    const map = new Map<string, GraffitiItem>();
    graffitiItems.forEach((item) => {
      if (!item.def_index) return;
      map.set(String(item.def_index), item);
    });
    return map;
  }, [graffitiItems]);

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
    allSkins.forEach((skin: any) => {
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

  const getGraffitiForItem = (item: InventoryItem) => {
    if (!GRAFFITI_DEF_INDEXES.has(item.def_index)) return null;
    const graffitiId = item.attributes[GRAFFITI_ATTRIBUTE_ID]?.trim() ?? "";
    if (!graffitiId) return null;
    return graffitiByDefIndex.get(graffitiId) ?? null;
  };

  const stickersByIndex = useMemo(() => {
    const map = new Map<string, StickerItem>();
    const numericIdMap = new Map<string, any>();
    
    stickerItems.forEach((sticker: any) => {
      // Try to find numeric ID in the raw sticker object
      let numericId: string | null = null;
      
      // Check for common numeric ID field names (will be revealed by console log)
      for (const field of ['id', 'sticker_index', 'rarity', 'unique_id', 'skin_id', 'collectible_id']) {
        const val = sticker[field];
        if (val !== null && val !== undefined) {
          const numStr = String(val);
          // If it's a number-like string, use it
          if (/^\d+$/.test(numStr)) {
            numericId = numStr;
            break;
          }
        }
      }
      
      // Try to extract numeric part from sticker-XXXX format
      if (!numericId && sticker.id && typeof sticker.id === 'string') {
        const match = sticker.id.match(/^sticker-(\d+)$/);
        if (match) {
          numericId = match[1];
        }
      }
      
      // Store by multiple keys
      const stringKey = sticker.id;
      if (stringKey) map.set(String(stringKey), sticker);
      if (numericId) {
        map.set(numericId, sticker);
        numericIdMap.set(numericId, sticker.id);
      }
    });
    

    return map;
  }, [stickerItems]);

  const skinGroups = useMemo(() => {
    const map = new Map<string, SkinItem[]>();
    allSkins.forEach((skin: any) => {
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
    return Array.from(skinGroups.values()).map((list: any) => {
      return (
        list.find((skin: any) =>
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
  const isCrate = cratesDefIndexSet.has(selectedDefIndex);
  const isKey = keysDefIndexSet.has(selectedDefIndex);
  const isGraffitiItem = GRAFFITI_DEF_INDEXES.has(selectedDefIndex);
  const isSkinItem = isWeapon || isKnife || isGlove;
  const isStickerItem = selectedDefIndex === STICKER_DEF_INDEX;
  const selectedAgent = selectedItem
    ? agentsIndex.get(selectedItem.def_index)
    : null;
  const selectedMusicKit = selectedItem
    ? getMusicKitForItem(selectedItem)
    : null;
  const selectedGraffiti = selectedItem
    ? getGraffitiForItem(selectedItem)
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
    // Items changed, images may need updating
    // Component will refetch if needed via src changes
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
      } else if (activeFilter === "crates") {
        baseMatch = cratesDefIndexSet.has(item.def_index);
      } else if (activeFilter === "keys") {
        baseMatch = keysDefIndexSet.has(item.def_index);
      } else if (activeFilter === "stickers") {
        baseMatch = item.def_index === STICKER_DEF_INDEX;
      } else if (activeFilter === "graffiti") {
        baseMatch = GRAFFITI_DEF_INDEXES.has(item.def_index);
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
      const graffiti = getGraffitiForItem(item);
      const collectible = collectiblesByDefIndex.get(item.def_index) ?? null;
      const name = getDisplayName(
        item,
        baseWeaponIndex,
        skinMatch,
        agent,
        sticker,
        graffiti,
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
    graffitiByDefIndex,
    musicKitsByDefIndex,
  ]);

  useEffect(() => {
    const handleClose = () => setContextMenu(null);
    window.addEventListener("click", handleClose);
    return () => window.removeEventListener("click", handleClose);
  }, []);

  const handleLoad = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".txt";

    input.onchange = (event) => {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target.result;
          const parsed = parseInventory(content as string);

          setInventoryDoc(parsed);
          setFilePath(file.name);
          setSelectedId(parsed.items[0]?.id ?? null);
          setStatus(`Loaded ${parsed.items.length} items.`);
        } catch (err) {
          console.error(err);
          setStatus("Failed to load inventory.");
        }
      };

      reader.readAsText(file);
    };

    input.click();
  };

  const handleSave = () => {
    const content = serializeInventory(inventoryDoc);

    const blob = new Blob([content], { type: "text/plain" }); // adjust MIME type if needed

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);

    link.download = filePath ?? "inventory.txt";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(link.href);

    setStatus("Inventory saved.");
  };

  const handleAdd = () => {
    try {
      const nextId = String(
        items.reduce(
          (max: any, item: any) => Math.max(max, Number(item.id) || 0),
          0,
        ) + 1,
      );
      const newItem = getDefaultItem(nextId);
      setInventoryDoc({
        ...inventoryDoc,
        items: [...items, newItem],
      });
      setSelectedId(nextId);
      setAddStatus({
        message: `Item ${nextId} added to inventory.`,
        tone: "success",
      });
    } catch (error) {
      console.error(error);
      setAddStatus({
        message: "Failed to add item to inventory.",
        tone: "error",
      });
    }
  };

  const handleRemove = () => {
    if (!selectedItem) return;
    const nextItems = items.filter((item: any) => item.id !== selectedItem.id);
    setInventoryDoc({ ...inventoryDoc, items: nextItems });
    setSelectedId(nextItems[0]?.id ?? null);
  };

  const updateItem = (updated: InventoryItem) => {
    setInventoryDoc({
      ...inventoryDoc,
      items: items.map((item: any) =>
        item.id === updated.id ? updated : item,
      ),
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
    setLibrarySelection((prev: any) => {
      if (prev[key]) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: entry };
    });
  };

  const addSelectedLibraryItems = () => {
    const selected: any = Object.values(librarySelection);
    if (selected.length === 0) {
      setAddStatus({
        message: "Failed to add: no library items selected.",
        tone: "error",
      });
      return;
    }
    setLibraryAddProgress({ total: selected.length, current: 0 });
    setStatus(
      `Adding ${selected.length} item${selected.length === 1 ? "" : "s"}...`,
    );

    let nextId =
      items.reduce(
        (max: any, item: any) => Math.max(max, Number(item.id) || 0),
        0,
      ) + 1;
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
        const stickerIndex = entry.item.id.replace("sticker-", "");
        if (!stickerIndex) {
          console.warn(`Sticker "${entry.item.name}" has no id`);
        }
        newItem.attributes["113"] = stickerIndex || "0";
        newItem.rarity = STICKER_RARITY_ID;
        newItem.quality = STICKER_QUALITY_ID;
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
      } else if (entry.kind === "graffiti") {
        newItem = getDefaultItem(String(nextId++));
        newItem.def_index = GRAFFITI_DEFAULT_DEF_INDEX;
        if (entry.item.def_index) {
          newItem.attributes[GRAFFITI_ATTRIBUTE_ID] = entry.item.def_index;
        }
        newItem.attributes[GRAFFITI_TINT_ATTRIBUTE_ID] =
          newItem.attributes[GRAFFITI_TINT_ATTRIBUTE_ID] ?? "0";
        newItem.attributes[GRAFFITI_USES_ATTRIBUTE_ID] =
          newItem.attributes[GRAFFITI_USES_ATTRIBUTE_ID] ?? "50";
        const rarityId = getRarityIdFromName(entry.item.rarity?.name);
        newItem.rarity = rarityId ?? DEFAULT_RARITY_ID;
        newItem.quality = GRAFFITI_QUALITY_ID;
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
      setAddStatus({
        message: `Successfully added ${addedCount} item${addedCount === 1 ? "" : "s"}.`,
        tone: "success",
      });
    } else {
      setAddStatus({
        message: "Failed to add selected library items.",
        tone: "error",
      });
    }
    setLibrarySelection({});
    setLibraryAddProgress(null);
  };

  const updateField = (key: keyof InventoryItem, value: string) => {
    if (!selectedItem) return;
    updateItem({ ...selectedItem, [key]: value });
  };

  const updateAttribute = (attrId: string, value: string) => {
    if (!selectedItem) return;
    const attributes = { ...selectedItem.attributes };
    const cleanedValue = value ? value.trim() : "";
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
    selectedGraffiti ??
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
        selectedGraffiti,
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
    const graffiti = items.filter((item) =>
      GRAFFITI_DEF_INDEXES.has(item.def_index),
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
      graffiti,
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
    try {
      const nextId = String(
        items.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) +
          1,
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
      setAddStatus({
        message: `Added ${skin.name}.`,
        tone: "success",
      });
    } catch (error) {
      console.error(error);
      setAddStatus({
        message: `Failed to add ${skin.name}.`,
        tone: "error",
      });
    }
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
    try {
      const nextId = String(
        items.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) +
          1,
      );
      const newItem = getDefaultItem(nextId);
      newItem.def_index = STICKER_DEF_INDEX;
      const stickerIndex = sticker.id?.replace("sticker-", "");
      if (!stickerIndex) {
        console.warn(`Sticker "${sticker.name}" has no id`);
      }
      newItem.attributes["113"] = stickerIndex || "0";
      newItem.rarity = STICKER_RARITY_ID;
      newItem.quality = STICKER_QUALITY_ID;
      setInventoryDoc({
        ...inventoryDoc,
        items: [...items, newItem],
      });
      setSelectedId(nextId);
      setAddStatus({
        message: `Added sticker item: ${sticker.name}.`,
        tone: "success",
      });
    } catch (error) {
      console.error(error);
      setAddStatus({
        message: `Failed to add sticker: ${sticker.name}.`,
        tone: "error",
      });
    }
  };

  const addAgentFromLibrary = (agent: AgentItem) => {
    try {
      const nextId = String(
        items.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) +
          1,
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
      setAddStatus({
        message: `Added ${agent.name}.`,
        tone: "success",
      });
    } catch (error) {
      console.error(error);
      setAddStatus({
        message: `Failed to add ${agent.name}.`,
        tone: "error",
      });
    }
  };

  const addContainerFromLibrary = (container: ApiItem) => {
    try {
      const nextId = String(
        items.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) +
          1,
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
      setAddStatus({
        message: `Added ${container.name ?? "item"}.`,
        tone: "success",
      });
    } catch (error) {
      console.error(error);
      setAddStatus({
        message: `Failed to add ${container.name ?? "item"}.`,
        tone: "error",
      });
    }
  };

  const addCollectibleFromLibrary = (collectible: CollectibleItem) => {
    try {
      const nextId = String(
        items.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) +
          1,
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
      setAddStatus({
        message: `Added ${collectible.name ?? "collectible"}.`,
        tone: "success",
      });
    } catch (error) {
      console.error(error);
      setAddStatus({
        message: `Failed to add ${collectible.name ?? "collectible"}.`,
        tone: "error",
      });
    }
  };

  const addMusicKitFromLibrary = (kit: MusicKitItem) => {
    try {
      const nextId = String(
        items.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) +
          1,
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
      setAddStatus({
        message: `Added ${kit.name ?? "music kit"}.`,
        tone: "success",
      });
    } catch (error) {
      console.error(error);
      setAddStatus({
        message: `Failed to add ${kit.name ?? "music kit"}.`,
        tone: "error",
      });
    }
  };

  const addGraffitiFromLibrary = (graffiti: GraffitiItem) => {
    try {
      const nextId = String(
        items.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) +
          1,
      );
      const newItem = getDefaultItem(nextId);
      newItem.def_index = GRAFFITI_DEFAULT_DEF_INDEX;
      if (graffiti.def_index) {
        newItem.attributes[GRAFFITI_ATTRIBUTE_ID] = graffiti.def_index;
      }
      newItem.attributes[GRAFFITI_TINT_ATTRIBUTE_ID] =
        newItem.attributes[GRAFFITI_TINT_ATTRIBUTE_ID] ?? "0";
      newItem.attributes[GRAFFITI_USES_ATTRIBUTE_ID] =
        newItem.attributes[GRAFFITI_USES_ATTRIBUTE_ID] ?? "50";
      const rarityId = getRarityIdFromName(graffiti.rarity?.name);
      newItem.rarity = rarityId ?? DEFAULT_RARITY_ID;
      newItem.quality = GRAFFITI_QUALITY_ID;
      setInventoryDoc({
        ...inventoryDoc,
        items: [...items, newItem],
      });
      setSelectedId(nextId);
      setAddStatus({
        message: `Added ${graffiti.name ?? "graffiti"}.`,
        tone: "success",
      });
    } catch (error) {
      console.error(error);
      setAddStatus({
        message: `Failed to add ${graffiti.name ?? "graffiti"}.`,
        tone: "error",
      });
    }
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
      if (isKukriWeaponName(weapon.name)) return false;
      return matchesSearch(`${weapon.name ?? ""} ${weapon.def_index ?? ""}`);
    });
    const vanillaKnifeEntries = baseWeapons.filter((weapon) => {
      if (!(showAll || libraryTab === "knives")) return false;
      if (isKukriWeaponName(weapon.name)) return false;
      const defIndex = weapon.def_index ? String(weapon.def_index) : "";
      if (!knifeDefIndexSet.has(defIndex)) return false;
      if (defIndex === "42" || defIndex === "59") return false;
      return matchesSearch(`${weapon.name ?? ""} ${weapon.def_index ?? ""}`);
    });
    const skinEntries = librarySkins.filter((skin) => {
      if (isKukriSkinName(skin.name)) return false;
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
      if (!matchesPopularity(sticker.name, sticker.rarity?.name)) return false;
      if (!matchesRarity(sticker.rarity?.name)) return false;
      return matchesSearch(`${sticker.name} ${sticker.sticker_index}`);
    });

    const graffitiEntries = graffitiItems.filter((graffiti) => {
      if (!(showAll || libraryTab === "graffiti")) return false;
      if (!matchesPopularity(graffiti.name ?? "", graffiti.rarity?.name))
        return false;
      if (!matchesRarity(graffiti.rarity?.name)) return false;
      return matchesSearch(`${graffiti.name ?? ""} ${graffiti.def_index ?? ""}`);
    });

    const agentEntries = agentItems.filter((agent) => {
      if (!(showAll || libraryTab === "agents")) return false;
      if (!matchesPopularity(agent.name, agent.rarity?.name)) return false;
      if (!matchesRarity(agent.rarity?.name)) return false;
      return matchesSearch(`${agent.name} ${agent.def_index}`);
    });

    const caseEntries = crateItems.filter((crate) => {
      if (!(showAll || libraryTab === "cases")) return false;
      return matchesSearch(`${crate.name ?? ""} ${crate.def_index ?? ""}`);
    });

    const keyEntries = keyItems.filter((key) => {
      if (!(showAll || libraryTab === "keys")) return false;
      return matchesSearch(`${key.name ?? ""} ${key.def_index ?? ""}`);
    });

    const musicKitEntries = musicKitItems.filter((kit) => {
      if (!(showAll || libraryTab === "music")) return false;
      if (!matchesPopularity(kit.name ?? "", kit.rarity?.name)) return false;
      if (!matchesRarity(kit.rarity?.name)) return false;
      if (!matchesMusicKitQuality(kit)) return false;
      return matchesSearch(`${kit.name ?? ""} ${kit.def_index ?? ""}`);
    });

    const collectibleEntries = collectibleItems.filter((collectible) => {
      if (!(showAll || libraryTab === "collectibles")) return false;
      if (isPremierCollectible(collectible)) return false;
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
      graffitiEntries,
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
    librarySkins,
    stickerItems,
    graffitiItems,
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
    graffitiEntries,
    agentEntries,
    caseEntries,
    keyEntries,
    musicKitEntries,
    collectibleEntries,
  } = libraryEntries;

  const selectedLibraryCount = Object.keys(librarySelection).length;

  return (
    <div className="app">
      <div className="app__header">
        <div className="tabs">
          <button
            className={`tab-button ${activePage === "inventory" ? "is-active" : ""}`}
            onClick={() => setActivePage("inventory")}
          >
            Inventory
          </button>
          <button
            className={`tab-button ${activePage === "library" ? "is-active" : ""}`}
            onClick={() => setActivePage("library")}
          >
            Library
          </button>
        </div>
      </div>

      <div className="app__body">

        <main
          className={`app__main mainmenu-content__container mainmenu-content__container--inventory ${
            activePage === "inventory" ? "app__main--inventory" : ""
          }`}
        >
          {activePage === "inventory" && (
            <section className="panel panel--library">
                  <div className="dock-bar">
                    <button className="btn btn--load" onClick={handleLoad}>
                      Load
                    </button>
                    <button className="btn btn--save" onClick={handleSave}>
                      Save
                    </button>
                    <button className="btn btn--add" onClick={handleAdd}>
                      Add
                    </button>
                    <button
                      className="btn btn--remove"
                      onClick={handleRemove}
                      disabled={!selectedItem}
                    >
                      Remove
                    </button>
                  </div>
                  <div className="inventory-toolbar">
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
                          className={`chip chip--filter-${option.id} ${activeFilter === option.id ? "is-active" : ""}`}
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
                    {filteredItems.map((item) => {
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
                      const graffiti = getGraffitiForItem(item);
                      const collectible =
                        collectiblesByDefIndex.get(item.def_index) ?? null;
                      const rarityName =
                        match?.rarity?.name ??
                        agent?.rarity?.name ??
                        graffiti?.rarity?.name ??
                        musicKit?.rarity?.name ??
                        collectible?.rarity?.name ??
                        undefined;
                      const rarityColor = getRarityColor(
                        match?.rarity ??
                          agent?.rarity ??
                          graffiti?.rarity ??
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
                        graffiti,
                        musicKit,
                        collectible,
                      );
                      const image = getPreviewImage(
                        item,
                        match ??
                          agent ??
                          sticker ??
                          graffiti ??
                          musicKit ??
                          collectible,
                        baseWeaponIndex,
                        crateIndex,
                        keyIndex,
                        match,
                        agent,
                      );
                      const appliedStickers = getStickerSlots(item, stickersByIndex);
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
                              src={image}
                              alt={name}
                              className="item-tile__image"
                            />
                            {appliedStickers.some((s) => s) && (
                              <div className="item-tile__stickers">
                                {appliedStickers.map((sticker, index) =>
                                  sticker ? (
                                    <CachedImage
                                      key={index}
                                      src={sticker.image}
                                      alt={sticker.name}
                                      className={`item-tile__sticker item-tile__sticker--slot-${index}`}
                                    />
                                  ) : null,
                                )}
                              </div>
                            )}
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
                              ID {item.id} DEF {item.def_index}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
            </section>
          )}

          {activePage === "library" && (
            <section className="panel panel--library">
              <div className="panel__header content-navbar">
                <span className="hint">
                </span>
                <div className="library-tabs content-navbar__tabs">
                  {options.libraryType.map((tab) => (
                    <button
                      key={tab}
                      className={`chip chip--library-${tab} ${libraryTab === tab ? "is-active" : ""}`}
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
                      className={`chip chip--scope-${option.id} ${libraryFilter === option.id ? "is-active" : ""}`}
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
                        ...def_index.crates,
                        ...def_index.keys,
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
                      <div
                        className="rarity-bar"
                        style={{
                          backgroundColor: getRarityColor(sticker.rarity),
                        }}
                      />
                      <div className="library-card__meta">
                        <strong className="item-tile__name">
                          {sticker.name}
                        </strong>
                        <span className="item-tile__meta">
                          {sticker.rarity?.name || "Sticker"}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {graffitiEntries.map((graffiti) => {
                  const selectionKey = `graffiti:${graffiti.id}`;
                  const isSelected = Boolean(librarySelection[selectionKey]);
                  const handleSelect = () =>
                    toggleLibrarySelection(selectionKey, {
                      kind: "graffiti",
                      item: graffiti,
                    });
                  return (
                    <div
                      key={graffiti.id}
                      className={`library-card item-tile ${isSelected ? "is-selected" : ""}`}
                    >
                      <button
                        className="library-card__add"
                        type="button"
                        onClick={() =>
                          libraryMultiSelect
                            ? handleSelect()
                            : addGraffitiFromLibrary(graffiti)
                        }
                      >
                        +
                      </button>
                      <div
                        className="library-card__thumb item-tile__bg is-clickable"
                        onClick={() =>
                          libraryMultiSelect
                            ? handleSelect()
                            : addGraffitiFromLibrary(graffiti)
                        }
                      >
                        <CachedImage
                          src={graffiti.image}
                          alt={graffiti.name ?? "Graffiti"}
                          className="item-tile__image"
                        />
                      </div>
                      <div
                        className="rarity-bar"
                        style={{
                          backgroundColor: getRarityColor(graffiti.rarity),
                        }}
                      />
                      <div className="library-card__meta">
                        <strong className="item-tile__name">
                          {graffiti.name ?? "Graffiti"}
                        </strong>
                        {graffiti.def_index && (
                          <span className="item-tile__meta">
                            Graffiti {graffiti.def_index}
                          </span>
                        )}
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
        </main>
      </div>

      <footer className="app__footer">
        <span
          className={`footer-status${addStatus ? ` footer-status--${addStatus.tone}` : ""}`}
        >
          {addStatus?.message ?? status ?? "Ready."}
        </span>
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
                  src={previewImage}
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
                    src={previewImage}
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
                            : isGraffitiItem
                              ? "Graffiti"
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
