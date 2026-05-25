export type ImageModelProvider = "openai" | "google";

export type ImageModelDefinition = {
  id: string;
  label: string;
  provider: ImageModelProvider;
  runtimeModel: string;
  envKey: string;
  supportsNativeHighRes: boolean;
};

export type PublicImageModelDefinition = Pick<
  ImageModelDefinition,
  "id" | "label" | "provider" | "runtimeModel" | "supportsNativeHighRes"
>;

const IMAGE_MODEL_REGISTRY: ImageModelDefinition[] = [
  {
    id: "openai:gpt-image-1-5",
    label: "OpenAI GPT Image 1.5",
    provider: "openai",
    runtimeModel: "gpt-image-1.5",
    envKey: "OPENAI_API_KEY",
    supportsNativeHighRes: false,
  },
  {
    id: "openai:gpt-image-2",
    label: "OpenAI GPT Image 2",
    provider: "openai",
    runtimeModel: "gpt-image-2",
    envKey: "OPENAI_API_KEY",
    supportsNativeHighRes: false,
  },
  {
    id: "google:gemini-nano-banana",
    label: "Google Gemini Nano Banana",
    provider: "google",
    runtimeModel: "gemini-2.5-flash-image",
    envKey: "GEMINI_API_KEY",
    supportsNativeHighRes: false,
  },
  {
    id: "google:gemini-nano-banana-2",
    label: "Google Gemini Nano Banana 2",
    provider: "google",
    runtimeModel: "gemini-3.1-flash-image-preview",
    envKey: "GEMINI_API_KEY",
    supportsNativeHighRes: true,
  },
];

export function getAvailableImageModels() {
  return IMAGE_MODEL_REGISTRY.filter((model) => Boolean(process.env[model.envKey]));
}

export function getPublicImageModels(): PublicImageModelDefinition[] {
  return getAvailableImageModels().map(({ id, label, provider, runtimeModel, supportsNativeHighRes }) => ({
    id,
    label,
    provider,
    runtimeModel,
    supportsNativeHighRes,
  }));
}

export function getDefaultImageModelId() {
  return getAvailableImageModels()[0]?.id || "";
}

export function findAvailableImageModelById(id?: string | null) {
  const available = getAvailableImageModels();
  if (!available.length) return null;
  return available.find((model) => model.id === id) || available[0];
}
