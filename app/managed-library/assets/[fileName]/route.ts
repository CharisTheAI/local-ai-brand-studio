import fs from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

const MANAGED_DIR = path.join(process.cwd(), "public", "managed-library", "assets");

function getMimeType(fileName: string) {
  const extension = path.extname(fileName).toLowerCase();
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  if (extension === ".gif") return "image/gif";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  return "application/octet-stream";
}

export async function GET(
  _request: Request,
  context: { params: { fileName: string } }
) {
  try {
    const fileName = context.params.fileName;
    const absolutePath = path.join(MANAGED_DIR, fileName);

    if (!absolutePath.startsWith(MANAGED_DIR)) {
      return new NextResponse("Invalid asset path.", { status: 400 });
    }

    const file = await fs.readFile(absolutePath);
    return new NextResponse(file, {
      status: 200,
      headers: {
        "Content-Type": getMimeType(fileName),
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch {
    return new NextResponse("Asset not found.", { status: 404 });
  }
}
