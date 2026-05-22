import { NextResponse } from "next/server";
import OpenAI, { toFile } from "openai";
import { makeParseableTextFormat } from "openai/lib/parser";
import fs from "fs/promises";
import path from "path";

type AspectRatio = "1:1" | "16:9" | "9:16";
type RenderQuality = "low" | "medium" | "high";

type CharacterReference = {
  name: string;
  dataUrl: string;
  notes?: string;
};

type DetailReference = {
  name: string;
  notes?: string;
  src?: string;
  dataUrl?: string;
  role?:
    | "background-blend"
    | "scene-reference"
    | "badge-reference"
    | "texture-pattern-reference"
    | "logo-reference"
    | "visual-reference";
  category?: string;
};

type GeneratePayload = {
  templateName: string;
  tone: string;
  aspectRatio: AspectRatio;
  quality: RenderQuality;
  cameraFraming: string;
  scenePrompt: string;
  promptStarterText?: string;
  posePrompt: string;
  posePresetText?: string;
  traitPrompt: string;
  negativePrompt: string;
  backgroundTitle?: string;
  backgroundNotes?: string;
  backgroundSrc?: string;
  backgroundDataUrl?: string;
  characterSheets?: CharacterReference[];
  characters: CharacterReference[];
  detailReferences?: DetailReference[];
};

type QualityQaResult = {
  pass: boolean;
  issues: string[];
  correctionPrompt: string;
  summary: string;
  failures: {
    nosePresent: boolean;
    extraFacialGeometry: boolean;
    mouthDrift: boolean;
    glassesAlignmentDrift: boolean;
    headNeckProportionDrift: boolean;
    outfitConstructionDrift: boolean;
    fiveFingers: boolean;
    bodyProportionDrift: boolean;
    silhouetteDrift: boolean;
    shirtGraphicDrift: boolean;
    shoeLogoDrift: boolean;
    paletteDrift: boolean;
  };
};

type GeneratedImageResult = {
  b64_json: string;
  revised_prompt?: string;
};

const BRAND_STYLE_GUIDE = [
  "Good Vibes Club visual direction:",
  "Warm gold-forward palette with rich blacks and softened highlights.",
  "Surreal premium environments that still feel fun, optimistic, and collectible.",
  "Characters should feel polished, consistent, and central to the composition.",
  "Avoid generic stock-photo aesthetics or off-brand realism without stylization.",
  "Favor cinematic lighting, clear silhouettes, and playful but intentional composition.",
  "If text appears in the image, it should use the GVC brand typography unless the prompt explicitly asks otherwise.",
  "Use Brice-style display lettering for headlines and Mundial-style lettering for supporting text.",
].join(" ");

const QUALITY_MATTERS_GUIDANCE = [
  "Quality matters rules:",
  "Honor premium Good Vibes Club production values in every render.",
  "Preserve believable global illumination and bounce light across the scene.",
  "Keep lighting direction coherent across the character, props, and environment.",
  "Preserve material finish response with clean highlights, readable midtones, and intentional shadows.",
  "Respect curated color batches and palette discipline from the uploaded references.",
  "Keep accessory placement exact and intentional.",
  "Keep shirt graphics, slogans, chest logos, and printed details locked in the correct location, scale, and orientation whenever they appear in the references.",
  "Do not flatten the output into a generic AI look, muddy over-smoothing, or random realism drift.",
  "Favor clean stylized forms, crisp silhouette control, premium staging, and strong readability.",
].join(" ");

const GRAPHIC_PLACEMENT_GUIDANCE = [
  "Graphic and apparel lock rules:",
  "Preserve the exact placement of shirt graphics, slogans, chest logos, shoe logos, and apparel marks from the canonical character references whenever they are visible.",
  "Keep those graphics in the correct location, scale, orientation, and relative spacing on the garment or shoe.",
  "Preserve the exact outfit construction, garment shape, trim, seams, collar/sleeve behavior, and footwear design unless the prompt explicitly requests an approved outfit change.",
  "If the prompt does not explicitly request a wardrobe change, keep the outfit and shoes effectively unchanged from the canonical reference.",
  "Never invent garbled pseudo-text, extra symbols, or drifted logo placement.",
  "If tiny text cannot be rendered cleanly at this image size, simplify it into a clean faithful mark in the correct placement rather than producing broken nonsense text.",
].join(" ");

const ANATOMY_GUARDRAILS = [
  "Anatomy guardrails:",
  "Render hands carefully and clearly in the Good Vibes Club character style.",
  "Each visible hand should have exactly four fingers, matching the uploaded character design.",
  "Do not add a fifth finger.",
  "Avoid extra fingers, fused fingers, missing fingers, duplicated limbs, warped wrists, or broken joints.",
  "Facial features must stay locked to the uploaded reference style.",
  "Do not invent a nose if the reference does not show one.",
  "Do not add extra mouths, extra lips, realistic teeth, smile creases, cheek lines, philtrum lines, or altered face construction.",
  "Preserve the exact eye language, glasses or eyewear, and the simple drawn mouth style from the uploaded character.",
  "If the reference uses glasses or black-line eyes, keep that exact minimal face system and do not invent extra facial geometry.",
  "Preserve the exact face shape, head shape, body proportions, limb proportions, and silhouette of each uploaded character.",
  "If a hand or face cannot be shown cleanly, simplify or partially occlude it naturally rather than inventing off-model details.",
].join(" ");
const CODEX_NOTES_PATH = path.join(process.cwd(), "CODEX.md");

let cachedCodexGuidance: string | null = null;

function getConfiguredImageEditModel() {
  const configured = process.env.OPENAI_IMAGE_MODEL;

  // Compatibility shim: earlier local setup instructions used gpt-image-2,
  // but the current Images edits API supports the GPT Image 1 family.
  if (configured === "gpt-image-2") {
    return "gpt-image-1.5";
  }

  return configured || "gpt-image-1.5";
}

