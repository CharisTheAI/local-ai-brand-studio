"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Edit3,
  FolderPlus,
  ImagePlus,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

type AspectRatio = "1:1" | "16:9" | "9:16";
type RenderQuality = "low" | "medium" | "high";
type LibraryCategory =
  | "backgrounds"
  | "character-sheets"
  | "character-scenes"
  | "characters"
  | "badges"
  | "textures-patterns"
  | "logo";
type TextPresetKind = "prompt-starters" | "camera-framing" | "pose-action";

type LibraryAsset = {
  id: string;
  title: string;
  src: string;
  notes: string;
  category: LibraryCategory;
};

type PendingLibraryAsset = LibraryAsset;

type AssetCollection = {
  id: string;
  name: string;
  assets: LibraryAsset[];
};

type TextPreset = {
  id: string;
  title: string;
  text: string;
};

type GeneratedImage = {
  id: string;
  dataUrl: string;
  createdAt: string;
  width: number;
  height: number;
  model?: string;
  correctionApplied?: boolean;
  qaModel?: string;
  qaError?: string | null;
  qa?: {
    pass: boolean;
    issues: string[];
    summary?: string;
  } | null;
};

type AssetBrowserItem = LibraryAsset & {
  collectionId: string;
  collectionName: string;
  order: number;
};

type AssetEditorDraft = {
  id: string;
  title: string;
  src: string;
  notes: string;
  category: LibraryCategory;
  collectionId: string;
  collectionName: string;
};

type TextAssetKind = "prompt-starters" | "camera-framing" | "pose-action";

type TextBrowserItem = TextPreset & {
  kind: TextAssetKind;
  kindLabel: string;
  order: number;
};

type TextEditorDraft = {
  id: string;
  title: string;
  text: string;
  kind: TextAssetKind;
  originalKind: TextAssetKind;
};

type PendingTextAsset = {
  id: string;
  title: string;
  text: string;
  kind: TextPresetKind;
};

type AssetSortMode = "newest" | "title-asc" | "title-desc" | "category";

type SavedLibrary = {
  version: 1;
  assetCollections: AssetCollection[];
  promptStarters: TextPreset[];
  cameraFramingPresets: TextPreset[];
  poseActionPresets: TextPreset[];
};

type SavedWorkspace = {
  version: 5;
  activeCollectionId: string;
  pendingTextAssets: PendingTextAsset[];
  selectedPromptStarterId: string;
  selectedCameraPresetId: string;
  selectedPosePresetId: string;
  selectedBackgroundIds: string[];
  selectedCharacterSheetIds: string[];
  selectedCharacterIds: string[];
  selectedVisualReferenceIds: string[];
  aspectRatio: AspectRatio;
  quality: RenderQuality;
  scenePrompt: string;
  posePrompt: string;
  uploadCategory: LibraryCategory;
  pendingAssets: PendingLibraryAsset[];
  generatedImages: GeneratedImage[];
  savedAt: string;
};

const libraryCategories: { value: LibraryCategory; label: string }[] = [
  { value: "backgrounds", label: "Backgrounds" },
  { value: "character-sheets", label: "Character Sheets" },
  { value: "character-scenes", label: "Character Scenes" },
  { value: "characters", label: "Characters" },
  { value: "badges", label: "Badges" },
  { value: "textures-patterns", label: "Textures & Patterns" },
  { value: "logo", label: "Logo" },
];

const DEFAULT_COLLECTION_ID = "default-collection";
const DEFAULT_COLLECTION_NAME = "Main Kit";
const DEFAULT_NEGATIVE_PROMPT =
  "No fifth finger, no extra fingers, no missing fingers, no fused fingers, no distorted hands, no broken anatomy, no duplicated limbs, no added nose, no extra mouth details, no changed eye design.";

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function getDefaultCollection(): AssetCollection {
  return {
    id: DEFAULT_COLLECTION_ID,
    name: DEFAULT_COLLECTION_NAME,
    assets: [],
  };
}

function getDefaultPromptStarters(): TextPreset[] {
  return [
    {
      id: createId("prompt"),
      title: "Launch Hype",
      text: "Cinematic GVC hero image with premium energy, crisp composition, and bold collector appeal.",
    },
  ];
}

function getDefaultCameraPresets(): TextPreset[] {
  return [
    { id: createId("camera"), title: "Full Body Hero", text: "Full body hero shot" },
    { id: createId("camera"), title: "Wide Scene", text: "Wide environmental scene" },
    { id: createId("camera"), title: "Portrait Focus", text: "Portrait-forward composition" },
  ];
}

function getDefaultPosePresets(): TextPreset[] {
  return [
    { id: createId("pose"), title: "Confident Stance", text: "Confident full-body stance with clear readable hands." },
  ];
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getExportProfile(aspectRatio: AspectRatio, quality: RenderQuality) {
  if (aspectRatio === "16:9") {
    if (quality === "low") return { label: "1K", width: 1280, height: 720 };
    if (quality === "medium") return { label: "2K", width: 2560, height: 1440 };
    return { label: "4K", width: 3840, height: 2160 };
  }

  if (aspectRatio === "9:16") {
    if (quality === "low") return { label: "1K", width: 720, height: 1280 };
    if (quality === "medium") return { label: "2K", width: 1440, height: 2560 };
    return { label: "4K", width: 2160, height: 3840 };
  }

  if (quality === "low") return { label: "1K", width: 1024, height: 1024 };
  if (quality === "medium") return { label: "2K", width: 2048, height: 2048 };
  return { label: "4K", width: 4096, height: 4096 };
}

function resizeDataUrlToOutput(dataUrl: string, width: number, height: number) {
  return new Promise<string>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");

      if (!context) {
        reject(new Error("Canvas unavailable"));
        return;
      }

      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(image, 0, 0, width, height);
      resolve(canvas.toDataURL("image/png"));
    };
    image.onerror = () => reject(new Error("Could not resize image"));
    image.src = dataUrl;
  });
}

async function readWorkspaceFromDb() {
  const response = await fetch("/api/workspace", {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Workspace load failed.");
  }

  return (await response.json()) as SavedWorkspace | null;
}

async function readLibraryFromDb() {
  const response = await fetch("/api/library", {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Library load failed.");
  }

  return (await response.json()) as SavedLibrary | null;
}

async function writeWorkspaceToDb(payload: SavedWorkspace) {
  const response = await fetch("/api/workspace", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: "Workspace save failed." }));
    throw new Error(data.error || "Workspace save failed.");
  }
}

async function writeLibraryToDb(payload: SavedLibrary) {
  const response = await fetch("/api/library", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: "Library save failed." }));
    throw new Error(data.error || "Library save failed.");
  }
}

