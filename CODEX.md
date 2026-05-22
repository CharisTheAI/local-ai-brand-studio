# Codex Project Notes

This project is a local personal-use content studio built on top of the GVC Builder Kit.

The original builder-kit guidance was recovered from:
- [assets/CLAUDE.md](/C:/Users/Laina/Documents/Codex/2026-04-27/i-want-to-build-a-custom/gvc-builder-kit/assets/CLAUDE.md)
- [CLAUDE.sample.md](/C:/Users/Laina/Documents/Codex/2026-04-27/i-want-to-build-a-custom/gvc-builder-kit/CLAUDE.sample.md)

This file keeps the useful GVC brand rules and implementation guardrails, but is written for Codex and this local app.

## Current product intent

- Keep the app local-first and practical
- Focus on uploaded references, prompt drafting, asset browsing, and image generation
- Support uploaded full-body characters and downloadable image outputs
- Let the user manually upload, classify, edit, and delete visual library assets
- Avoid features that imply official endorsement or commercial distribution

## GVC brand system

### Colors

- Gold (primary): `#FFE048`
- Black (background): `#050505`
- Dark (cards and surfaces): `#121212`
- Gray (borders and dividers): `#1F1F1F`
- Pink accent: `#FF6B9D`
- Orange: `#FF5F1F`
- Green: `#2EFF2E`

### Typography

- Headlines: `Brice`
- Body text: `Mundial`
- `font-display` should map to Brice
- `font-body` should map to Mundial
- If text appears in generated images, default to the GVC brand font system unless the user explicitly asks for something else

### Visual patterns

- Dark backgrounds with gold-led emphasis
- Rounded corners on cards, buttons, and pills
- Borders should stay subtle: low-opacity white or restrained gold
- Gold glow and shimmer effects are on-brand when used sparingly
- Glassmorphism can be used lightly with blur, soft transparency, and subtle borders
- Text hierarchy should lean on white for primary content, gold for emphasis, and softened white for secondary content

### Image-generation character rules

- Uploaded character references are the canonical identity source
- Preserve the exact GVC face language from the uploaded image
- Do not invent a nose if the character design does not include one
- Do not add extra mouth details, lips, teeth, or altered face construction
- Preserve the exact eye language, glasses or eyewear, and the simple drawn mouth style from the uploaded reference
- Each visible hand should have exactly four fingers, matching the uploaded GVC character design
- Do not add a fifth finger
- If anatomy or hands become unstable, simplify or partially occlude rather than inventing off-model details

## App behavior rules

- The visual library should be upload-first, not preloaded in the UI
- Users should be able to add, edit, delete, and reclassify saved assets
- Each saved asset belongs to one collection and one category
- Collections are used to separate kits, campaigns, or character sets
- Assets selected in the library can be passed as prompt and image references for generation
- Backgrounds should remain a dedicated selection, separate from other prompt influence assets
- Character Notes must be treated as required traits and detail instructions during generation

## GVC-specific data rules

### Contracts and tokens

- GVC NFT: `0xB8Ea78fcaCEf50d41375E44E6814ebbA36Bb33c4`
- HighKey Moments: `0x74fcb6eb2a2d02207b36e804d800687ce78d210c`
- VIBESTR Token: `0xd0cC2b0eFb168bFe1f94a948D8df70FA10257196`
- ETH is the base currency for GVC transactions

### Preferred GVC API

All GVC data should come from:
- `https://api-hazel-pi-72.vercel.app/api`

Prefer this API over direct OpenSea integration when building GVC data features.

### Key URLs

- OpenSea Collection: `https://opensea.io/collection/good-vibes-club`
- Badge Explorer: `https://www.goodvibesclub.io/badges/explore`
- GVC Website: `https://www.goodvibesclub.io`

## Near-term expansion ideas

- drag-and-drop positioning directly on the scene preview
- save and load scene presets locally
- add a larger searchable asset catalog
- add optional text overlays and caption layouts
- add stronger reusable character packs and prompt presets

## Hard guardrails

- keep the visible credit: `Made using the GVC Builder Kit`
- non-commercial use only unless written approval is obtained
- do not remove or redistribute raw GVC assets as a standalone pack
- do not imply official Good Vibes Club approval or endorsement unless explicitly granted
