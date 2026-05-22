import fs from "fs";
import path from "path";

type LibraryCategory =
  | "backgrounds"
  | "character-scenes"
  | "characters"
  | "badges"
  | "textures-patterns"
  | "logo";

type TextPresetKind = "prompt-starters" | "camera-framing" | "pose-action";

export type LibraryAsset = {
  id: string;
  title: string;
  src: string;
  notes: string;
  category: LibraryCategory;
};

export type AssetCollection = {
  id: string;
  name: string;
  assets: LibraryAsset[];
};

export type TextPreset = {
  id: string;
  title: string;
  text: string;
};

export type LibrarySnapshot = {
  version: 1;
  assetCollections: AssetCollection[];
  promptStarters: TextPreset[];
  cameraFramingPresets: TextPreset[];
  poseActionPresets: TextPreset[];
};

type DatabaseLike = {
  exec(sql: string): void;
  prepare(sql: string): StatementLike;
  close(): void;
};

type StatementLike = {
  all(...params: unknown[]): Record<string, unknown>[];
  get(...params: unknown[]): Record<string, unknown> | undefined;
  run(...params: unknown[]): unknown;
};

const DEFAULT_COLLECTION_ID = "default-collection";
const DEFAULT_COLLECTION_NAME = "Main Kit";
const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "library.sqlite");
const BACKUP_DIR = path.join(DATA_DIR, "backups");

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

function coerceLibrary(snapshot: Partial<LibrarySnapshot> | null | undefined): LibrarySnapshot {
  const assetCollections =
    snapshot?.assetCollections?.length ? snapshot.assetCollections : [getDefaultCollection()];

  return {
    version: 1,
    assetCollections,
    promptStarters: snapshot?.promptStarters?.length ? snapshot.promptStarters : getDefaultPromptStarters(),
    cameraFramingPresets:
      snapshot?.cameraFramingPresets?.length ? snapshot.cameraFramingPresets : getDefaultCameraPresets(),
    poseActionPresets:
      snapshot?.poseActionPresets?.length ? snapshot.poseActionPresets : getDefaultPosePresets(),
  };
}

function ensureDirectories() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function getDatabase(): DatabaseLike {
  ensureDirectories();
  // node:sqlite is provided by the local Node runtime even though older @types/node packages may not know it.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const sqliteModule = require("node:sqlite") as {
    DatabaseSync: new (fileName: string) => DatabaseLike;
  };
  const db = new sqliteModule.DatabaseSync(DB_FILE);

  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS collections (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      src TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL,
      collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
      sort_order INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS text_presets (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      text TEXT NOT NULL DEFAULT '',
      kind TEXT NOT NULL,
      sort_order INTEGER NOT NULL
    );
  `);

  return db;
}

function countLibraryAssets(snapshot: LibrarySnapshot | null | undefined) {
  return snapshot?.assetCollections?.reduce((sum, collection) => sum + collection.assets.length, 0) || 0;
}

function countTextPresets(snapshot: LibrarySnapshot | null | undefined) {
  return (
    (snapshot?.promptStarters?.length || 0) +
    (snapshot?.cameraFramingPresets?.length || 0) +
    (snapshot?.poseActionPresets?.length || 0)
  );
}

export function hasMeaningfulLibrary(snapshot: LibrarySnapshot | null | undefined) {
  return countLibraryAssets(snapshot) > 0 || countTextPresets(snapshot) > 5;
}

function backupDatabaseFile() {
  if (!fs.existsSync(DB_FILE)) return;
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  fs.copyFileSync(DB_FILE, path.join(BACKUP_DIR, `library-${timestamp}.sqlite`));
}

function seedIfCompletelyEmpty(db: DatabaseLike) {
  const counts = db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM collections) AS collection_count,
        (SELECT COUNT(*) FROM assets) AS asset_count,
        (SELECT COUNT(*) FROM text_presets) AS text_count`
    )
    .get() as
    | {
        collection_count?: number;
        asset_count?: number;
        text_count?: number;
      }
    | undefined;

  const collectionCount = Number(counts?.collection_count || 0);
  const assetCount = Number(counts?.asset_count || 0);
  const textCount = Number(counts?.text_count || 0);

  if (collectionCount > 0 || assetCount > 0 || textCount > 0) {
    return;
  }

  const defaults = coerceLibrary(null);
  const insertCollection = db.prepare(`INSERT INTO collections (id, name, sort_order) VALUES (?, ?, ?)`);
  const insertPreset = db.prepare(
    `INSERT INTO text_presets (id, title, text, kind, sort_order) VALUES (?, ?, ?, ?, ?)`
  );

  defaults.assetCollections.forEach((collection, collectionIndex) => {
    insertCollection.run(collection.id, collection.name, collectionIndex);
  });
  defaults.promptStarters.forEach((preset, index) => {
    insertPreset.run(preset.id, preset.title, preset.text, "prompt-starters", index);
  });
  defaults.cameraFramingPresets.forEach((preset, index) => {
    insertPreset.run(preset.id, preset.title, preset.text, "camera-framing", index);
  });
  defaults.poseActionPresets.forEach((preset, index) => {
    insertPreset.run(preset.id, preset.title, preset.text, "pose-action", index);
  });
}