async function clearWorkspaceFromDb() {
  const response = await fetch("/api/workspace", {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Workspace clear failed.");
  }
}

function coerceLibrary(saved: Partial<SavedLibrary> | null): SavedLibrary {
  const assetCollections =
    saved?.assetCollections?.length
      ? saved.assetCollections
      : [getDefaultCollection()];

  const promptStarters =
    saved?.promptStarters?.length ? saved.promptStarters : getDefaultPromptStarters();
  const cameraFramingPresets =
    saved?.cameraFramingPresets?.length ? saved.cameraFramingPresets : getDefaultCameraPresets();
  const poseActionPresets =
    saved?.poseActionPresets?.length ? saved.poseActionPresets : getDefaultPosePresets();

  return {
    version: 1,
    assetCollections,
    promptStarters,
    cameraFramingPresets,
    poseActionPresets,
  };
}

function coerceWorkspace(saved: Partial<SavedWorkspace> | null, library: SavedLibrary): SavedWorkspace {
  return {
    version: 5,
    activeCollectionId:
      library.assetCollections.find((collection) => collection.id === saved?.activeCollectionId)?.id ||
      library.assetCollections[0]?.id ||
      DEFAULT_COLLECTION_ID,
    pendingTextAssets: saved?.pendingTextAssets || [],
    selectedPromptStarterId:
      library.promptStarters.find((preset) => preset.id === saved?.selectedPromptStarterId)?.id || "",
    selectedCameraPresetId:
      library.cameraFramingPresets.find((preset) => preset.id === saved?.selectedCameraPresetId)?.id || "",
    selectedPosePresetId:
      library.poseActionPresets.find((preset) => preset.id === saved?.selectedPosePresetId)?.id || "",
    selectedBackgroundIds: saved?.selectedBackgroundIds || [],
    selectedCharacterSheetIds: saved?.selectedCharacterSheetIds || [],
    selectedCharacterIds: saved?.selectedCharacterIds || [],
    selectedVisualReferenceIds: saved?.selectedVisualReferenceIds || [],
    aspectRatio:
      saved?.aspectRatio === "1:1" || saved?.aspectRatio === "16:9" || saved?.aspectRatio === "9:16"
        ? saved.aspectRatio
        : "1:1",
    quality:
      saved?.quality === "low" || saved?.quality === "medium" || saved?.quality === "high"
        ? saved.quality
        : "medium",
    scenePrompt: saved?.scenePrompt || "",
    posePrompt: saved?.posePrompt || "",
    uploadCategory:
      libraryCategories.find((category) => category.value === saved?.uploadCategory)?.value || "backgrounds",
    pendingAssets: [],
    generatedImages: saved?.generatedImages || [],
    savedAt: saved?.savedAt || new Date().toISOString(),
  };
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

function toggleSelection(current: string[], id: string) {
  return current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id];
}

function normalizeSearchText(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function sortPresetsForDropdown<T extends { title: string }>(items: T[]) {
  return [...items].sort((left, right) =>
    left.title.localeCompare(right.title, undefined, {
      numeric: true,
      sensitivity: "base",
    })
  );
}

export default function Home() {
  const [activeCollectionId, setActiveCollectionId] = useState(DEFAULT_COLLECTION_ID);
  const [assetCollections, setAssetCollections] = useState<AssetCollection[]>([getDefaultCollection()]);
  const [promptStarters, setPromptStarters] = useState<TextPreset[]>(getDefaultPromptStarters());
  const [cameraFramingPresets, setCameraFramingPresets] = useState<TextPreset[]>(getDefaultCameraPresets());
  const [poseActionPresets, setPoseActionPresets] = useState<TextPreset[]>(getDefaultPosePresets());
  const [pendingTextAssets, setPendingTextAssets] = useState<PendingTextAsset[]>([]);
  const [selectedPromptStarterId, setSelectedPromptStarterId] = useState("");
  const [selectedCameraPresetId, setSelectedCameraPresetId] = useState("");
  const [selectedPosePresetId, setSelectedPosePresetId] = useState("");
  const [selectedBackgroundIds, setSelectedBackgroundIds] = useState<string[]>([]);
  const [selectedCharacterSheetIds, setSelectedCharacterSheetIds] = useState<string[]>([]);
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<string[]>([]);
  const [selectedVisualReferenceIds, setSelectedVisualReferenceIds] = useState<string[]>([]);
  const [referenceSearchQuery, setReferenceSearchQuery] = useState("");
  const [referenceCategoryFilter, setReferenceCategoryFilter] = useState<string>("");
  const [referenceCollectionFilterId, setReferenceCollectionFilterId] = useState<string>("");
  const [referenceSort, setReferenceSort] = useState<AssetSortMode>("newest");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
  const [quality, setQuality] = useState<RenderQuality>("medium");
  const [scenePrompt, setScenePrompt] = useState("");
  const [posePrompt, setPosePrompt] = useState("");
  const [uploadCategory, setUploadCategory] = useState<LibraryCategory>("backgrounds");
  const [pendingAssets, setPendingAssets] = useState<PendingLibraryAsset[]>([]);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [assetSearchQuery, setAssetSearchQuery] = useState("");
  const [assetFilterCategory, setAssetFilterCategory] = useState<string>("");
  const [assetFilterCollectionId, setAssetFilterCollectionId] = useState<string>("");
  const [assetSort, setAssetSort] = useState<AssetSortMode>("newest");
  const [editingAssetDraft, setEditingAssetDraft] = useState<AssetEditorDraft | null>(null);
  const [textAssetSearchQuery, setTextAssetSearchQuery] = useState("");
  const [textAssetFilterKind, setTextAssetFilterKind] = useState<string>("");
  const [textAssetSort, setTextAssetSort] = useState<"newest" | "title-asc" | "title-desc" | "type">("newest");
  const [editingTextDraft, setEditingTextDraft] = useState<TextEditorDraft | null>(null);
  const [expandedGeneratedImage, setExpandedGeneratedImage] = useState<GeneratedImage | null>(null);
  const [isAssetDropActive, setIsAssetDropActive] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isLibraryHydrated, setIsLibraryHydrated] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [libraryLoadFailed, setLibraryLoadFailed] = useState(false);

  const assetUploadRef = useRef<HTMLInputElement | null>(null);
  const saveDebounceRef = useRef<number | null>(null);
  const librarySaveDebounceRef = useRef<number | null>(null);

  const activeCollection =
    assetCollections.find((collection) => collection.id === activeCollectionId) || assetCollections[0];
  const libraryAssets = activeCollection?.assets || [];
  const exportProfile = getExportProfile(aspectRatio, quality);

  const selectedPromptStarter = promptStarters.find((preset) => preset.id === selectedPromptStarterId) || null;
  const selectedCameraPreset = cameraFramingPresets.find((preset) => preset.id === selectedCameraPresetId) || null;
  const selectedPosePreset = poseActionPresets.find((preset) => preset.id === selectedPosePresetId) || null;
  const sortedPromptStarters = useMemo(() => sortPresetsForDropdown(promptStarters), [promptStarters]);

  const assetsByCategory = useMemo(
    () =>
      libraryCategories.map((category) => ({
        ...category,
        assets: libraryAssets.filter((asset) => asset.category === category.value),
      })),
    [libraryAssets]
  );

  const allSavedAssets = useMemo<AssetBrowserItem[]>(
    () =>
      assetCollections.flatMap((collection) =>
        collection.assets.map((asset, index) => ({
          ...asset,
          collectionId: collection.id,
          collectionName: collection.name,
          order: index,
        }))
      ),
    [assetCollections]
  );

  const backgroundAssets = allSavedAssets.filter((asset) => asset.category === "backgrounds");
  const characterSheetAssets = allSavedAssets.filter((asset) => asset.category === "character-sheets");
  const characterAssets = allSavedAssets.filter((asset) => asset.category === "characters");
  const visualInfluenceAssets = allSavedAssets.filter(
    (asset) =>
      asset.category !== "backgrounds" &&
      asset.category !== "character-sheets" &&
      asset.category !== "characters"
  );
  const combinedCharacterAssets = [...characterSheetAssets, ...characterAssets];
  const combinedVisualInfluenceAssets = [...backgroundAssets, ...visualInfluenceAssets];

  const selectedBackgroundAssets = backgroundAssets.filter((asset) => selectedBackgroundIds.includes(asset.id));
  const selectedCharacterSheetAssets = characterSheetAssets.filter((asset) =>
    selectedCharacterSheetIds.includes(asset.id)
  );
  const selectedCharacterAssets = characterAssets.filter((asset) => selectedCharacterIds.includes(asset.id));
  const selectedVisualAssets = visualInfluenceAssets.filter((asset) =>
    selectedVisualReferenceIds.includes(asset.id)
  );
  const selectedAllVisualAssets = [
    ...selectedCharacterSheetAssets,
    ...selectedCharacterAssets,
    ...selectedBackgroundAssets,
    ...selectedVisualAssets,
  ];

  function sortAssetItems(items: AssetBrowserItem[], sortMode: AssetSortMode) {
    return [...items].sort((left, right) => {
      if (sortMode === "newest") {
        return right.order - left.order;
      }
      if (sortMode === "title-desc") {
        return right.title.localeCompare(left.title);
      }
      if (sortMode === "category") {
        return left.category.localeCompare(right.category) || left.title.localeCompare(right.title);
      }
      return left.title.localeCompare(right.title);
    });
  }

  function filterReferenceAssets(assets: AssetBrowserItem[]) {
    const normalizedQuery = normalizeSearchText(referenceSearchQuery);

    const filtered = assets.filter((asset) => {
      const matchesCollection =
        !referenceCollectionFilterId || asset.collectionId === referenceCollectionFilterId;
      const matchesCategory = !referenceCategoryFilter || asset.category === referenceCategoryFilter;
      const matchesQuery =
        !normalizedQuery ||
        normalizeSearchText(asset.title).includes(normalizedQuery) ||
        normalizeSearchText(asset.notes).includes(normalizedQuery);

      return matchesCollection && matchesCategory && matchesQuery;
    });

    return sortAssetItems(filtered, referenceSort);
  }

  const filteredCombinedCharacterAssets = filterReferenceAssets(combinedCharacterAssets);
  const filteredCombinedVisualAssets = filterReferenceAssets(combinedVisualInfluenceAssets);

  const canGenerate =
    Boolean(scenePrompt.trim()) && selectedAllVisualAssets.length > 0;

  const generationChecks = [
    { label: "Main prompt", done: Boolean(scenePrompt.trim()) },
    { label: "Visual assets", done: selectedAllVisualAssets.length > 0 },
  ];

  const filteredSavedAssets = useMemo(() => {
    const normalizedQuery = normalizeSearchText(assetSearchQuery);
    const filtered = allSavedAssets.filter((asset) => {
      const normalizedTitle = normalizeSearchText(asset.title);
      const normalizedNotes = normalizeSearchText(asset.notes);
      const matchesQuery =
        !normalizedQuery ||
        normalizedTitle.includes(normalizedQuery) ||
        normalizedNotes.includes(normalizedQuery);
      const matchesCategory = !assetFilterCategory || asset.category === assetFilterCategory;
      const matchesCollection = !assetFilterCollectionId || asset.collectionId === assetFilterCollectionId;
      return matchesQuery && matchesCategory && matchesCollection;
    });

    return sortAssetItems(filtered, assetSort);
  }, [allSavedAssets, assetSearchQuery, assetFilterCategory, assetFilterCollectionId, assetSort]);

  const allTextAssets = useMemo<TextBrowserItem[]>(
    () => [
      ...promptStarters.map((preset, index) => ({
        ...preset,
        kind: "prompt-starters" as const,
        kindLabel: "Prompt Starters",
        order: index,
      })),
      ...cameraFramingPresets.map((preset, index) => ({
        ...preset,
        kind: "camera-framing" as const,
        kindLabel: "Camera Framing Presets",
        order: index,
      })),
      ...poseActionPresets.map((preset, index) => ({
        ...preset,
        kind: "pose-action" as const,
        kindLabel: "Pose & Action Presets",
        order: index,
      })),
    ],
    [promptStarters, cameraFramingPresets, poseActionPresets]
  );

  const filteredTextAssets = useMemo(() => {
    const normalizedQuery = textAssetSearchQuery.trim().toLowerCase();
    const filtered = allTextAssets.filter((asset) => {
      const matchesQuery =
        !normalizedQuery ||
        asset.title.toLowerCase().includes(normalizedQuery) ||
        asset.text.toLowerCase().includes(normalizedQuery);
      const matchesKind = !textAssetFilterKind || asset.kind === textAssetFilterKind;
      return matchesQuery && matchesKind;
    });

    return [...filtered].sort((left, right) => {
      if (textAssetSort === "newest") {
        return right.order - left.order;
      }
      if (textAssetSort === "title-desc") {
        return right.title.localeCompare(left.title);
      }
      if (textAssetSort === "type") {
        return left.kindLabel.localeCompare(right.kindLabel) || left.title.localeCompare(right.title);
      }
      return left.title.localeCompare(right.title);
    });
  }, [allTextAssets, textAssetSearchQuery, textAssetFilterKind, textAssetSort]);

  useEffect(() => {
    let ignore = false;

    void (async () => {
      const [libraryResult, workspaceResult] = await Promise.allSettled([
        readLibraryFromDb(),
        readWorkspaceFromDb(),
      ]);

      if (ignore) return;

      const library =
        libraryResult.status === "fulfilled"
          ? coerceLibrary(libraryResult.value)
          : coerceLibrary(null);

      const workspace =
        workspaceResult.status === "fulfilled"
          ? coerceWorkspace(workspaceResult.value, library)
          : coerceWorkspace(null, library);

      setAssetCollections(library.assetCollections);
      setPromptStarters(library.promptStarters);
      setCameraFramingPresets(library.cameraFramingPresets);
      setPoseActionPresets(library.poseActionPresets);

      setActiveCollectionId(workspace.activeCollectionId);
      setPendingTextAssets(workspace.pendingTextAssets);
      setSelectedPromptStarterId(workspace.selectedPromptStarterId);
      setSelectedCameraPresetId(workspace.selectedCameraPresetId);
      setSelectedPosePresetId(workspace.selectedPosePresetId);
      setSelectedBackgroundIds(workspace.selectedBackgroundIds);
      setSelectedCharacterSheetIds(workspace.selectedCharacterSheetIds);
      setSelectedCharacterIds(workspace.selectedCharacterIds);
      setSelectedVisualReferenceIds(workspace.selectedVisualReferenceIds);
      setAspectRatio(workspace.aspectRatio);
      setQuality(workspace.quality);
      setScenePrompt(workspace.scenePrompt);
      setPosePrompt(workspace.posePrompt);
      setUploadCategory(workspace.uploadCategory);
      setPendingAssets(workspace.pendingAssets);
      setGeneratedImages(workspace.generatedImages);

      setLibraryLoadFailed(libraryResult.status !== "fulfilled");
      setLoadFailed(workspaceResult.status !== "fulfilled");
      setIsLibraryHydrated(true);
      setIsHydrated(true);

      if (libraryResult.status !== "fulfilled") {
        toast.error("Library load failed. Library auto-save is paused to protect your saved data.");
      }

      if (workspaceResult.status !== "fulfilled") {
        toast.error("Workspace load failed. Workspace auto-save is paused to protect your saved data.");
      }
    })();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!isHydrated || loadFailed) return;

    if (saveDebounceRef.current) {
      window.clearTimeout(saveDebounceRef.current);
    }

    saveDebounceRef.current = window.setTimeout(() => {
      void writeWorkspaceToDb({
        version: 5,
        activeCollectionId,
        pendingTextAssets,
        selectedPromptStarterId,
        selectedCameraPresetId,
        selectedPosePresetId,
        selectedBackgroundIds,
        selectedCharacterSheetIds,
        selectedCharacterIds,
        selectedVisualReferenceIds,
        aspectRatio,
        quality,
        scenePrompt,
        posePrompt,
        uploadCategory,
        pendingAssets: [],
        generatedImages,
        savedAt: new Date().toISOString(),
      }).catch(() => toast.error("Could not save workspace locally."));
    }, 250);

    return () => {
      if (saveDebounceRef.current) {
        window.clearTimeout(saveDebounceRef.current);
      }
    };
  }, [
    isHydrated,
    activeCollectionId,
    pendingTextAssets,
    selectedPromptStarterId,
    selectedCameraPresetId,
    selectedPosePresetId,
    selectedBackgroundIds,
    selectedCharacterSheetIds,
    selectedCharacterIds,
    selectedVisualReferenceIds,
    aspectRatio,
    quality,
    scenePrompt,
    posePrompt,
    uploadCategory,
    pendingAssets,
    generatedImages,
  ]);

  useEffect(() => {
    if (!isLibraryHydrated || libraryLoadFailed) return;

    if (librarySaveDebounceRef.current) {
      window.clearTimeout(librarySaveDebounceRef.current);
    }

    librarySaveDebounceRef.current = window.setTimeout(() => {
      void writeLibraryToDb({
        version: 1,
        assetCollections,
        promptStarters,
        cameraFramingPresets,
        poseActionPresets,
      }).catch((error) =>
        toast.error(error instanceof Error ? error.message : "Could not save local library.")
      );
    }, 200);

    return () => {
      if (librarySaveDebounceRef.current) {
        window.clearTimeout(librarySaveDebounceRef.current);
      }
    };
  }, [
    isLibraryHydrated,
    libraryLoadFailed,
    assetCollections,
    promptStarters,
    cameraFramingPresets,
    poseActionPresets,
  ]);

  async function handleAssetUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    await addPendingAssetsFromFiles(files);

    event.target.value = "";
  }

  async function addPendingAssetsFromFiles(files: File[]) {
    if (!files.length) return;

    try {
      const nextAssets = await Promise.all(
        files.map(async (file) => ({
          id: createId("pending"),
          title: file.name.replace(/\.[^.]+$/, ""),
          src: await fileToDataUrl(file),
          notes: "",
          category: uploadCategory,
        }))
      );
      setPendingAssets((current) => [...current, ...nextAssets]);
      toast.success(`${nextAssets.length} asset${nextAssets.length === 1 ? "" : "s"} added to pending uploads.`);
    } catch {
      toast.error("Could not read those files.");
    }
  }

  async function handleAssetDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsAssetDropActive(false);

    const files = Array.from(event.dataTransfer.files || []).filter((file) => file.type.startsWith("image/"));
    await addPendingAssetsFromFiles(files);
  }

  function updatePendingAsset(id: string, patch: Partial<PendingLibraryAsset>) {
    setPendingAssets((current) => current.map((asset) => (asset.id === id ? { ...asset, ...patch } : asset)));
  }

  function savePendingAsset(id: string) {
    const asset = pendingAssets.find((entry) => entry.id === id);
    if (!asset || !activeCollection) return;

    void (async () => {
      try {
        const response = await fetch("/api/assets", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            dataUrl: asset.src,
            preferredName: asset.title,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Asset file save failed.");
        }

        const savedAsset: LibraryAsset = {
          id: createId("asset"),
          src: data.src,
          title: asset.title.trim() || "Untitled Asset",
          notes: asset.notes.trim(),
          category: asset.category,
        };

        setAssetCollections((current) =>
          current.map((collection) =>
            collection.id === activeCollection.id
              ? { ...collection, assets: [...collection.assets, savedAsset] }
              : collection
          )
        );
        setPendingAssets((current) => current.filter((entry) => entry.id !== id));
        toast.success("Asset saved to local library.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not save asset.");
      }
    })();
  }

  function discardPendingAsset(id: string) {
    setPendingAssets((current) => current.filter((asset) => asset.id !== id));
  }

  function createCollection() {
    const name = `Collection ${assetCollections.length + 1}`;
    const collection = { id: createId("collection"), name, assets: [] };
    setAssetCollections((current) => [...current, collection]);
    setActiveCollectionId(collection.id);
  }

  function renameActiveCollection(name: string) {
    if (!activeCollection) return;
    setAssetCollections((current) =>
      current.map((collection) =>
        collection.id === activeCollection.id ? { ...collection, name } : collection
      )
    );
  }

  function deleteActiveCollection() {
    if (!activeCollection || assetCollections.length === 1) {
      toast.error("Keep at least one collection.");
      return;
    }

    const nextCollections = assetCollections.filter((collection) => collection.id !== activeCollection.id);
    setAssetCollections(nextCollections);
    setActiveCollectionId(nextCollections[0].id);
    setSelectedBackgroundIds([]);
    setSelectedCharacterIds([]);
    setSelectedVisualReferenceIds([]);
  }

  function updateCollectionAsset(id: string, patch: Partial<LibraryAsset>) {
    if (!activeCollection) return;
    setAssetCollections((current) =>
      current.map((collection) =>
        collection.id === activeCollection.id
          ? {
              ...collection,
              assets: collection.assets.map((asset) => (asset.id === id ? { ...asset, ...patch } : asset)),
            }
          : collection
      )
    );
  }

  function deleteCollectionAsset(id: string) {
    const assetToDelete = allSavedAssets.find((asset) => asset.id === id);

    void (async () => {
      if (assetToDelete?.src?.startsWith("/managed-library/assets/")) {
        try {
          await fetch("/api/assets", {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ src: assetToDelete.src }),
          });
        } catch {
          // Preserve UX even if local file cleanup misses.
        }
      }
    })();

    setAssetCollections((current) =>
      current.map((collection) => ({
        ...collection,
        assets: collection.assets.filter((asset) => asset.id !== id),
      }))
    );
    setSelectedBackgroundIds((current) => current.filter((entry) => entry !== id));
    setSelectedCharacterSheetIds((current) => current.filter((entry) => entry !== id));
    setSelectedCharacterIds((current) => current.filter((entry) => entry !== id));
    setSelectedVisualReferenceIds((current) => current.filter((entry) => entry !== id));
    setEditingAssetDraft((current) => (current?.id === id ? null : current));
  }

  function applyPromptStarter(id: string) {
    setSelectedPromptStarterId(id);
    const preset = promptStarters.find((entry) => entry.id === id);
    if (!preset?.text) return;
    setScenePrompt((current) => (current.trim() ? `${current.trim()} ${preset.text}` : preset.text));
  }

  function openAssetEditor(asset: AssetBrowserItem) {
    setEditingAssetDraft({
      id: asset.id,
      title: asset.title,
      src: asset.src,
      notes: asset.notes,
      category: asset.category,
      collectionId: asset.collectionId,
      collectionName: asset.collectionName,
    });
  }

  function saveAssetEditor() {
    if (!editingAssetDraft) return;

    const draft = {
      ...editingAssetDraft,
      title: editingAssetDraft.title.trim() || "Untitled Asset",
      notes: editingAssetDraft.notes.trim(),
    };

    setAssetCollections((current) => {
      const assetToMove = current
        .flatMap((collection) => collection.assets)
        .find((asset) => asset.id === draft.id);

      if (!assetToMove) return current;

      const nextCollections = current.map((collection) => ({
        ...collection,
        assets: collection.assets.filter((asset) => asset.id !== draft.id),
      }));

      return nextCollections.map((collection) => {
        if (collection.id !== draft.collectionId) return collection;

        const updatedAsset: LibraryAsset = {
          id: draft.id,
          src: draft.src,
          title: draft.title,
          notes: draft.notes,
          category: draft.category,
        };

        const originalCollection = current.find((entry) => entry.id === draft.collectionId);
        const assetAlreadyInTarget = originalCollection?.assets.some((asset) => asset.id === draft.id);

        return {
          ...collection,
          assets: assetAlreadyInTarget
            ? [...collection.assets, updatedAsset]
            : [...collection.assets, updatedAsset],
        };
      });
    });

    if (activeCollectionId !== draft.collectionId) {
      setActiveCollectionId(draft.collectionId);
    }

    setEditingAssetDraft(null);
    toast.success("Asset updated.");
  }

  function openTextEditor(asset: TextBrowserItem) {
    setEditingTextDraft({
      id: asset.id,
      title: asset.title,
      text: asset.text,
      kind: asset.kind,
      originalKind: asset.kind,
    });
  }

  function saveTextEditor() {
    if (!editingTextDraft) return;

    const patch = {
      title: editingTextDraft.title.trim() || "Untitled Text Asset",
      text: editingTextDraft.text.trim(),
    };

    if (editingTextDraft.originalKind === editingTextDraft.kind) {
      updatePreset(editingTextDraft.kind, editingTextDraft.id, patch);
    } else {
      deletePreset(editingTextDraft.originalKind, editingTextDraft.id);
      const movedPreset: TextPreset = {
        id: editingTextDraft.id,
        title: patch.title,
        text: patch.text,
      };
      if (editingTextDraft.kind === "prompt-starters") {
        setPromptStarters((current) => [...current, movedPreset]);
      } else if (editingTextDraft.kind === "camera-framing") {
        setCameraFramingPresets((current) => [...current, movedPreset]);
      } else {
        setPoseActionPresets((current) => [...current, movedPreset]);
      }
    }
    setEditingTextDraft(null);
    toast.success("Text asset updated.");
  }

  function updatePreset(
    kind: TextPresetKind,
    id: string,
    patch: Partial<TextPreset>
  ) {
    const setter =
      kind === "prompt-starters"
        ? setPromptStarters
        : kind === "camera-framing"
          ? setCameraFramingPresets
          : setPoseActionPresets;

    setter((current) => current.map((preset) => (preset.id === id ? { ...preset, ...patch } : preset)));
  }

  function addPreset(kind: TextPresetKind) {
    const stagedPreset: PendingTextAsset = {
      id: createId("pending-text"),
      title:
        kind === "prompt-starters"
          ? "New Prompt Starter"
          : kind === "camera-framing"
            ? "New Camera Preset"
            : "New Pose Preset",
      text: "",
      kind,
    };

    setPendingTextAssets((current) => [...current, stagedPreset]);
    toast.success("Text asset added to pending.");
  }

  function updatePendingTextAsset(id: string, patch: Partial<PendingTextAsset>) {
    setPendingTextAssets((current) =>
      current.map((asset) => (asset.id === id ? { ...asset, ...patch } : asset))
    );
  }

  function savePendingTextAsset(id: string) {
    const asset = pendingTextAssets.find((entry) => entry.id === id);
    if (!asset) return;

    const savedPreset: TextPreset = {
      id: createId("preset"),
      title: asset.title.trim() || "Untitled Text Asset",
      text: asset.text.trim(),
    };

    if (asset.kind === "prompt-starters") {
      setPromptStarters((current) => [...current, savedPreset]);
    } else if (asset.kind === "camera-framing") {
      setCameraFramingPresets((current) => [...current, savedPreset]);
    } else {
      setPoseActionPresets((current) => [...current, savedPreset]);
    }

    setPendingTextAssets((current) => current.filter((entry) => entry.id !== id));
    toast.success("Text asset saved.");
  }

  function discardPendingTextAsset(id: string) {
    setPendingTextAssets((current) => current.filter((entry) => entry.id !== id));
  }

  function deletePreset(kind: TextPresetKind, id: string) {
    const remove = (items: TextPreset[]) => items.filter((preset) => preset.id !== id);
    if (kind === "prompt-starters") setPromptStarters((current) => remove(current));
    if (kind === "camera-framing") setCameraFramingPresets((current) => remove(current));
    if (kind === "pose-action") setPoseActionPresets((current) => remove(current));
    if (selectedPromptStarterId === id) setSelectedPromptStarterId("");
    if (selectedCameraPresetId === id) setSelectedCameraPresetId("");
    if (selectedPosePresetId === id) setSelectedPosePresetId("");
  }

  async function generateImage() {
    if (!canGenerate || selectedAllVisualAssets.length === 0) {
      toast.error("Pick a prompt and at least one visual asset first.");
      return;
    }

    const primaryVisualAnchor =
      selectedBackgroundAssets[0] ||
      selectedCharacterSheetAssets[0] ||
      selectedCharacterAssets[0] ||
      selectedVisualAssets[0] ||
      null;

    if (!primaryVisualAnchor) {
      toast.error("Select at least one usable visual asset first.");
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateName: "Custom GVC content",
          tone: "Custom",
          aspectRatio,
          quality,
          cameraFraming: selectedCameraPreset?.text || "Custom framing",
          scenePrompt,
          promptStarterText: selectedPromptStarter?.text || "",
          posePrompt: selectedPosePreset?.text || posePrompt,
          posePresetText: selectedPosePreset?.text || "",
          traitPrompt: "",
          negativePrompt: DEFAULT_NEGATIVE_PROMPT,
          backgroundTitle: primaryVisualAnchor.title,
          backgroundNotes: selectedAllVisualAssets
            .map((asset) => `${asset.title}${asset.notes ? ` - ${asset.notes}` : ""}`)
            .join(" | "),
          backgroundDataUrl: primaryVisualAnchor.src,
          characterSheets: selectedCharacterSheetAssets.map((asset) => ({
            name: asset.title,
            dataUrl: asset.src,
            notes: asset.notes,
          })),
          characters: selectedCharacterAssets.map((asset) => ({
            name: asset.title,
            dataUrl: asset.src,
            notes: asset.notes,
          })),
          detailReferences: [
            ...selectedBackgroundAssets
              .filter((asset) => asset.id !== primaryVisualAnchor.id)
              .map((asset) => ({
              name: asset.title,
              notes: `Additional background blend reference. ${asset.notes}`.trim(),
              dataUrl: asset.src,
              role: "background-blend",
              category: asset.category,
            })),
            ...selectedVisualAssets.map((asset) => ({
              name: asset.title,
              notes: asset.notes,
              dataUrl: asset.src,
              role:
                asset.category === "character-scenes"
                  ? "scene-reference"
                  : asset.category === "badges"
                    ? "badge-reference"
                    : asset.category === "textures-patterns"
                      ? "texture-pattern-reference"
                      : asset.category === "logo"
                        ? "logo-reference"
                        : "visual-reference",
              category: asset.category,
            })),
          ],
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Image generation failed.");

      const resizedImage = await resizeDataUrlToOutput(data.imageDataUrl, exportProfile.width, exportProfile.height);

        setGeneratedImages((current) => [
          {
            id: createId("generated"),
            dataUrl: resizedImage,
            createdAt: new Date().toISOString(),
            width: exportProfile.width,
            height: exportProfile.height,
            model: data.model,
            correctionApplied: Boolean(data.correctionApplied),
            qaModel: data.qaModel || undefined,
            qaError: data.qaError || null,
            qa: data.qa || null,
          },
          ...current,
        ]);
      toast.success("Image generated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Image generation failed.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function resetWorkspace() {
    const library = coerceLibrary({
      version: 1,
      assetCollections,
      promptStarters,
      cameraFramingPresets,
      poseActionPresets,
    });
    const fresh = coerceWorkspace(null, library);
    setActiveCollectionId(fresh.activeCollectionId);
    setPendingTextAssets([]);
    setSelectedPromptStarterId(fresh.selectedPromptStarterId);
    setSelectedCameraPresetId(fresh.selectedCameraPresetId);
    setSelectedPosePresetId(fresh.selectedPosePresetId);
    setSelectedBackgroundIds([]);
    setSelectedCharacterSheetIds([]);
    setSelectedCharacterIds([]);
    setSelectedVisualReferenceIds([]);
    setReferenceSearchQuery("");
    setReferenceCategoryFilter("");
    setReferenceCollectionFilterId("");
    setReferenceSort("newest");
    setAspectRatio("1:1");
    setQuality("medium");
    setScenePrompt("");
    setPosePrompt("");
    setUploadCategory("backgrounds");
    setPendingAssets([]);
    setGeneratedImages([]);
    setAssetSearchQuery("");
    setAssetFilterCategory("");
    setAssetFilterCollectionId("");
    setAssetSort("newest");
    setTextAssetSearchQuery("");
    setTextAssetFilterKind("");
    setTextAssetSort("newest");
    setEditingAssetDraft(null);
    setEditingTextDraft(null);
    setExpandedGeneratedImage(null);
    await clearWorkspaceFromDb();
    toast.success("Workspace reset.");
  }

  function renderThumbnailPicker(
    title: string,
    assets: AssetBrowserItem[],
    selectedIds: string[],
    onToggle: (id: string) => void,
    emptyText: string
  ) {
    return (
      <div className="panel-subtle">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <span className="tag-chip">{selectedIds.length} selected</span>
        </div>
        {assets.length === 0 ? (
          <div className="empty-state text-white/65">{emptyText}</div>
        ) : (
          <div className="reference-picker-grid">
            {assets.map((asset) => {
              const isActive = selectedIds.includes(asset.id);
              return (
                <button
                  key={asset.id}
                  className={`reference-thumb-card ${isActive ? "reference-thumb-card-active" : ""}`}
                  onClick={() => onToggle(asset.id)}
                  type="button"
                >
                  <div className="reference-thumb-media">
                    <img alt={asset.title} className="reference-thumb-image" src={asset.src} />
                  </div>
                  <div className="reference-thumb-meta">
                    <strong className="reference-thumb-title">{asset.title}</strong>
                    <span className="reference-thumb-collection">
                      {asset.collectionName}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <main className="relative z-10 min-h-screen px-4 py-6 md:px-6 lg:px-8">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        {[...Array(14)].map((_, index) => (
          <div
            key={`ember-${index}`}
            className="ember"
            style={{
              left: `${5 + ((index * 7) % 90)}%`,
              top: `${8 + ((index * 19) % 76)}%`,
              animationDelay: `${index * 0.45}s`,
              animationDuration: `${3.5 + (index % 5) * 0.8}s`,
              width: `${2 + (index % 4) * 1.5}px`,
              height: `${2 + (index % 4) * 1.5}px`,
              opacity: 0.2 + (index % 4) * 0.12,
            }}
          />
        ))}
      </div>
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="hero-panel rounded-[32px] border border-white/10 px-5 py-6 md:px-8">
          <div>
            <p className="eyebrow">Local Creator Studio</p>
            <h1 className="section-title">GVC Content Studio</h1>
            <p className="mt-3 text-sm text-white/70 md:text-base">
              Upload and classify brand assets, build reference packs, and generate new GVC content
              around your characters.
            </p>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
          <div className="flex flex-col gap-6">
            <div className="panel ready-panel">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="eyebrow">Prompt Setup</p>
                  <h2 className="section-title">Generation Setup</h2>
                </div>
                <button className="ghost-button" onClick={() => void resetWorkspace()} type="button">
                  <RotateCcw size={16} />
                  Reset
                </button>
              </div>

              <div className="mt-6 grid gap-4">
                <label className="field">
                  <span>Main Prompt</span>
                  <textarea
                    className="prompt-box"
                    rows={5}
                    value={scenePrompt}
                    onChange={(event) => setScenePrompt(event.target.value)}
                    placeholder="Describe the exact scene you want to generate."
                  />
                </label>

                <label className="field">
                  <span>Prompt Starter</span>
                  <select
                    value={selectedPromptStarterId}
                    onChange={(event) => applyPromptStarter(event.target.value)}
                  >
                    <option value="">None</option>
                    {sortedPromptStarters.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.title}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="field">
                    <span>Aspect Ratio</span>
                    <div className="segmented-control segmented-control-3 segmented-control-compact">
                      {(["1:1", "16:9", "9:16"] as AspectRatio[]).map((option) => (
                        <button
                          key={option}
                          className={`segment ${aspectRatio === option ? "segment-active" : ""}`}
                          onClick={() => setAspectRatio(option)}
                          type="button"
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="field">
                    <span>Output Size</span>
                    <div className="segmented-control segmented-control-3 segmented-control-compact">
                      {(["low", "medium", "high"] as RenderQuality[]).map((option) => {
                        const profile = getExportProfile(aspectRatio, option);
                        return (
                          <button
                            key={option}
                            className={`segment ${quality === option ? "segment-active" : ""}`}
                            onClick={() => setQuality(option)}
                            type="button"
                          >
                            {profile.label}
                          </button>
                        );
                      })}
                    </div>
                    <p className="field-help">
                      Final download size: {exportProfile.width} x {exportProfile.height}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="field">
                    <span>Camera Framing</span>
                    <select
                      value={selectedCameraPresetId}
                      onChange={(event) => setSelectedCameraPresetId(event.target.value)}
                    >
                      <option value="">None</option>
                      {cameraFramingPresets.map((preset) => (
                        <option key={preset.id} value={preset.id}>
                          {preset.title}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field">
                    <span>Pose & Action</span>
                    <select
                      value={selectedPosePresetId}
                      onChange={(event) => {
                        const nextId = event.target.value;
                        setSelectedPosePresetId(nextId);
                        const nextPreset = poseActionPresets.find((preset) => preset.id === nextId);
                        setPosePrompt(nextPreset?.text || "");
                      }}
                    >
                      <option value="">None</option>
                      {poseActionPresets.map((preset) => (
                        <option key={preset.id} value={preset.id}>
                          {preset.title}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            </div>

            <div className="panel-subtle">
              <div className="asset-browser-toolbar reference-filter-toolbar">
                <label className="field asset-search-field">
                  <span>Filter References</span>
                  <div className="asset-search-input">
                    <Search size={16} />
                    <input
                      placeholder="Search reference title or notes"
                      value={referenceSearchQuery}
                      onChange={(event) => setReferenceSearchQuery(event.target.value)}
                    />
                  </div>
                </label>

                <label className="field">
                  <span>Collection Filter</span>
                  <select
                    value={referenceCollectionFilterId}
                    onChange={(event) => setReferenceCollectionFilterId(event.target.value)}
                  >
                    <option value="">All Collections</option>
                    {assetCollections.map((collection) => (
                      <option key={collection.id} value={collection.id}>
                        {collection.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Category Filter</span>
                  <select
                    value={referenceCategoryFilter}
                    onChange={(event) => setReferenceCategoryFilter(event.target.value)}
                  >
                    <option value="">All Categories</option>
                    {libraryCategories.map((category) => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Sort</span>
                  <select
                    value={referenceSort}
                    onChange={(event) => setReferenceSort(event.target.value as AssetSortMode)}
                  >
                    <option value="newest">Newest</option>
                    <option value="title-asc">Title A-Z</option>
                    <option value="title-desc">Title Z-A</option>
                    <option value="category">Category</option>
                  </select>
                </label>
              </div>
            </div>

            {renderThumbnailPicker(
              "Characters",
              filteredCombinedCharacterAssets,
              [...selectedCharacterSheetIds, ...selectedCharacterIds],
              (id) => {
                const asset = combinedCharacterAssets.find((entry) => entry.id === id);
                if (!asset) return;
                if (asset.category === "character-sheets") {
                  setSelectedCharacterSheetIds((current) => toggleSelection(current, id));
                } else {
                  setSelectedCharacterIds((current) => toggleSelection(current, id));
                }
              },
              "Save character sheet and character assets in any collection and they will appear here."
            )}

            {renderThumbnailPicker(
              "Visual Influence Assets",
              filteredCombinedVisualAssets,
              [...selectedBackgroundIds, ...selectedVisualReferenceIds],
              (id) => {
                const asset = combinedVisualInfluenceAssets.find((entry) => entry.id === id);
                if (!asset) return;
                if (asset.category === "backgrounds") {
                  setSelectedBackgroundIds((current) => toggleSelection(current, id));
                } else {
                  setSelectedVisualReferenceIds((current) => toggleSelection(current, id));
                }
              },
              "Save backgrounds, character scenes, badges, textures, and logos in any collection to use them as visual influences."
            )}
          </div>

          <div className="flex flex-col gap-6">
            <div className="panel ready-panel">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="eyebrow">Generate</p>
                  <h2 className="section-title">Ready To Make</h2>
                </div>
                <button
                  className={`ghost-button ${canGenerate ? "ghost-button-ready" : "ghost-button-disabled"}`}
                  disabled={!canGenerate || isGenerating}
                  onClick={generateImage}
                  type="button"
                >
                  {isGenerating ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                  {isGenerating ? "Generating..." : "Generate Image"}
                </button>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-2">
                <div className="panel-subtle">
                  <div className="stat-label">Visual Assets</div>
                  <div className="mt-2 text-sm text-white">{selectedAllVisualAssets.length} selected</div>
                </div>
                <div className="panel-subtle">
                  <div className="stat-label">Output</div>
                  <div className="mt-2 text-sm text-white">
                    {aspectRatio} at {exportProfile.width} x {exportProfile.height}
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-2">
                {generationChecks.map((check) => (
                  <div
                    key={check.label}
                    className="flex items-center justify-between rounded-[18px] border border-white/8 bg-white/5 px-4 py-3"
                  >
                    <span className="text-sm text-white/72">{check.label}</span>
                    <span className={`text-sm font-semibold ${check.done ? "text-[#2EFF2E]" : "text-white/45"}`}>
                      {check.done ? "Ready" : "Missing"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="eyebrow">Results</p>
                  <h2 className="section-title">Generated Images</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="tag-chip">{generatedImages.length} images</span>
                  {generatedImages.length > 0 ? (
                    <button className="mini-button mini-button-danger" onClick={() => setGeneratedImages([])} type="button">
                      Clear Results
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="mt-6 grid gap-4">
                {generatedImages.length === 0 ? (
                  <div className="empty-state text-white/65">
                    Your generated images will appear here right after you click Generate.
                  </div>
                ) : (
                  generatedImages.map((image) => (
                    <div key={image.id} className="reference-card">
                      <button
                        className="reference-preview generated-image-preview-button"
                        onClick={() => setExpandedGeneratedImage(image)}
                        type="button"
                      >
                        <img alt="Generated result" className="max-h-[28rem] rounded-[18px] object-contain" src={image.dataUrl} />
                      </button>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="grid gap-1">
                          <div className="text-sm text-white/65">
                            {image.width} x {image.height}
                          </div>
                          {image.model ? (
                            <div className="text-[10px] uppercase tracking-[0.16em] text-white/35">
                              {image.model}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-3">
                          <button
                            className="ghost-button"
                            onClick={() => downloadDataUrl(image.dataUrl, `gvc-content-${image.id}.png`)}
                            type="button"
                          >
                            <Download size={16} />
                            Download
                          </button>
                          <button
                            className="mini-button mini-button-danger"
                            onClick={() => setGeneratedImages((current) => current.filter((entry) => entry.id !== image.id))}
                            type="button"
                          >
                            <Trash2 size={14} />
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="section-break">
          <div className="section-break-line" />
          <div className="section-break-badges" aria-hidden="true">
            <img alt="" className="section-break-badge section-break-badge-a" src="/library/badges/doge.webp" />
            <img alt="" className="section-break-badge section-break-badge-b" src="/library/badges/ladies_night.webp" />
            <img alt="" className="section-break-badge section-break-badge-c" src="/library/badges/party_in_the_back.webp" />
            <img alt="" className="section-break-badge section-break-badge-d" src="/library/badges/suited_up.webp" />
            <img alt="" className="section-break-badge section-break-badge-e" src="/library/badges/rainbow_boombox.webp" />
          </div>
        </section>

        <section className="panel">
          <div className="mb-6">
            <p className="eyebrow">Library Admin</p>
            <h2 className="section-title">Asset Library Manager</h2>
          </div>

            <div className="grid gap-6">
              <div className="panel-subtle">
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto_auto]">
                <label className="field">
                  <span>Active Collection</span>
                  <select value={activeCollectionId} onChange={(event) => setActiveCollectionId(event.target.value)}>
                    {assetCollections.map((collection) => (
                      <option key={collection.id} value={collection.id}>
                        {collection.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="ghost-button w-fit self-end" onClick={createCollection} type="button">
                  <FolderPlus size={16} />
                  Add Collection
                </button>
                <button className="mini-button w-fit self-end" onClick={deleteActiveCollection} type="button">
                  <Trash2 size={14} />
                  Delete Collection
                </button>
              </div>

              <div className="mt-4 grid gap-4">
                <label className="field">
                  <span>Rename Active Collection</span>
                  <input value={activeCollection?.name || ""} onChange={(event) => renameActiveCollection(event.target.value)} />
                </label>
              </div>
            </div>

            <div
              className={`panel-subtle pending-dropzone ${isAssetDropActive ? "pending-dropzone-active" : ""}`}
              onDragEnter={(event) => {
                event.preventDefault();
                setIsAssetDropActive(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setIsAssetDropActive(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                if (event.currentTarget === event.target) {
                  setIsAssetDropActive(false);
                }
              }}
              onDrop={handleAssetDrop}
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-white">Pending Uploads</h3>
                <button className="ghost-button" onClick={() => assetUploadRef.current?.click()} type="button">
                  <ImagePlus size={16} />
                  Upload Assets
                </button>
                <input
                  ref={assetUploadRef}
                  accept="image/*"
                  className="hidden"
                  multiple
                  type="file"
                  onChange={handleAssetUpload}
                />
              </div>

              <label className="field">
                <span>Default Upload Category</span>
                <select value={uploadCategory} onChange={(event) => setUploadCategory(event.target.value as LibraryCategory)}>
                  {libraryCategories.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="pending-dropzone-hint">
                {isAssetDropActive ? "Drop images here to add them to pending uploads" : "Drag and drop images here or use Upload Assets"}
              </div>

              <div className="mt-4 grid gap-4">
                {pendingAssets.length === 0 ? (
                  <div className="empty-state text-white/65">Upload assets, classify them, then save them into the library.</div>
                ) : (
                  pendingAssets.map((asset) => (
                    <div key={asset.id} className="reference-card">
                      <div className="reference-preview">
                        <img alt={asset.title} className="max-h-56 rounded-[18px] object-contain" src={asset.src} />
                      </div>
                      <div className="grid gap-4">
                        <label className="field">
                          <span>Title</span>
                          <input value={asset.title} onChange={(event) => updatePendingAsset(asset.id, { title: event.target.value })} />
                        </label>
                        <label className="field">
                          <span>Category</span>
                          <select
                            value={asset.category}
                            onChange={(event) => updatePendingAsset(asset.id, { category: event.target.value as LibraryCategory })}
                          >
                            {libraryCategories.map((category) => (
                              <option key={category.value} value={category.value}>
                                {category.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="field">
                          <span>Notes</span>
                          <textarea rows={3} value={asset.notes} onChange={(event) => updatePendingAsset(asset.id, { notes: event.target.value })} />
                        </label>
                        <div className="flex flex-wrap gap-3">
                          <button className="ghost-button" onClick={() => savePendingAsset(asset.id)} type="button">
                            <Save size={16} />
                            Save Asset
                          </button>
                          <button className="mini-button mini-button-danger" onClick={() => discardPendingAsset(asset.id)} type="button">
                            <Trash2 size={14} />
                            Discard
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="panel-subtle">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-white">Saved Visual Assets</h3>
                <span className="tag-chip">{filteredSavedAssets.length} shown</span>
              </div>

              <div className="asset-browser-toolbar">
                <label className="field asset-search-field">
                  <span>Search Assets</span>
                  <div className="asset-search-input">
                    <Search size={16} />
                    <input
                      placeholder="Search title or notes"
                      value={assetSearchQuery}
                      onChange={(event) => setAssetSearchQuery(event.target.value)}
                    />
                  </div>
                </label>

                <label className="field">
                  <span>Collection Filter</span>
                  <select value={assetFilterCollectionId} onChange={(event) => setAssetFilterCollectionId(event.target.value)}>
                    <option value="">All Collections</option>
                    {assetCollections.map((collection) => (
                      <option key={collection.id} value={collection.id}>
                        {collection.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Category Filter</span>
                  <select value={assetFilterCategory} onChange={(event) => setAssetFilterCategory(event.target.value)}>
                    <option value="">All Categories</option>
                    {libraryCategories.map((category) => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Sort</span>
                  <select value={assetSort} onChange={(event) => setAssetSort(event.target.value as typeof assetSort)}>
                    <option value="newest">Newest</option>
                    <option value="title-asc">Title A-Z</option>
                    <option value="title-desc">Title Z-A</option>
                    <option value="category">Category</option>
                  </select>
                </label>
              </div>

              <div className="mt-6 grid gap-6">
                {allSavedAssets.length === 0 ? (
                  <div className="empty-state text-white/65">
                    Your library is empty. Upload assets and classify them to use them in generation.
                  </div>
                ) : filteredSavedAssets.length === 0 ? (
                  <div className="empty-state text-white/65">
                    No saved assets match your current search and filters.
                  </div>
                ) : (
                  <div className="asset-grid">
                    {filteredSavedAssets.map((asset) => (
                      <article key={asset.id} className="asset-browser-card">
                        <div className="asset-browser-thumb">
                          <img alt={asset.title} className="asset-browser-image" src={asset.src} />
                        </div>
                        <div className="asset-browser-body">
                          <strong className="asset-browser-title">{asset.title}</strong>
                          <span className="asset-browser-collection">{asset.collectionName}</span>
                          <div className="flex flex-wrap gap-2">
                            <span className="tag-chip">{libraryCategories.find((entry) => entry.value === asset.category)?.label || asset.category}</span>
                          </div>
                          <p className="asset-browser-notes">{asset.notes || "No notes yet."}</p>
                          <div className="flex gap-2">
                            <button className="mini-button w-fit" onClick={() => openAssetEditor(asset)} type="button">
                              <Edit3 size={14} />
                              Edit
                            </button>
                            <button className="mini-button mini-button-danger w-fit" onClick={() => deleteCollectionAsset(asset.id)} type="button">
                              <Trash2 size={14} />
                              Delete
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <section className="section-break">
                <div className="section-break-line" />
                <div className="section-break-badges" aria-hidden="true">
                  <img alt="" className="section-break-badge section-break-badge-a" src="/library/badges/any_gvc.webp" />
                  <img alt="" className="section-break-badge section-break-badge-b" src="/library/badges/chris_favorite_badge.webp" />
                  <img alt="" className="section-break-badge section-break-badge-c" src="/library/badges/robot_lover.webp" />
                  <img alt="" className="section-break-badge section-break-badge-d" src="/library/badges/science_goggles.webp" />
                  <img alt="" className="section-break-badge section-break-badge-e" src="/library/badges/shower.webp" />
                </div>
              </section>

              <div className="panel-subtle">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-white">Saved Text Assets</h3>
                  <div className="flex flex-wrap gap-2">
                    <span className="tag-chip">{filteredTextAssets.length} shown</span>
                    <button className="mini-button" onClick={() => addPreset("prompt-starters")} type="button">
                      <Plus size={14} />
                      Add Prompt
                    </button>
                    <button className="mini-button" onClick={() => addPreset("camera-framing")} type="button">
                      <Plus size={14} />
                      Add Camera
                    </button>
                    <button className="mini-button" onClick={() => addPreset("pose-action")} type="button">
                      <Plus size={14} />
                      Add Pose
                    </button>
                  </div>
                </div>

                {pendingTextAssets.length > 0 ? (
                  <div className="mb-6">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <h4 className="text-base font-semibold text-white">Pending Text Assets</h4>
                      <span className="tag-chip">{pendingTextAssets.length} pending</span>
                    </div>
                    <div className="grid gap-4">
                      {pendingTextAssets.map((asset) => (
                        <div key={asset.id} className="pending-text-card">
                          <div className="pending-text-fields">
                            <label className="field field-compact">
                              <span>Title</span>
                              <input
                                value={asset.title}
                                onChange={(event) => updatePendingTextAsset(asset.id, { title: event.target.value })}
                              />
                            </label>

                            <label className="field field-compact">
                              <span>Type</span>
                              <select
                                value={asset.kind}
                                onChange={(event) =>
                                  updatePendingTextAsset(asset.id, { kind: event.target.value as TextPresetKind })
                                }
                              >
                                <option value="prompt-starters">Prompt Starters</option>
                                <option value="camera-framing">Camera Framing Presets</option>
                                <option value="pose-action">Pose &amp; Action Presets</option>
                              </select>
                            </label>

                            <label className="field field-compact">
                              <span>Text</span>
                              <textarea
                                rows={5}
                                value={asset.text}
                                onChange={(event) => updatePendingTextAsset(asset.id, { text: event.target.value })}
                                placeholder="Write the reusable prompt, framing, or pose guidance."
                              />
                            </label>

                            <div className="flex flex-wrap gap-2">
                              <button className="ghost-button" onClick={() => savePendingTextAsset(asset.id)} type="button">
                                <Save size={16} />
                                Save Text Asset
                              </button>
                              <button
                                className="mini-button mini-button-danger"
                                onClick={() => discardPendingTextAsset(asset.id)}
                                type="button"
                              >
                                <Trash2 size={14} />
                                Discard
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="asset-browser-toolbar">
                  <label className="field asset-search-field">
                    <span>Search Text Assets</span>
                    <div className="asset-search-input">
                      <Search size={16} />
                      <input
                        placeholder="Search label or text"
                        value={textAssetSearchQuery}
                        onChange={(event) => setTextAssetSearchQuery(event.target.value)}
                      />
                    </div>
                  </label>

                  <label className="field">
                    <span>Type Filter</span>
                    <select value={textAssetFilterKind} onChange={(event) => setTextAssetFilterKind(event.target.value)}>
                      <option value="">All Types</option>
                      <option value="prompt-starters">Prompt Starters</option>
                      <option value="camera-framing">Camera Framing Presets</option>
                      <option value="pose-action">Pose &amp; Action Presets</option>
                    </select>
                  </label>

                  <label className="field">
                    <span>Sort</span>
                    <select value={textAssetSort} onChange={(event) => setTextAssetSort(event.target.value as typeof textAssetSort)}>
                      <option value="newest">Newest</option>
                      <option value="title-asc">Title A-Z</option>
                      <option value="title-desc">Title Z-A</option>
                      <option value="type">Type</option>
                    </select>
                  </label>
                </div>

                <div className="mt-6 grid gap-6">
                  {allTextAssets.length === 0 ? (
                    <div className="empty-state text-white/65">No text assets saved yet.</div>
                  ) : filteredTextAssets.length === 0 ? (
                    <div className="empty-state text-white/65">No text assets match your current search and filters.</div>
                  ) : (
                    <div className="asset-grid">
                      {filteredTextAssets.map((asset) => (
                        <article key={asset.id} className="asset-browser-card text-asset-card">
                          <div className="asset-browser-body">
                            <strong className="asset-browser-title">{asset.title}</strong>
                            <div className="flex flex-wrap gap-2">
                              <span className="tag-chip">{asset.kindLabel}</span>
                            </div>
                            <p className="asset-browser-notes">{asset.text || "No text yet."}</p>
                            <div className="flex gap-2">
                              <button className="mini-button w-fit" onClick={() => openTextEditor(asset)} type="button">
                                <Edit3 size={14} />
                                Edit
                              </button>
                              <button className="mini-button mini-button-danger w-fit" onClick={() => deletePreset(asset.kind, asset.id)} type="button">
                                <Trash2 size={14} />
                                Delete
                              </button>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="panel-subtle">
          <p className="text-xs leading-6 text-white/60">
            For personal use only. Made using the GVC Builder Kit. Not officially approved or endorsed by Good Vibes Club.
          </p>
        </section>
      </div>

      {editingAssetDraft ? (
        <div className="asset-editor-overlay" onClick={() => setEditingAssetDraft(null)} role="presentation">
          <aside
            className="asset-editor-drawer"
            onClick={(event) => event.stopPropagation()}
            aria-label="Edit saved asset"
          >
            <div className="asset-editor-header">
              <div>
                <p className="eyebrow">Saved Asset</p>
                <h2 className="text-2xl font-semibold text-white">Edit Asset</h2>
              </div>
              <button className="mini-button" onClick={() => setEditingAssetDraft(null)} type="button">
                <X size={14} />
                Close
              </button>
            </div>

            <div className="asset-editor-preview">
              <img alt={editingAssetDraft.title} className="asset-editor-image" src={editingAssetDraft.src} />
            </div>

            <div className="grid gap-4">
              <label className="field">
                <span>Title</span>
                <input
                  value={editingAssetDraft.title}
                  onChange={(event) =>
                    setEditingAssetDraft((current) =>
                      current ? { ...current, title: event.target.value } : current
                    )
                  }
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="field">
                  <span>Category</span>
                  <select
                    value={editingAssetDraft.category}
                    onChange={(event) =>
                      setEditingAssetDraft((current) =>
                        current ? { ...current, category: event.target.value as LibraryCategory } : current
                      )
                    }
                  >
                    {libraryCategories.map((category) => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Collection</span>
                  <select
                    value={editingAssetDraft.collectionId}
                    onChange={(event) => {
                      const nextCollection = assetCollections.find((collection) => collection.id === event.target.value);
                      setEditingAssetDraft((current) =>
                        current
                          ? {
                              ...current,
                              collectionId: event.target.value,
                              collectionName: nextCollection?.name || current.collectionName,
                            }
                          : current
                      );
                    }}
                  >
                    {assetCollections.map((collection) => (
                      <option key={collection.id} value={collection.id}>
                        {collection.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="field">
                <span>Notes</span>
                <textarea
                  rows={5}
                  value={editingAssetDraft.notes}
                  onChange={(event) =>
                    setEditingAssetDraft((current) =>
                      current ? { ...current, notes: event.target.value } : current
                    )
                  }
                />
              </label>

              <div className="flex flex-wrap gap-3">
                <button className="ghost-button" onClick={saveAssetEditor} type="button">
                  <Save size={16} />
                  Save Changes
                </button>
                <button
                  className="mini-button mini-button-danger"
                  onClick={() => deleteCollectionAsset(editingAssetDraft.id)}
                  type="button"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {expandedGeneratedImage ? (
        <div className="asset-editor-overlay" onClick={() => setExpandedGeneratedImage(null)} role="presentation">
          <aside
            className="generated-lightbox"
            onClick={(event) => event.stopPropagation()}
            aria-label="Inspect generated image"
          >
            <div className="asset-editor-header">
              <div>
                <p className="eyebrow">Generated Result</p>
                <h2 className="font-display text-2xl font-semibold text-white">Inspect Image</h2>
              </div>
              <button className="mini-button" onClick={() => setExpandedGeneratedImage(null)} type="button">
                <X size={14} />
                Close
              </button>
            </div>

            <div className="generated-lightbox-stage">
              <img
                alt="Expanded generated result"
                className="generated-lightbox-image"
                src={expandedGeneratedImage.dataUrl}
              />
            </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="grid gap-1">
                  <div className="text-sm text-white/65">
                    {expandedGeneratedImage.width} x {expandedGeneratedImage.height}
                  </div>
                  {expandedGeneratedImage.model ? (
                    <div className="text-[10px] uppercase tracking-[0.16em] text-white/35">
                      {expandedGeneratedImage.model}
                    </div>
                  ) : null}
                  <div className="mt-3 max-w-2xl rounded-[18px] border border-white/10 bg-white/[0.03] p-3 text-xs text-white/72">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="eyebrow !mb-0 !text-[10px]">Audit</span>
                      {expandedGeneratedImage.qa ? (
                        <span
                          className={`tag-chip ${
                            expandedGeneratedImage.qa.pass ? "border-[#2EFF2E]/35 text-[#2EFF2E]" : "border-[#FF6B9D]/35 text-[#FF6B9D]"
                          }`}
                        >
                          {expandedGeneratedImage.qa.pass ? "Passed" : "Flagged"}
                        </span>
                      ) : (
                        <span className="tag-chip border-white/15 text-white/55">QA Null</span>
                      )}
                      {expandedGeneratedImage.correctionApplied ? (
                        <span className="tag-chip border-gvc-gold/30 text-gvc-gold">Correction Applied</span>
                      ) : null}
                    </div>
                    {expandedGeneratedImage.qa?.summary ? (
                      <p className="mt-2 text-white/75">{expandedGeneratedImage.qa.summary}</p>
                    ) : (
                      <p className="mt-2 text-white/55">No QA summary was stored for this result.</p>
                    )}
                    {expandedGeneratedImage.qaError ? (
                      <p className="mt-2 text-[#FF6B9D]">QA error: {expandedGeneratedImage.qaError}</p>
                    ) : null}
                    {expandedGeneratedImage.qaModel ? (
                      <p className="mt-2 text-white/45">QA model: {expandedGeneratedImage.qaModel}</p>
                    ) : null}
                    {expandedGeneratedImage.qa?.issues?.length ? (
                      <p className="mt-2 text-white/55">Issues: {expandedGeneratedImage.qa.issues.join("; ")}</p>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                <button
                  className="ghost-button"
                  onClick={() =>
                    downloadDataUrl(
                      expandedGeneratedImage.dataUrl,
                      `gvc-content-${expandedGeneratedImage.id}.png`
                    )
                  }
                  type="button"
                >
                  <Download size={16} />
                  Download
                </button>
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {editingTextDraft ? (
        <div className="asset-editor-overlay" onClick={() => setEditingTextDraft(null)} role="presentation">
          <aside
            className="asset-editor-drawer"
            onClick={(event) => event.stopPropagation()}
            aria-label="Edit saved text asset"
          >
            <div className="asset-editor-header">
              <div>
                <p className="eyebrow">Saved Text Asset</p>
                <h2 className="text-2xl font-semibold text-white">Edit Text Asset</h2>
              </div>
              <button className="mini-button" onClick={() => setEditingTextDraft(null)} type="button">
                <X size={14} />
                Close
              </button>
            </div>

            <div className="grid gap-4">
              <label className="field">
                <span>Label</span>
                <input
                  value={editingTextDraft.title}
                  onChange={(event) =>
                    setEditingTextDraft((current) =>
                      current ? { ...current, title: event.target.value } : current
                    )
                  }
                />
              </label>

              <label className="field">
                <span>Type</span>
                <select
                  value={editingTextDraft.kind}
                  onChange={(event) =>
                    setEditingTextDraft((current) =>
                      current ? { ...current, kind: event.target.value as TextAssetKind } : current
                    )
                  }
                >
                  <option value="prompt-starters">Prompt Starters</option>
                  <option value="camera-framing">Camera Framing Presets</option>
                  <option value="pose-action">Pose &amp; Action Presets</option>
                </select>
              </label>

              <label className="field">
                <span>Text</span>
                <textarea
                  rows={8}
                  value={editingTextDraft.text}
                  onChange={(event) =>
                    setEditingTextDraft((current) =>
                      current ? { ...current, text: event.target.value } : current
                    )
                  }
                />
              </label>

              <div className="flex flex-wrap gap-3">
                <button className="ghost-button" onClick={saveTextEditor} type="button">
                  <Save size={16} />
                  Save Changes
                </button>
                <button
                  className="mini-button mini-button-danger"
                  onClick={() => deletePreset(editingTextDraft.kind, editingTextDraft.id)}
                  type="button"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </main>
  );
}
