export type AssetCategory =
  | "backgrounds"
  | "character-scenes"
  | "badges"
  | "textures-patterns"
  | "logo"
  | "reactions"
  | "banners";

export type StudioAsset = {
  id: string;
  title: string;
  category: AssetCategory;
  src: string;
  notes: string;
};

export type ContentTemplate = {
  id: string;
  name: string;
  format: string;
  objective: string;
  structure: string[];
  promptSeed: string;
};

export const studioAssets: StudioAsset[] = [
  {
    id: "gold-beach",
    title: "Vibetown Gold Beach",
    category: "backgrounds",
    src: "/library/backgrounds/vibetown-gold-beach.jpg",
    notes: "Hero background with a warm, celebratory vibe.",
  },
  {
    id: "cloud-factory",
    title: "Cloud Factory",
    category: "backgrounds",
    src: "/library/backgrounds/cloud-factory.jpg",
    notes: "Soft scene that works well for updates and storytelling.",
  },
  {
    id: "surfing-wide",
    title: "Surfing Wide",
    category: "backgrounds",
    src: "/library/backgrounds/surfing-wide.jpg",
    notes: "Wide environmental shot for launch banners and recaps.",
  },
  {
    id: "azuls-surf-shack",
    title: "Azul's Surf Shack",
    category: "backgrounds",
    src: "/library/backgrounds/azuls-surf-shack.jpg",
    notes: "Bright surfside backdrop with laid-back energy.",
  },
  {
    id: "chateau-backside-wide",
    title: "Chateau Backside Wide",
    category: "backgrounds",
    src: "/library/backgrounds/chateau-backside-wide.jpg",
    notes: "Wide cinematic chateau scene for bigger compositions.",
  },
  {
    id: "chateau-throne-room",
    title: "Chateau Throne Room",
    category: "backgrounds",
    src: "/library/backgrounds/chateau-throne-room.jpg",
    notes: "Interior setting with a regal, staged mood.",
  },
  {
    id: "closeup-11",
    title: "Closeup 11",
    category: "character-scenes",
    src: "/library/backgrounds/closeup-11.jpg",
    notes: "Graphic close-crop backdrop with mood-heavy framing.",
  },
  {
    id: "closeup-15",
    title: "Closeup 15",
    category: "character-scenes",
    src: "/library/backgrounds/closeup-15.jpg",
    notes: "Tighter background option for portrait-driven outputs.",
  },
  {
    id: "closeup-18",
    title: "Closeup 18",
    category: "character-scenes",
    src: "/library/backgrounds/closeup-18.jpg",
    notes: "Close-up environment with strong color and texture.",
  },
  {
    id: "closeup-21",
    title: "Closeup 21",
    category: "character-scenes",
    src: "/library/backgrounds/closeup-21.jpg",
    notes: "Intimate backdrop for character-focused generations.",
  },
  {
    id: "closeup-32",
    title: "Closeup 32",
    category: "character-scenes",
    src: "/library/backgrounds/closeup-32.jpg",
    notes: "Tonal closeup background with a stylized feel.",
  },
  {
    id: "craig-car-shot",
    title: "Craig Car Shot",
    category: "backgrounds",
    src: "/library/backgrounds/craig-car-shot.jpg",
    notes: "Motion-forward setting for road or adventure scenes.",
  },
  {
    id: "craig-radio-close",
    title: "Craig Radio Close",
    category: "character-scenes",
    src: "/library/backgrounds/craig-radio-close.jpg",
    notes: "Closer lifestyle backdrop with personality and detail.",
  },
  {
    id: "craig-vibestr-mountaintop",
    title: "Craig Vibestr Mountaintop",
    category: "backgrounds",
    src: "/library/backgrounds/craig-vibestr-mountaintop.jpg",
    notes: "Epic scenic backdrop with a high-drama horizon.",
  },
  {
    id: "flag-hurricane-day",
    title: "Flag Hurricane Day",
    category: "backgrounds",
    src: "/library/backgrounds/flag-hurricane-day.jpg",
    notes: "Stormy dynamic setting for dramatic scene prompts.",
  },
  {
    id: "official-citizen-01",
    title: "Official Citizen 01",
    category: "backgrounds",
    src: "/library/backgrounds/official-citizen-01.jpg",
    notes: "Clean branded environment for polished character work.",
  },
  {
    id: "official-citizen-02",
    title: "Official Citizen 02",
    category: "backgrounds",
    src: "/library/backgrounds/official-citizen-02.jpg",
    notes: "Collector-style backdrop with refined visual rhythm.",
  },
  {
    id: "official-citizen-03",
    title: "Official Citizen 03",
    category: "backgrounds",
    src: "/library/backgrounds/official-citizen-03.jpg",
    notes: "Branded character-first environment with visual depth.",
  },
  {
    id: "official-citizen-04",
    title: "Official Citizen 04",
    category: "backgrounds",
    src: "/library/backgrounds/official-citizen-04.jpg",
    notes: "Premium scene base for launch-style compositions.",
  },
  {
    id: "official-citizen-05",
    title: "Official Citizen 05",
    category: "backgrounds",
    src: "/library/backgrounds/official-citizen-05.jpg",
    notes: "Cohesive GVC scene foundation with an editorial feel.",
  },
  {
    id: "surfing",
    title: "Surfing",
    category: "backgrounds",
    src: "/library/backgrounds/surfing.jpg",
    notes: "Action-friendly beach environment with a bright vibe.",
  },
  {
    id: "vibefoot-field",
    title: "Vibefoot Field",
    category: "backgrounds",
    src: "/library/backgrounds/vibefoot-field.jpg",
    notes: "Open outdoor setting for energetic full-body staging.",
  },
  {
    id: "vibefoot-hammock",
    title: "Vibefoot Hammock",
    category: "backgrounds",
    src: "/library/backgrounds/vibefoot-hammock.jpg",
    notes: "Relaxed tropical setup for softer atmospheric scenes.",
  },
  {
    id: "vibetown-aerial",
    title: "Vibetown Aerial",
    category: "backgrounds",
    src: "/library/backgrounds/vibetown-aerial.jpg",
    notes: "Large-scale aerial backdrop for world-building shots.",
  },
  {
    id: "vibetown-nature",
    title: "Vibetown Nature",
    category: "backgrounds",
    src: "/library/backgrounds/vibetown-nature.jpg",
    notes: "Nature-forward scene anchor with a clean GVC palette.",
  },
  {
    id: "vibetown-vibestr-truck",
    title: "Vibetown Vibestr Truck",
    category: "backgrounds",
    src: "/library/backgrounds/vibetown-vibestr-truck.jpg",
    notes: "Vehicle-based setting for story-heavy compositions.",
  },
  {
    id: "vibetown-wide",
    title: "Vibetown Wide",
    category: "backgrounds",
    src: "/library/backgrounds/vibetown-wide.jpg",
    notes: "Roomy wide backdrop for 16:9 hero scenes.",
  },
  {
    id: "chill-vibes-guy",
    title: "Chill Vibes Guy",
    category: "character-scenes",
    src: "/library/characters/chill-vibes-guy-floating.jpg",
    notes: "Relaxed character focal point for quote cards or teasers.",
  },
  {
    id: "craig-portrait",
    title: "Craig Portrait",
    category: "character-scenes",
    src: "/library/characters/craig-portrait.jpg",
    notes: "Strong portrait crop for creator notes and announcements.",
  },
  {
    id: "vibie-group",
    title: "Vibie Group",
    category: "character-scenes",
    src: "/library/characters/vibie-group.jpg",
    notes: "Community-first visual for roundups and recap posts.",
  },
  {
    id: "gold-hand-spin",
    title: "Gold Hand Spin",
    category: "reactions",
    src: "/library/reactions/gold-hand-spin.gif",
    notes: "Looping reaction asset for punchy motion moments.",
  },
  {
    id: "heart-hands",
    title: "Heart Hands",
    category: "reactions",
    src: "/library/reactions/heart-hands.gif",
    notes: "Best for thank-you posts and community love notes.",
  },
  {
    id: "this-is-the-way",
    title: "This Is The Way",
    category: "reactions",
    src: "/library/reactions/this-is-the-way.gif",
    notes: "Perfect for celebration, agreement, or callout content.",
  },
  {
    id: "gold-banner",
    title: "Gold Banner",
    category: "banners",
    src: "/library/banners/gold-banner.jpg",
    notes: "Simple branded banner for headers and call-to-action cards.",
  },
  {
    id: "badge-gold-member",
    title: "Gold Member",
    category: "badges",
    src: "/library/badges/gold_member.webp",
    notes: "Badge reference for premium citizen energy and gold-forward hierarchy.",
  },
  {
    id: "badge-gradient-lover",
    title: "Gradient Lover",
    category: "badges",
    src: "/library/badges/gradient_lover.webp",
    notes: "Badge detail for rainbow gradient styling and playful collector cues.",
  },
  {
    id: "badge-super-rare",
    title: "Super Rare",
    category: "badges",
    src: "/library/badges/super_rare.webp",
    notes: "Badge iconography for rarity-focused prompts and flex compositions.",
  },
  {
    id: "badge-vibetown-baller",
    title: "Vibetown Baller",
    category: "badges",
    src: "/library/badges/vibetown_baller.webp",
    notes: "Badge accent for status-heavy or collector-flex scenes.",
  },
  {
    id: "badge-vibestr-gold-tier",
    title: "VIBESTR Gold Tier",
    category: "badges",
    src: "/library/badges/vibestr_gold_tier.webp",
    notes: "Brand reference for VIBESTR tier styling and metallic visual cues.",
  },
  {
    id: "badge-zoom-in-vibe-out",
    title: "Zoom In Vibe Out",
    category: "badges",
    src: "/library/badges/zoom_in_vibe_out.webp",
    notes: "Badge reference for playful typography-adjacent icon energy.",
  },
  {
    id: "texture-icon-pattern",
    title: "Icon Pattern",
    category: "textures-patterns",
    src: "/library/textures/icon-pattern.jpg",
    notes: "Pattern reference for background overlays, texture, and brand rhythm.",
  },
  {
    id: "logo-logotype",
    title: "GVC Logotype",
    category: "logo",
    src: "/library/logo/gvc-logotype.svg",
    notes: "Primary wordmark reference for brand framing and composition cues.",
  },
  {
    id: "logo-shaka",
    title: "Shaka Icon",
    category: "logo",
    src: "/library/logo/shaka.png",
    notes: "Core logo symbol for iconography, shape language, and branded emphasis.",
  },
];

