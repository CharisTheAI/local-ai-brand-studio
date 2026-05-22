import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import {
  type AssetCollection,
  type LibrarySnapshot,
  type TextPreset,
  hasMeaningfulLibrary,
  readLibrarySnapshot,
  writeLibrarySnapshot,
} from "@/lib/library-db";

const WORKSPACE_FILES = [
  path.join(process.cwd(), "data", "workspace.json"),
  path.join(process.cwd(), "data", "workspace.backup.json"),
  path.join(process.cwd(), "data", "workspace.nonempty.backup.json"),
];

type LegacyWorkspaceLibrary = {
  assetCollections?: AssetCollection[];
  promptStarters?: TextPreset[];
  cameraFramingPresets?: TextPreset[];
  poseActionPresets?: TextPreset[];
};

async function tryReadJson(filePath: string) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return JSON.parse(content) as LegacyWorkspaceLibrary;
  } catch {
    return null;
  }
}

function coerceLegacyLibrary(saved: LegacyWorkspaceLibrary | null): LibrarySnapshot {
  return {
    version: 1,
    assetCollections: saved?.assetCollections || [],
    promptStarters: saved?.promptStarters || [],
    cameraFramingPresets: saved?.cameraFramingPresets || [],
    poseActionPresets: saved?.poseActionPresets || [],
  };
}

async function migrateLegacyWorkspaceLibraryIfNeeded() {
  const currentLibrary = readLibrarySnapshot();
  if (hasMeaningfulLibrary(currentLibrary)) {
    return currentLibrary;
  }

  for (const filePath of WORKSPACE_FILES) {
    const legacy = coerceLegacyLibrary(await tryReadJson(filePath));
    if (!hasMeaningfulLibrary(legacy)) continue;
    writeLibrarySnapshot(legacy, { skipBackup: true });
    return readLibrarySnapshot();
  }

  return currentLibrary;
}

export async function GET() {
  try {
    const snapshot = await migrateLegacyWorkspaceLibraryIfNeeded();
    return NextResponse.json(snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not read local library.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as LibrarySnapshot;
    writeLibrarySnapshot(payload);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save local library.";
    const status = message.includes("Protected your saved library") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