export function readLibrarySnapshot(): LibrarySnapshot {
  const db = getDatabase();
  try {
    seedIfCompletelyEmpty(db);

    const collections = db.prepare(`SELECT id, name, sort_order FROM collections ORDER BY sort_order ASC, name ASC`).all() as Array<{
      id: string;
      name: string;
      sort_order: number;
    }>;

    const assets = db
      .prepare(
        `SELECT id, title, src, notes, category, collection_id, sort_order
         FROM assets
         ORDER BY collection_id ASC, sort_order ASC, title ASC`
      )
      .all() as Array<{
        id: string;
        title: string;
        src: string;
        notes: string;
        category: LibraryCategory;
        collection_id: string;
        sort_order: number;
      }>;

    const presets = db
      .prepare(`SELECT id, title, text, kind, sort_order FROM text_presets ORDER BY kind ASC, sort_order ASC, title ASC`)
      .all() as Array<{
        id: string;
        title: string;
        text: string;
        kind: TextPresetKind;
        sort_order: number;
      }>;

    const collectionMap = new Map<string, AssetCollection>();
    for (const collection of collections) {
      collectionMap.set(collection.id, {
        id: collection.id,
        name: collection.name,
        assets: [],
      });
    }

    for (const asset of assets) {
      const collection = collectionMap.get(asset.collection_id);
      if (!collection) continue;
      collection.assets.push({
        id: asset.id,
        title: asset.title,
        src: asset.src,
        notes: asset.notes,
        category: asset.category,
      });
    }

    const snapshot = coerceLibrary({
      version: 1,
      assetCollections: Array.from(collectionMap.values()),
      promptStarters: presets
        .filter((preset) => preset.kind === "prompt-starters")
        .map(({ id, title, text }) => ({ id, title, text })),
      cameraFramingPresets: presets
        .filter((preset) => preset.kind === "camera-framing")
        .map(({ id, title, text }) => ({ id, title, text })),
      poseActionPresets: presets
        .filter((preset) => preset.kind === "pose-action")
        .map(({ id, title, text }) => ({ id, title, text })),
    });

    return snapshot;
  } finally {
    db.close();
  }
}

export function writeLibrarySnapshot(
  snapshot: LibrarySnapshot,
  options?: { allowEmptyOverwrite?: boolean; skipBackup?: boolean }
) {
  const nextSnapshot = coerceLibrary(snapshot);

  if (!options?.skipBackup) {
    backupDatabaseFile();
  }

  const db = getDatabase();
  try {
    db.exec("BEGIN TRANSACTION");

    db.exec(`DELETE FROM assets; DELETE FROM collections; DELETE FROM text_presets;`);

    const insertCollection = db.prepare(`INSERT INTO collections (id, name, sort_order) VALUES (?, ?, ?)`);
    const insertAsset = db.prepare(
      `INSERT INTO assets (id, title, src, notes, category, collection_id, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const insertPreset = db.prepare(
      `INSERT INTO text_presets (id, title, text, kind, sort_order) VALUES (?, ?, ?, ?, ?)`
    );

    nextSnapshot.assetCollections.forEach((collection, collectionIndex) => {
      insertCollection.run(collection.id, collection.name, collectionIndex);
      collection.assets.forEach((asset, assetIndex) => {
        insertAsset.run(
          asset.id,
          asset.title,
          asset.src,
          asset.notes,
          asset.category,
          collection.id,
          assetIndex
        );
      });
    });

    nextSnapshot.promptStarters.forEach((preset, index) => {
      insertPreset.run(preset.id, preset.title, preset.text, "prompt-starters", index);
    });
    nextSnapshot.cameraFramingPresets.forEach((preset, index) => {
      insertPreset.run(preset.id, preset.title, preset.text, "camera-framing", index);
    });
    nextSnapshot.poseActionPresets.forEach((preset, index) => {
      insertPreset.run(preset.id, preset.title, preset.text, "pose-action", index);
    });

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  } finally {
    db.close();
  }
}