export const builtInBackgroundAssets = studioAssets.filter((asset) => asset.category === "backgrounds");
export const builtInBrandKitAssets = studioAssets.filter((asset) => asset.category !== "backgrounds");

export const contentTemplates: ContentTemplate[] = [
  {
    id: "drop-announcement",
    name: "Drop Announcement",
    format: "Static social card",
    objective: "Build excitement around a new launch, page, or event.",
    structure: ["Hook line", "What is dropping", "Why it matters", "Simple CTA"],
    promptSeed:
      "Create a bold GVC-style launch card with a gold focal headline, compact supporting copy, and a clear CTA.",
  },
  {
    id: "community-recap",
    name: "Community Recap",
    format: "Carousel or thread opener",
    objective: "Summarize the best moments from a recent stretch of activity.",
    structure: ["Theme title", "3 highlight bullets", "Closing vibe line", "Next-step CTA"],
    promptSeed:
      "Design a recap visual that feels warm, social, and celebratory with room for short highlight bullets.",
  },
  {
    id: "quote-card",
    name: "Quote Card",
    format: "Portrait or square post",
    objective: "Turn a short message into a shareable branded visual.",
    structure: ["Big quote", "Small attribution", "Mood line"],
    promptSeed:
      "Build a clean quote card with oversized shimmering type, subtle texture, and a single expressive image.",
  },
  {
    id: "event-promo",
    name: "Event Promo",
    format: "Story, flyer, or banner",
    objective: "Promote a time-based event with clarity and energy.",
    structure: ["Event name", "Date and time", "Main reason to show up", "CTA"],
    promptSeed:
      "Create an event promo visual with a strong hierarchy, bright gold contrast, and one primary supporting image.",
  },
];