function getConfiguredQaModel() {
  return process.env.OPENAI_QA_MODEL || "gpt-4o";
}

function isSceneReplacementPrompt(payload: GeneratePayload) {
  const text = [payload.promptStarterText, payload.scenePrompt, payload.posePrompt].filter(Boolean).join(" ").toLowerCase();

  return (
    text.includes("scene replacement") ||
    text.includes("replace only the character") ||
    text.includes("replacement plate") ||
    text.includes("same scene") ||
    text.includes("keep the exact scene")
  );
}

function getOutputSize(aspectRatio: AspectRatio) {
  if (aspectRatio === "1:1") return "1024x1024";
  if (aspectRatio === "9:16") return "1024x1536";
  return "1536x1024";
}

function getMimeTypeFromExtension(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "image/jpeg";
}

function normalizeGuidance(markdown: string) {
  return markdown
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^\s*-\s+/gm, "")
    .replace(/`/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");
}

async function readCodexGuidance() {
  if (cachedCodexGuidance) {
    return cachedCodexGuidance;
  }

  try {
    const markdown = await fs.readFile(CODEX_NOTES_PATH, "utf8");
    cachedCodexGuidance = normalizeGuidance(markdown);
    return cachedCodexGuidance;
  } catch {
    cachedCodexGuidance = "";
    return cachedCodexGuidance;
  }
}

async function publicAssetToDataUrl(src: string) {
  const normalized = src.replace(/^\/+/, "");
  const publicDir = path.join(process.cwd(), "public");
  const absolutePath = path.join(publicDir, normalized);

  if (!absolutePath.startsWith(publicDir)) {
    throw new Error("Invalid background path");
  }

  const file = await fs.readFile(absolutePath);
  const mimeType = getMimeTypeFromExtension(absolutePath);
  return `data:${mimeType};base64,${file.toString("base64")}`;
}

async function resolveImageInput(input?: string | null) {
  if (!input) return null;
  if (input.startsWith("data:")) return input;
  if (/^https?:\/\//i.test(input)) return input;
  if (input.startsWith("/")) return publicAssetToDataUrl(input);
  return null;
}

function dataUrlToBuffer(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Invalid data URL format.");
  }

  const mimeType = match[1];
  const bytes = Buffer.from(match[2], "base64");
  return { mimeType, bytes };
}

function extensionFromMimeType(mimeType: string) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/gif") return "gif";
  return "jpg";
}

async function inputToUploadable(input: string, baseName: string) {
  if (/^https?:\/\//i.test(input)) {
    const response = await fetch(input);
    if (!response.ok) {
      throw new Error(`Could not fetch remote image input: ${baseName}`);
    }
    return response;
  }

  const { mimeType, bytes } = dataUrlToBuffer(input);
  const extension = extensionFromMimeType(mimeType);
  return toFile(bytes, `${baseName}.${extension}`, { type: mimeType });
}

function summarizeReferences(detailReferences: DetailReference[]) {
  const buckets = {
    backgroundBlend: [] as DetailReference[],
    scene: [] as DetailReference[],
    badge: [] as DetailReference[],
    texture: [] as DetailReference[],
    logo: [] as DetailReference[],
    other: [] as DetailReference[],
  };

  for (const detail of detailReferences) {
    switch (detail.role) {
      case "background-blend":
        buckets.backgroundBlend.push(detail);
        break;
      case "scene-reference":
        buckets.scene.push(detail);
        break;
      case "badge-reference":
        buckets.badge.push(detail);
        break;
      case "texture-pattern-reference":
        buckets.texture.push(detail);
        break;
      case "logo-reference":
        buckets.logo.push(detail);
        break;
      default:
        buckets.other.push(detail);
        break;
    }
  }

  return buckets;
}

function formatReferenceList(label: string, references: DetailReference[], guidance: string) {
  if (!references.length) return "";
  return `${label}: ${references
    .map((reference, index) => `${index + 1}. ${reference.name}${reference.notes ? ` - ${reference.notes}` : ""}`)
    .join(" ")}. ${guidance}`;
}

function buildCharacterIdentityBlock(characters: CharacterReference[]) {
  return characters
    .slice(0, 4)
    .map((character, index) => {
      const noteText = character.notes?.trim()
        ? `Required character-specific details: ${character.notes.trim()}.`
        : "";

      return [
        `Character ${index + 1}: ${character.name}.`,
        "This uploaded reference is the exact canonical model sheet for this character.",
        "If this reference contains multiple views, multiple poses, close-up details, or a turnaround sheet, treat all of those views as the same exact character identity.",
        "Use multi-angle information from the reference to preserve exact face construction, body construction, proportions, accessories, and silhouette.",
        "Do not redesign the face, head shape, eye design, mouth style, glasses, body shape, limb length, silhouette, or hand design.",
        "Keep exactly four fingers on each visible hand for this character.",
        "Do not invent a nose if the reference does not include one.",
        "Do not add extra mouth detail, realistic lips, teeth, or altered facial construction.",
        "If the scene request conflicts with identity fidelity, keep identity fidelity and simplify the scene, pose, camera angle, or hand visibility instead.",
        noteText,
      ]
        .filter(Boolean)
        .join(" ");
    })
    .join(" ");
}

function buildCharacterSheetBlock(characterSheets: CharacterReference[]) {
  if (!characterSheets.length) return "";

  return characterSheets
    .slice(0, 4)
    .map((sheet, index) => {
      const noteText = sheet.notes?.trim() ? `Required sheet details: ${sheet.notes.trim()}.` : "";

      return [
        `Character sheet ${index + 1}: ${sheet.name}.`,
        "This is the highest-priority canonical identity reference for the character.",
        "Treat it as a model sheet, turnaround sheet, expression sheet, costume sheet, or detail sheet with stronger authority than ordinary character art.",
        "Use it to lock exact face placement, mouth placement, eye placement, glasses placement, body proportions, hand design, clothing construction, printed shirt design, and accessory placement.",
        noteText,
      ]
        .filter(Boolean)
        .join(" ");
    })
    .join(" ");
}

function buildCharacterTruthLayer(payload: GeneratePayload) {
  const sourceNames = [
    ...(payload.characterSheets || []).map((sheet) => sheet.name),
    ...payload.characters.map((character) => character.name),
  ];

  return [
    "Character truth layer:",
    sourceNames.length
      ? `The canonical identity sources are: ${sourceNames.slice(0, 6).join(", ")}.`
      : "Use the selected visual references as the canonical source of truth.",
    "Treat character sheets and character references as part of the scene reality, not stickers or loose inspiration.",
    "The character must remain exactly on-model even when pose, clothing, staging, or camera angle changes.",
    "Lock the exact face construction, eye placement, mouth placement, glasses placement, head shape, body proportions, silhouette, limb proportions, and hand design.",
    "The face system is extremely minimal and graphic: eyes are only the canonical black lines, dots, or glasses/shades from the reference, and the mouth is only the canonical single black drawn line from the reference.",
    "Do not invent extra facial geometry, extra smile lines, cheek lines, lip edges, nose bridges, nostrils, philtrum marks, dimples, or expression wrinkles.",
    "Lock the exact outfit construction, footwear construction, logo placement, graphic placement, and accessory placement unless the prompt explicitly requests an approved change.",
    "Never add a nose where none exists in the reference.",
    "Never change the mouth shape, mouth thickness, mouth count, expression language, or facial design unless the user explicitly requests an approved expression change and it still matches the model sheet.",
    "Keep exactly four fingers on each visible hand.",
    "Never add duplicate arms, duplicate hands, extra wrists, or merged limbs.",
    "If a clean four-digit hand cannot be shown, partially occlude the hand with props, the chair, clothing, or camera angle rather than showing five digits.",
    "Prefer hand-safe poses: hands resting on furniture, hands gripping objects, or partially hidden hands. Avoid open waving hands unless the exact four-finger design can be preserved perfectly.",
    "Do not stretch, elongate, compress, smooth over, beautify, or reinterpret the character.",
    "If a requested scene element conflicts with exact character fidelity, preserve the character and reduce or simplify the scene instead.",
  ].join(" ");
}

function buildSceneIntegrationLayer() {
  return [
    "Scene integration layer:",
    "Integrate the character naturally into the environment while preserving exact character geometry and identity.",
    "The character should feel physically present in the scene with coherent perspective, contact, shadows, bounce light, and material response.",
    "Do not let scene stylization distort the character's canonical proportions or face construction.",
  ].join(" ");
}

function buildSceneReplacementLayer(payload: GeneratePayload) {
  if (!isSceneReplacementPrompt(payload)) return "";

  return [
    "Scene replacement layer:",
    "Treat the selected background or scene reference as the fixed scene plate.",
    "Keep the same scene composition, chair placement, environment layout, perspective, horizon, lens feel, lighting direction, and overall mood unless the prompt explicitly asks for a controlled change.",
    "Replace only the character presence inside that scene.",
    "Do not rebuild the environment from scratch if a scene plate is provided.",
    "Prefer conservative seated or relaxed posing that matches the scene plate rather than inventing expressive gestures.",
    "For scene replacement, favor one resting hand, one gripping hand, or partially hidden hands over any open spread-finger gesture.",
  ].join(" ");
}

function buildPromotedSingleCharacterSheetLayer(payload: GeneratePayload) {
  if ((payload.characterSheets || []).length > 0 || payload.characters.length !== 1) {
    return "";
  }

  const onlyCharacter = payload.characters[0];

  return [
    `Promoted full-body reference: ${onlyCharacter.name}.`,
    "Because there is a single full-character reference and no explicit character sheet, treat this character reference as a temporary full-body model sheet with strong authority over face, body proportions, clothing logic, shoe branding, and hand design.",
    "Specifically treat this reference as the canonical source for: face and mouth placement, four-finger hand design, shirt graphic placement, shirt logo layout, shoe construction, and shoe logo placement.",
  ].join(" ");
}

function prioritizeDetailReferences(detailReferences: DetailReference[]) {
  const grouped = summarizeReferences(detailReferences);

  return [
    ...grouped.backgroundBlend.slice(0, 2),
    ...grouped.scene.slice(0, 2),
    ...grouped.badge.slice(0, 1),
    ...grouped.texture.slice(0, 1),
    ...grouped.logo.slice(0, 1),
    ...grouped.other.slice(0, 1),
  ];
}

function buildGenerationPrompt(payload: GeneratePayload, codexGuidance: string) {
  const characterSheetSummary = (payload.characterSheets || [])
    .slice(0, 4)
    .map((sheet, index) => `${index + 1}. ${sheet.name}${sheet.notes ? ` - ${sheet.notes}` : ""}`)
    .join(" ");
  const characterSummary = payload.characters
    .slice(0, 4)
    .map((character, index) => `${index + 1}. ${character.name}${character.notes ? ` - ${character.notes}` : ""}`)
    .join(" ");
  const groupedReferences = summarizeReferences(payload.detailReferences || []);
  const characterSheetBlock = buildCharacterSheetBlock(payload.characterSheets || []);
  const characterIdentityBlock = buildCharacterIdentityBlock(payload.characters);

  return [
    `Create one brand-new ${payload.aspectRatio} image.`,
    "Primary goal: exact Good Vibes Club character fidelity with premium brand consistency.",
    "Characters are more important than backgrounds, environments, decorative references, scene complexity, or cinematic flourish.",
    "If there is any tension between character fidelity and scene/background styling, preserve the character exactly and simplify the environment instead.",
    "Priority order: 1) character sheets and exact identity references, 2) exact GVC face language and anatomy rules, 3) pose and clothing request, 4) scene/background request, 5) optional accent references.",
    `Template direction: ${payload.templateName || "custom GVC content"}.`,
    `Tone direction: ${payload.tone || "custom"}.`,
    payload.promptStarterText
      ? `Prompt starter guidance: ${payload.promptStarterText}. Use it only as supporting direction. Never let it override character identity or GVC rules.`
      : "",
    `Camera framing: ${payload.cameraFraming}.`,
    `Scene request: ${payload.scenePrompt}.`,
    payload.posePresetText ? `Pose preset guidance: ${payload.posePresetText}.` : "",
    `Pose and action: ${payload.posePrompt}.`,
    payload.traitPrompt ? `Traits and must-keep details: ${payload.traitPrompt}.` : "",
    `Avoid these outcomes: ${payload.negativePrompt}.`,
    buildCharacterTruthLayer(payload),
    buildSceneIntegrationLayer(),
    buildSceneReplacementLayer(payload),
    buildPromotedSingleCharacterSheetLayer(payload),
    payload.backgroundTitle || payload.backgroundNotes
      ? `Primary environment anchor: ${payload.backgroundTitle || "Selected visual anchor"}. ${payload.backgroundNotes || ""}`
      : "No dedicated background was supplied. Use the selected visual references as the main composition and identity anchors.",
    "The environment should support the chosen visual anchor, not overpower or redesign it.",
    formatReferenceList(
      "Additional background blend references",
      groupedReferences.backgroundBlend,
      "Use these to blend atmosphere, palette, architecture, or composition cues into the main environment without turning the scene into a collage."
    ),
    formatReferenceList(
      "Scene composition references",
      groupedReferences.scene,
      "Use these as scene-building references for world, composition, props, staging, or mood."
    ),
    formatReferenceList(
      "Badge references",
      groupedReferences.badge,
      "Use these as small brand-language details, motifs, symbols, or collectible energy cues only. Do not let badges dominate the composition unless explicitly requested."
    ),
    formatReferenceList(
      "Texture and pattern references",
      groupedReferences.texture,
      "Use these to influence surface treatment, pattern language, and subtle graphic texture. Keep them refined and integrated."
    ),
    formatReferenceList(
      "Logo references",
      groupedReferences.logo,
      "Use these only as restrained brand-language cues unless the prompt explicitly asks for a visible logo."
    ),
    formatReferenceList(
      "Other visual references",
      groupedReferences.other,
      "Use these as secondary supporting references while preserving the main brand direction."
    ),
    characterSheetSummary ? `Reference character sheets: ${characterSheetSummary}.` : "",
    characterSheetBlock,
    `Reference characters: ${characterSummary}.`,
    "Any character notes attached to a reference are mandatory trait-and-detail instructions, not optional suggestions.",
    "Character sheets, if provided, outrank standard character references and should resolve facial placement, clothing graphics, printed shirt details, and exact construction questions.",
    characterIdentityBlock,
    "Character identity lock is the highest priority: preserve exact face design, facial structure, head shape, body proportions, hand style, glasses, mouth style, silhouette, outfit construction, footwear design, and logo/graphic placement with strong consistency.",
    "Treat uploaded characters as exact model sheets, not inspiration.",
    "Do not redesign, beautify, reinterpret, generalize, realisticize, or smooth out the characters.",
    "Pose may change when requested, but identity must not drift.",
    "Clothing may change only when the prompt clearly asks for a wardrobe or outfit change. If clothing changes, keep the same exact character identity, proportions, face, signature design language, and brand logic.",
    "If clothing is not explicitly changed, preserve original outfit logic, shoe design, shirt graphics, logos, and signature accessories.",
    "Integrate all references into one cohesive Good Vibes Club world rather than pasting them literally.",
    "The resulting image must remain stylized in the Good Vibes Club language, not generic realism.",
    "Details matter: keep edges clean, forms readable, proportions intentional, and brand signals consistent.",
    "Color accuracy matters: keep character colors, skin/fur/object colors, eyewear colors, and key palette relationships faithful to the uploaded references unless the prompt explicitly requests a color change.",
    "Do not improvise random extra props, off-brand costumes, unrelated stylistic flourishes, or extra facial features.",
    "If hands become risky, use cleaner hand-safe posing, partial occlusion, or a simpler angle rather than drawing malformed hands.",
    "If a seated or relaxed pose would otherwise create broken hands or extra limbs, prefer fewer clearly visible hands over multiple malformed hands.",
    codexGuidance ? `Project guidance to honor: ${codexGuidance}` : "",
    QUALITY_MATTERS_GUIDANCE,
    GRAPHIC_PLACEMENT_GUIDANCE,
    ANATOMY_GUARDRAILS,
    "Return only the image result with no added text overlay unless explicitly demanded by the prompt.",
    BRAND_STYLE_GUIDE,
  ].join(" ");
}

function extractJsonObject(text: string) {
  const fencedMatch = text.match(/```json\s*([\s\S]*?)```/i);
  if (fencedMatch) {
    return fencedMatch[1].trim();
  }

  const objectMatch = text.match(/\{[\s\S]*\}/);
  return objectMatch ? objectMatch[0] : "";
}

async function runQualityQaCheck(args: {
  client: OpenAI;
  generatedImageDataUrl: string;
  payload: GeneratePayload;
  backgroundDataUrl: string | null;
  prioritizedDetails: DetailReference[];
}) {
  const { client, generatedImageDataUrl, payload, backgroundDataUrl, prioritizedDetails } = args;

  const userContent: Array<
    | { type: "input_text"; text: string }
    | { type: "input_image"; image_url: string; detail: "high" | "auto" }
  > = [
    {
      type: "input_text",
      text: [
        "Audit the generated image for strict Good Vibes Club character fidelity and premium visual quality.",
        "Be strict. If any character truth rule is broken, fail the image.",
        "Use this exact audit hierarchy and prioritize it in both your reasoning and your output.",
        "Hard identity blockers first: 1. no nose, 2. no extra facial geometry, 3. exactly four fingers, 4. body proportions and silhouette, 5. other character identity drift such as mouth drift, glasses alignment drift, head-neck relationship drift, and outfit construction drift if it changes the character read.",
        "Soft fidelity issues come after hard identity: shirt graphics/text, shoe logos/design details, palette drift.",
        "Treat the face as a minimal graphic system, not a realistic sculpted face.",
        "That means there must be no nose geometry of any kind, no protrusion or bump between the canonical eye region and the mouth, and no extra sculpted face feature there at all.",
        "Return JSON only with this shape:",
        '{"pass":boolean,"issues":string[],"correctionPrompt":string,"summary":string,"failures":{"nosePresent":boolean,"extraFacialGeometry":boolean,"mouthDrift":boolean,"glassesAlignmentDrift":boolean,"headNeckProportionDrift":boolean,"outfitConstructionDrift":boolean,"fiveFingers":boolean,"bodyProportionDrift":boolean,"silhouetteDrift":boolean,"shirtGraphicDrift":boolean,"shoeLogoDrift":boolean,"paletteDrift":boolean}}',
        "Fail the image if you detect any hard identity blocker: added nose, nose-like bump, any central protrusion between the canonical eye region and the mouth, any extra sculpted facial feature, extra facial geometry, changed mouth placement, changed mouth thickness, changed mouth style, changed face design, wrong or invented expression, wrong eye or eyewear placement, wrong eye or eyewear alignment relative to the face, wrong head-to-neck relationship, wrong outfit construction if it changes the character read, stretched body proportions, wrong silhouette, five fingers, six fingers, malformed hands, duplicate arms, duplicate hands, ghost limbs, or broken wrists.",
        "Also fail the image for duplicate arms, duplicate hands, ghost limbs, broken wrists, garbled shirt text, garbled shoe marks, outfit drift, extra faint facial lines suggesting a second mouth, any cheek line, any lip edge, any smile crease, or any nose-like facial bump not present in the reference.",
        "Also fail if the scene looks generically AI-smoothed, lighting is incoherent, or material response is muddy.",
        "A visible hand with five or more digits is an automatic failure. A visible nose, nose-like bump, or any central facial protrusion between the canonical eye region and mouth is an automatic failure.",
        "If any hard identity blocker exists, list the hard blocker issues first before any soft fidelity issues.",
        "Soft fidelity issues such as shirt/logo/shoe/palette drift should still be reported, but only after the hard identity blockers.",
        "The correctionPrompt should be a direct image-edit instruction that fixes only the detected failures while preserving the rest of the image.",
      ].join(" "),
    },
    { type: "input_image", image_url: generatedImageDataUrl, detail: "high" },
    {
      type: "input_text",
      text: `Generated image to judge above. Main prompt: ${payload.scenePrompt}. Pose/action: ${payload.posePrompt}.`,
    },
  ];

  for (const sheet of (payload.characterSheets || []).slice(0, 3)) {
    const resolvedSheet = await resolveImageInput(sheet.dataUrl);
    if (!resolvedSheet) continue;
    userContent.push({
      type: "input_text",
      text: `Canonical character sheet reference: ${sheet.name}${sheet.notes ? ` - ${sheet.notes}` : ""}`,
    });
    userContent.push({ type: "input_image", image_url: resolvedSheet, detail: "high" });
  }

  for (const character of payload.characters.slice(0, 3)) {
    const resolvedCharacter = await resolveImageInput(character.dataUrl);
    if (!resolvedCharacter) continue;
    userContent.push({
      type: "input_text",
      text: `Character reference: ${character.name}${character.notes ? ` - ${character.notes}` : ""}`,
    });
    userContent.push({ type: "input_image", image_url: resolvedCharacter, detail: "high" });
  }

  if (backgroundDataUrl) {
    userContent.push({
      type: "input_text",
      text: `Environment anchor reference: ${payload.backgroundTitle || "Selected visual asset"}${payload.backgroundNotes ? ` - ${payload.backgroundNotes}` : ""}`,
    });
    userContent.push({ type: "input_image", image_url: backgroundDataUrl, detail: "auto" });
  }

  for (const detail of prioritizedDetails.slice(0, 2)) {
    const resolved = await resolveImageInput(detail.dataUrl || detail.src || null);
    if (!resolved) continue;
    userContent.push({
      type: "input_text",
      text: `Supporting visual reference: ${detail.name}${detail.notes ? ` - ${detail.notes}` : ""}`,
    });
    userContent.push({ type: "input_image", image_url: resolved, detail: "auto" });
  }

  const response = await client.responses.parse({
    model: getConfiguredQaModel(),
    input: [
      {
        role: "developer",
        content: [
          {
            type: "input_text",
            text: [
              "You are a strict image quality auditor for Good Vibes Club character fidelity.",
              "Character truth is more important than scene beauty.",
              "If any canonical facial, anatomical, clothing-graphic, or accessory rule breaks, mark pass=false.",
              "Return JSON only and do not include markdown outside the JSON object.",
            ].join(" "),
          },
        ],
      },
      {
        role: "user",
        content: userContent,
      },
    ],
    text: {
      format: makeParseableTextFormat<QualityQaResult>({
        type: "json_schema",
        name: "gvc_quality_audit",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            pass: { type: "boolean" },
            issues: {
              type: "array",
              items: { type: "string" },
            },
            correctionPrompt: { type: "string" },
            summary: { type: "string" },
            failures: {
              type: "object",
              additionalProperties: false,
              properties: {
                nosePresent: { type: "boolean" },
                extraFacialGeometry: { type: "boolean" },
                mouthDrift: { type: "boolean" },
                glassesAlignmentDrift: { type: "boolean" },
                headNeckProportionDrift: { type: "boolean" },
                outfitConstructionDrift: { type: "boolean" },
                fiveFingers: { type: "boolean" },
                bodyProportionDrift: { type: "boolean" },
                silhouetteDrift: { type: "boolean" },
                shirtGraphicDrift: { type: "boolean" },
                shoeLogoDrift: { type: "boolean" },
                paletteDrift: { type: "boolean" },
              },
              required: [
                "nosePresent",
                "extraFacialGeometry",
                "mouthDrift",
                "glassesAlignmentDrift",
                "headNeckProportionDrift",
                "outfitConstructionDrift",
                "fiveFingers",
                "bodyProportionDrift",
                "silhouetteDrift",
                "shirtGraphicDrift",
                "shoeLogoDrift",
                "paletteDrift",
              ],
            },
          },
          required: ["pass", "issues", "correctionPrompt", "summary", "failures"],
        },
      }, JSON.parse),
    },
    max_output_tokens: 700,
  });

  const parsed = response.output_parsed;
  if (!parsed) {
    throw new Error(`Quality QA returned no parsed output. Raw output: ${response.output_text || "[empty]"}`);
  }
  return {
    pass: Boolean(parsed.pass),
    issues: Array.isArray(parsed.issues) ? parsed.issues.filter(Boolean) : [],
    correctionPrompt:
      typeof parsed.correctionPrompt === "string" && parsed.correctionPrompt.trim()
        ? parsed.correctionPrompt.trim()
        : "Fix the character fidelity issues while preserving the successful parts of the current image.",
    summary: typeof parsed.summary === "string" ? parsed.summary.trim() : "",
    failures:
      parsed.failures && typeof parsed.failures === "object"
        ? {
            nosePresent: Boolean(parsed.failures.nosePresent),
            extraFacialGeometry: Boolean(parsed.failures.extraFacialGeometry),
            mouthDrift: Boolean(parsed.failures.mouthDrift),
            glassesAlignmentDrift: Boolean(parsed.failures.glassesAlignmentDrift),
            headNeckProportionDrift: Boolean(parsed.failures.headNeckProportionDrift),
            outfitConstructionDrift: Boolean(parsed.failures.outfitConstructionDrift),
            fiveFingers: Boolean(parsed.failures.fiveFingers),
            bodyProportionDrift: Boolean(parsed.failures.bodyProportionDrift),
            silhouetteDrift: Boolean(parsed.failures.silhouetteDrift),
            shirtGraphicDrift: Boolean(parsed.failures.shirtGraphicDrift),
            shoeLogoDrift: Boolean(parsed.failures.shoeLogoDrift),
            paletteDrift: Boolean(parsed.failures.paletteDrift),
          }
        : {
            nosePresent: false,
            extraFacialGeometry: false,
            mouthDrift: false,
            glassesAlignmentDrift: false,
            headNeckProportionDrift: false,
            outfitConstructionDrift: false,
            fiveFingers: false,
            bodyProportionDrift: false,
            silhouetteDrift: false,
            shirtGraphicDrift: false,
            shoeLogoDrift: false,
            paletteDrift: false,
          },
  };
}

function buildCorrectionEditPrompt(args: {
  payload: GeneratePayload;
  codexGuidance: string;
  qa: QualityQaResult;
}) {
  const { payload, codexGuidance, qa } = args;

  const issuesText = qa.issues.join("; ") || qa.summary || "general character fidelity drift";

  return [
    `Revise this ${payload.aspectRatio} image to correct the detected fidelity problems.`,
    "This is a strict surgical repair pass, not a creative reinterpretation pass.",
    "Preserve the successful parts of the current image and the overall scene, but directly rewrite the broken identity and quality details.",
    "Do not make new creative changes unrelated to the audit findings.",
    `Detected issues to fix only: ${issuesText}.`,
    qa.correctionPrompt,
    buildCharacterTruthLayer(payload),
    buildSceneReplacementLayer(payload),
    buildSceneIntegrationLayer(),
    QUALITY_MATTERS_GUIDANCE,
    ANATOMY_GUARDRAILS,
    GRAPHIC_PLACEMENT_GUIDANCE,
    codexGuidance ? `Project guidance to honor: ${codexGuidance}` : "",
    "Correction priority order:",
    "1. Face system fidelity: no nose, no extra facial marks, correct mouth placement/shape, correct glasses alignment, correct head/neck relationship.",
    "2. Exactly four fingers on each visible hand.",
    "3. Silhouette, body proportions, and exact character construction.",
    "4. Outfit construction if it changes the character read.",
    "5. Shirt graphic placement, shirt logo layout, and apparel fidelity.",
    "6. Shoe construction, shoe logo placement, and footwear branding fidelity.",
    "7. Palette fidelity and color batch discipline.",
    "Do not soften, stretch, compress, or re-style the character while repairing the image.",
    "Keep the same scene, same environment, same general camera, and same staging unless a flagged issue requires a local correction.",
    "Do not add a nose.",
    "Do not change mouth placement or mouth style.",
    "Keep the mouth as one single minimal black drawn line only.",
    "Remove any extra cheek line, smile crease, lip edge, second mouth line, or nose-like bump.",
    "Keep eyes only as the canonical glasses, shades, black lines, or dots from the reference. Do not invent extra eye geometry.",
    "Restore exact glasses placement and exact alignment of the glasses relative to the face and eyes from the canonical reference.",
    "Restore the exact head-to-neck relationship and do not widen, narrow, stretch, or compress the head or neck.",
    "Do not change the approved expression language unless it already matches the canonical reference.",
    "Keep exactly four total digits on each visible hand. Five visible digits is unacceptable.",
    "Remove duplicate arms, duplicate hands, ghost limbs, and broken wrists.",
    "If a clean four-finger hand cannot be preserved, hide more of the hand instead of showing five digits.",
    "Correct shirt graphics, slogans, chest logos, shirt layout, and accessory placement if they drifted.",
    "Correct shoe logos, shoe marks, shoe placement, and shoe construction if they drifted.",
    "Remove any faint extra mouth line or secondary facial mark that was not present in the reference.",
    "Correct character proportions and silhouette if they stretched, compressed, widened, narrowed, or otherwise drifted from the canonical reference.",
    "If the silhouette is wrong, prioritize fixing the silhouette before shirt text fidelity.",
    "If the shoe logo placement is wrong, redraw the shoe branding in the correct location rather than leaving a near-miss.",
    "If the palette drifted, restore the canonical character colors before adding scene warmth.",
    "If apparel text cannot be rendered legibly, keep a clean simplified faithful emblem in the exact correct placement rather than inventing broken text.",
    "Keep lighting, material response, and palette premium and coherent.",
    "Do not flatten the render into a generic AI look.",
  ].join(" ");
}

function hasCriticalIdentityFailures(qa: QualityQaResult) {
  return (
    qa.failures.nosePresent ||
    qa.failures.extraFacialGeometry ||
    qa.failures.mouthDrift ||
    qa.failures.glassesAlignmentDrift ||
    qa.failures.headNeckProportionDrift ||
    qa.failures.outfitConstructionDrift ||
    qa.failures.fiveFingers ||
    qa.failures.bodyProportionDrift ||
    qa.failures.silhouetteDrift
  );
}

function buildHardBlockerRepairPrompt(args: {
  payload: GeneratePayload;
  codexGuidance: string;
  qa: QualityQaResult;
}) {
  const { payload, codexGuidance, qa } = args;

  return [
    `Perform a hard-blocker identity repair on this ${payload.aspectRatio} image.`,
    "This pass exists only to repair canonical character failures and must not creatively reinterpret the scene.",
    "Preserve the successful parts of the current image and keep the same scene, camera, chair, and overall composition wherever possible.",
    "Critical repair order:",
    "1. Remove any nose, nose bridge, nostril shape, or nose-like bump immediately.",
    "2. Remove any extra facial geometry or extra facial lines and restore the minimal canonical face system only.",
    "3. Restore exact mouth placement, mouth thickness, mouth curvature, canonical eye or eyewear placement, eye-region alignment, and head/neck relationship from the canonical references.",
    "4. Ensure exactly four fingers on each visible hand. Never show a fifth digit.",
    "5. Restore exact body proportions, silhouette, and outfit construction if the outfit shape or garment build changed the character read.",
    "6. Only after the above, improve shirt graphics, shoe logo placement, and palette fidelity if possible.",
    "If a hand cannot be repaired into a clean four-finger form, hide, crop, occlude, or simplify more of the hand instead of showing five or more digits.",
    "If there is any nose bump, central facial protrusion, or extra sculpted face feature between the canonical eye region and the mouth, flatten and remove that region completely.",
    "If the face cannot be repaired cleanly, simplify back to the canonical mouth-and-eyewear system only.",
    `Current blocker findings: ${qa.issues.join("; ") || qa.summary || "identity drift"}.`,
    buildCharacterTruthLayer(payload),
    buildSceneReplacementLayer(payload),
    buildSceneIntegrationLayer(),
    QUALITY_MATTERS_GUIDANCE,
    ANATOMY_GUARDRAILS,
    GRAPHIC_PLACEMENT_GUIDANCE,
    codexGuidance ? `Project guidance to honor: ${codexGuidance}` : "",
  ].join(" ");
}

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "Missing OPENAI_API_KEY. Add it to your local environment first." },
      { status: 400 }
    );
  }

  try {
    const payload = (await request.json()) as GeneratePayload;

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const backgroundDataUrl = await resolveImageInput(payload.backgroundDataUrl || payload.backgroundSrc || null);

    const codexGuidance = await readCodexGuidance();
    const prompt = buildGenerationPrompt(payload, codexGuidance);

    const resolvedCharacterSheetInputs = await Promise.all(
      (payload.characterSheets || []).slice(0, 4).map(async (sheet, index) => {
        const resolved = await resolveImageInput(sheet.dataUrl);
        if (!resolved) {
          throw new Error(`Character sheet ${index + 1} could not be resolved.`);
        }
        return inputToUploadable(resolved, `character-sheet-${index + 1}`);
      })
    );

    const resolvedCharacterInputs = await Promise.all(
      payload.characters.slice(0, 4).map(async (character, index) => {
        const resolved = await resolveImageInput(character.dataUrl);
        if (!resolved) {
          throw new Error(`Character reference ${index + 1} could not be resolved.`);
        }
        return inputToUploadable(resolved, `character-reference-${index + 1}`);
      })
    );

    const prioritizedDetails = prioritizeDetailReferences(payload.detailReferences || []);

    const resolvedDetailInputs = (
      await Promise.all(
        prioritizedDetails.map(async (detail, index) => {
          const resolved = await resolveImageInput(detail.dataUrl || detail.src || null);
          if (!resolved) return null;
          return inputToUploadable(resolved, `detail-reference-${index + 1}`);
        })
      )
    ).filter((entry): entry is Awaited<ReturnType<typeof inputToUploadable>> => Boolean(entry));

    const imageModel = getConfiguredImageEditModel();

    const replacementMode = isSceneReplacementPrompt(payload);
    const backgroundUpload = backgroundDataUrl
      ? await inputToUploadable(backgroundDataUrl, "primary-background")
      : null;

    const identityInputs = [...resolvedCharacterSheetInputs, ...resolvedCharacterInputs];

    const imageInputs = replacementMode
      ? [
          ...(backgroundUpload ? [backgroundUpload] : []),
          ...identityInputs,
          ...resolvedDetailInputs,
        ]
      : [
          ...identityInputs,
          ...(backgroundUpload ? [backgroundUpload] : []),
          ...resolvedDetailInputs,
        ];

    if (!imageInputs.length) {
      return NextResponse.json({ error: "Select at least one visual asset." }, { status: 400 });
    }

    const response = await client.images.edit({
      model: imageModel,
      image: imageInputs,
      prompt,
      size: getOutputSize(payload.aspectRatio),
      quality: payload.quality,
      background: "auto",
    });

    const initialImage = response.data?.[0];

    if (!initialImage?.b64_json) {
      return NextResponse.json(
        { error: "OpenAI returned no image. Try simplifying the prompt or references." },
        { status: 502 }
      );
    }

    let editedImage: GeneratedImageResult = {
      b64_json: initialImage.b64_json,
      revised_prompt: initialImage.revised_prompt ?? undefined,
    };

    const generatedImageDataUrl = `data:image/png;base64,${editedImage.b64_json}`;

    const qaModel = getConfiguredQaModel();
    let qaResult: QualityQaResult | null = null;
    let qaError: string | null = null;

    try {
      qaResult = await runQualityQaCheck({
        client,
        generatedImageDataUrl,
        payload,
        backgroundDataUrl,
        prioritizedDetails,
      });
    } catch (error) {
      qaResult = null;
      qaError = error instanceof Error ? error.message : "Unknown QA failure";
    }

    let correctionApplied = false;

    if (qaResult && !qaResult.pass) {
      const correctionImageInputs = [await inputToUploadable(generatedImageDataUrl, "generated-candidate"), ...imageInputs];

      const correctionResponse: Awaited<ReturnType<typeof client.images.edit>> = await client.images.edit({
        model: imageModel,
        image: correctionImageInputs,
        prompt: buildCorrectionEditPrompt({
          payload,
          codexGuidance,
          qa: qaResult,
        }),
        size: getOutputSize(payload.aspectRatio),
        quality: payload.quality,
        background: "auto",
      });

      const correctedImage: any = correctionResponse.data?.[0];
      if (correctedImage?.b64_json) {
        correctionApplied = true;
        editedImage = {
          b64_json: correctedImage.b64_json,
          revised_prompt: correctedImage.revised_prompt ?? undefined,
        };
      }
    }

    let finalQaResult = qaResult;
    let finalQaError = qaError;

    if (correctionApplied) {
      const correctedImageDataUrl = `data:image/png;base64,${editedImage.b64_json}`;

      try {
        finalQaResult = await runQualityQaCheck({
          client,
          generatedImageDataUrl: correctedImageDataUrl,
          payload,
          backgroundDataUrl,
          prioritizedDetails,
        });
        finalQaError = null;
      } catch (error) {
        finalQaResult = null;
        finalQaError = error instanceof Error ? error.message : "Unknown QA failure";
      }

      if (finalQaResult && !finalQaResult.pass && hasCriticalIdentityFailures(finalQaResult)) {
        const hardRepairInputs = [await inputToUploadable(correctedImageDataUrl, "hard-repair-candidate"), ...imageInputs];

        const hardRepairResponse: Awaited<ReturnType<typeof client.images.edit>> = await client.images.edit({
          model: imageModel,
          image: hardRepairInputs,
          prompt: buildHardBlockerRepairPrompt({
            payload,
            codexGuidance,
            qa: finalQaResult,
          }),
          size: getOutputSize(payload.aspectRatio),
          quality: payload.quality,
          background: "auto",
        });

        const hardRepairedImage: any = hardRepairResponse.data?.[0];
        if (hardRepairedImage?.b64_json) {
          editedImage = {
            b64_json: hardRepairedImage.b64_json,
            revised_prompt: hardRepairedImage.revised_prompt ?? editedImage.revised_prompt,
          };

          const hardRepairedImageDataUrl = `data:image/png;base64,${editedImage.b64_json}`;
          try {
            finalQaResult = await runQualityQaCheck({
              client,
              generatedImageDataUrl: hardRepairedImageDataUrl,
              payload,
              backgroundDataUrl,
              prioritizedDetails,
            });
            finalQaError = null;
          } catch (error) {
            finalQaResult = null;
            finalQaError = error instanceof Error ? error.message : "Unknown QA failure";
          }
        }
      }
    }

    const finalImage = editedImage;
    if (!finalImage?.b64_json) {
      return NextResponse.json(
        { error: "OpenAI returned no corrected image. Try simplifying the prompt or references." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      imageDataUrl: `data:image/png;base64,${finalImage.b64_json}`,
      revisedPrompt: finalImage.revised_prompt || "",
      model: imageModel,
      size: getOutputSize(payload.aspectRatio),
      quality: payload.quality,
      correctionApplied,
      qaModel,
      qaError: finalQaError,
      qa: finalQaResult
        ? {
            pass: finalQaResult.pass,
            issues: finalQaResult.issues,
            summary: finalQaResult.summary,
          }
        : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected generation error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
