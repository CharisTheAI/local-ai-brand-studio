import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const MANAGED_DIR = path.join(process.cwd(), "public", "managed-library", "assets");

function extFromMime(mime: string) {
  if (mime === "image/png") return ".png";
  if (mime === "image/webp") return ".webp";
  if (mime === "image/gif") return ".gif";
  if (mime === "image/jpeg" || mime === "image/jpg") return ".jpg";
  return ".png";
}

function sanitizeBaseName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "asset";
}

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Invalid image data.");
  }

  return {
    mimeType: match[1],
    base64: match[2],
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      dataUrl: string;
      preferredName?: string;
    };

    if (!body.dataUrl) {
      return NextResponse.json({ error: "Missing image data." }, { status: 400 });
    }

    const { mimeType, base64 } = parseDataUrl(body.dataUrl);
    const ext = extFromMime(mimeType);
    const baseName = sanitizeBaseName(body.preferredName || "asset");
    const fileName = `${Date.now()}-${baseName}${ext}`;

    await fs.mkdir(MANAGED_DIR, { recursive: true });
    await fs.writeFile(path.join(MANAGED_DIR, fileName), Buffer.from(base64, "base64"));

    return NextResponse.json({
      src: `/managed-library/assets/${fileName}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save asset file.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { src?: string };
    const src = body.src || "";

    if (!src.startsWith("/managed-library/assets/")) {
      return NextResponse.json({ ok: true });
    }

    const normalized = src.replace(/^\/+/, "");
    const absolutePath = path.join(process.cwd(), "public", normalized);
    const managedRoot = path.join(process.cwd(), "public", "managed-library", "assets");

    if (!absolutePath.startsWith(managedRoot)) {
      return NextResponse.json({ error: "Invalid asset path." }, { status: 400 });
    }

    await fs.rm(absolutePath, { force: true });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not delete asset file.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
