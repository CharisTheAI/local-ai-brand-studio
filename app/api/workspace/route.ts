import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const WORKSPACE_FILE = path.join(DATA_DIR, "workspace.json");
const BACKUP_FILE = path.join(DATA_DIR, "workspace.backup.json");
const NONEMPTY_BACKUP_FILE = path.join(DATA_DIR, "workspace.nonempty.backup.json");

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

type WorkspaceLike = {
  generatedImages?: unknown[];
  scenePrompt?: string;
  selectedBackgroundIds?: unknown[];
  selectedCharacterIds?: unknown[];
  selectedVisualReferenceIds?: unknown[];
};

async function tryReadJson(filePath: string) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    await ensureDataDir();
    const primary = await tryReadJson(WORKSPACE_FILE);
    const backup = await tryReadJson(BACKUP_FILE);
    const nonemptyBackup = await tryReadJson(NONEMPTY_BACKUP_FILE);

    if (primary) {
      return NextResponse.json(primary);
    }

    if (nonemptyBackup) {
      return NextResponse.json(nonemptyBackup);
    }

    if (backup) {
      return NextResponse.json(backup);
    }

    return NextResponse.json(null);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not read workspace.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    await ensureDataDir();

    const serialized = JSON.stringify(payload, null, 2);
    await fs.writeFile(WORKSPACE_FILE, serialized, "utf8");
    await fs.writeFile(BACKUP_FILE, serialized, "utf8");
    await fs.writeFile(NONEMPTY_BACKUP_FILE, serialized, "utf8");
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save workspace.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await ensureDataDir();
    await fs.rm(WORKSPACE_FILE, { force: true });
    await fs.rm(BACKUP_FILE, { force: true });
    await fs.rm(NONEMPTY_BACKUP_FILE, { force: true });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not clear workspace.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
