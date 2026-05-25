import { NextResponse } from "next/server";

import { getDefaultImageModelId, getPublicImageModels } from "@/lib/image-models";

export async function GET() {
  const models = getPublicImageModels();

  return NextResponse.json({
    models,
    defaultModelId: getDefaultImageModelId(),
  });
}
