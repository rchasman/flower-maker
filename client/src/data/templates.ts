// All 46 flower templates mirrored from crates/flower-core/src/templates.rs.
// This is the client-side reference for the template picker UI.

export interface TemplateInfo {
  name: string;
  scientific: string;
  colors: string[];
  occasions: string[];
  season: string;
  category: "focal" | "standard" | "accent" | "spray";
}

export const TEMPLATES: TemplateInfo[] = [
  // ── Focal flowers (hand-crafted in Rust) ──────────────────────────────
  { name: "Rose", scientific: "Rosa damascena", colors: ["Red", "Pink", "White", "Yellow", "Peach", "Lavender", "Orange", "Coral"], occasions: ["Anniversary", "Love & Romance", "Birthday", "Thank You", "Sympathy", "Congratulations"], season: "Year-round", category: "focal" },
  { name: "Sunflower", scientific: "Helianthus annuus", colors: ["Yellow", "Orange", "Red", "Brown"], occasions: ["Birthday", "Congratulations", "Thank You", "Get Well"], season: "Summer-Fall", category: "focal" },
  { name: "Daisy", scientific: "Bellis perennis", colors: ["White", "Pink", "Yellow"], occasions: ["Birthday", "Get Well", "Thank You"], season: "Spring-Summer", category: "focal" },
  { name: "Orchid", scientific: "Phalaenopsis amabilis", colors: ["White", "Purple", "Pink", "Yellow"], occasions: ["Anniversary", "Love & Romance", "Birthday", "Thank You", "Congratulations"], season: "Year-round", category: "focal" },
  { name: "Tulip", scientific: "Tulipa gesneriana", colors: ["Red", "Yellow", "Purple", "Pink", "White", "Orange"], occasions: ["Anniversary", "Birthday", "Love & Romance", "Thank You"], season: "Spring", category: "focal" },

  // ── Standard florist flowers ──────────────────────────────────────────
  { name: "Carnation", scientific: "Dianthus caryophyllus", colors: ["Red", "White", "Pink", "Yellow", "Orange", "Lavender"], occasions: ["Birthday", "Get Well", "Sympathy", "Thank You"], season: "Year-round", category: "standard" },
  { name: "Gerbera Daisy", scientific: "Gerbera jamesonii", colors: ["Red", "White", "Pink", "Yellow", "Orange"], occasions: ["Birthday", "Congratulations", "Thank You"], season: "Year-round", category: "standard" },
  { name: "Lily", scientific: "Lilium candidum", colors: ["White", "Pink", "Yellow", "Orange"], occasions: ["Anniversary", "Sympathy", "Thank You"], season: "Summer", category: "standard" },
  { name: "Alstroemeria", scientific: "Alstroemeria aurea", colors: ["Pink", "White", "Yellow", "Orange", "Lavender"], occasions: ["Birthday", "Thank You"], season: "Year-round", category: "standard" },
  { name: "Hydrangea", scientific: "Hydrangea macrophylla", colors: ["Blue", "White", "Pink", "Green"], occasions: ["Anniversary", "Sympathy"], season: "Summer", category: "standard" },
  { name: "Iris", scientific: "Iris germanica", colors: ["Blue", "Purple", "White"], occasions: ["Birthday", "Thank You"], season: "Spring", category: "standard" },
  { name: "Snapdragon", scientific: "Antirrhinum majus", colors: ["Pink", "White", "Yellow", "Orange"], occasions: ["Anniversary", "Congratulations"], season: "Spring-Fall", category: "standard" },
  { name: "Stock", scientific: "Matthiola incana", colors: ["Pink", "White", "Lavender"], occasions: ["Anniversary", "Thank You"], season: "Spring", category: "standard" },
  { name: "Aster", scientific: "Aster amellus", colors: ["Purple", "Pink", "White"], occasions: ["Birthday", "Thank You"], season: "Fall", category: "standard" },
  { name: "Lisianthus", scientific: "Eustoma grandiflorum", colors: ["Purple", "White", "Pink"], occasions: ["Anniversary", "Love & Romance"], season: "Summer", category: "standard" },
  { name: "Chrysanthemum", scientific: "Chrysanthemum morifolium", colors: ["Yellow", "White", "Lavender", "Pink"], occasions: ["Birthday", "Get Well", "Thank You"], season: "Fall", category: "standard" },
  { name: "Delphinium", scientific: "Delphinium elatum", colors: ["Blue", "White"], occasions: ["Anniversary", "Congratulations"], season: "Summer", category: "standard" },
  { name: "Peony", scientific: "Paeonia lactiflora", colors: ["Pink", "White", "Red"], occasions: ["Anniversary", "Love & Romance"], season: "Spring", category: "standard" },
  { name: "Freesia", scientific: "Freesia refracta", colors: ["White", "Yellow", "Pink", "Lavender"], occasions: ["Birthday", "Thank You"], season: "Spring", category: "standard" },
  { name: "Ranunculus", scientific: "Ranunculus asiaticus", colors: ["Pink", "White", "Yellow", "Orange", "Red"], occasions: ["Anniversary", "Love & Romance"], season: "Spring", category: "standard" },
  { name: "Dahlia", scientific: "Dahlia pinnata", colors: ["Red", "Pink", "Yellow", "Orange", "White"], occasions: ["Birthday", "Thank You"], season: "Summer-Fall", category: "standard" },
  { name: "Sweet Pea", scientific: "Lathyrus odoratus", colors: ["Pink", "White", "Lavender"], occasions: ["Anniversary", "Love & Romance"], season: "Spring", category: "standard" },
  { name: "Gladiolus", scientific: "Gladiolus communis", colors: ["White", "Pink", "Red", "Yellow", "Purple"], occasions: ["Anniversary", "Thank You"], season: "Summer", category: "standard" },
  { name: "Larkspur", scientific: "Consolida ajacis", colors: ["Purple", "Pink", "White"], occasions: ["Anniversary", "Congratulations"], season: "Summer", category: "standard" },
  { name: "Liatris", scientific: "Liatris spicata", colors: ["Purple"], occasions: ["Anniversary", "Congratulations"], season: "Summer", category: "standard" },
  { name: "Bells of Ireland", scientific: "Moluccella laevis", colors: ["Green"], occasions: ["Anniversary", "Congratulations"], season: "Summer", category: "standard" },

  // ── Accent / Filler flowers ───────────────────────────────────────────
  { name: "Solidago", scientific: "Solidago canadensis", colors: ["Yellow"], occasions: ["Get Well", "Thank You"], season: "Fall", category: "accent" },
  { name: "Hypericum", scientific: "Hypericum androsaemum", colors: ["Green", "Red", "Pink"], occasions: ["Birthday", "Thank You"], season: "Summer-Fall", category: "accent" },
  { name: "Statice", scientific: "Limonium sinuatum", colors: ["Purple", "Lavender"], occasions: ["Get Well", "Thank You"], season: "Summer", category: "accent" },
  { name: "Waxflower", scientific: "Chamelaucium uncinatum", colors: ["Pink", "White"], occasions: ["Anniversary", "Thank You"], season: "Winter-Spring", category: "accent" },
  { name: "Queen Anne's Lace", scientific: "Daucus carota", colors: ["White"], occasions: ["Anniversary", "Thank You"], season: "Summer", category: "accent" },
  { name: "Heather", scientific: "Calluna vulgaris", colors: ["Pink", "Purple"], occasions: ["Anniversary", "Thank You"], season: "Fall", category: "accent" },
  { name: "Bupleurum", scientific: "Bupleurum rotundifolium", colors: ["Green"], occasions: ["Birthday", "Thank You"], season: "Summer", category: "accent" },
  { name: "Yarrow", scientific: "Achillea millefolium", colors: ["Yellow"], occasions: ["Get Well", "Thank You"], season: "Summer", category: "accent" },
  { name: "Limonium", scientific: "Limonium latifolium", colors: ["Lavender", "Purple"], occasions: ["Get Well", "Thank You"], season: "Summer", category: "accent" },

  // ── Spray / Pom types ─────────────────────────────────────────────────
  { name: "Spray Rose", scientific: "Rosa spray", colors: ["Red", "White", "Pink", "Yellow", "Orange", "Peach"], occasions: ["Anniversary", "Birthday", "Love & Romance", "Thank You"], season: "Year-round", category: "spray" },
  { name: "Mini Carnation", scientific: "Dianthus caryophyllus mini", colors: ["Red", "Pink", "White", "Yellow", "Orange"], occasions: ["Birthday", "Get Well", "Thank You"], season: "Year-round", category: "spray" },
  { name: "Button Pom", scientific: "Chrysanthemum button", colors: ["Green", "Yellow"], occasions: ["Birthday", "Thank You"], season: "Fall", category: "spray" },
  { name: "Fuji Mum", scientific: "Chrysanthemum fuji", colors: ["Lavender", "Green", "White"], occasions: ["Anniversary", "Thank You"], season: "Fall", category: "spray" },
  { name: "Cushion Pom", scientific: "Chrysanthemum cushion", colors: ["Yellow", "Green", "White"], occasions: ["Birthday", "Thank You"], season: "Fall", category: "spray" },
  { name: "Kermit Pom", scientific: "Chrysanthemum kermit", colors: ["Green"], occasions: ["Birthday", "Thank You"], season: "Fall", category: "spray" },
  { name: "Spray Mum", scientific: "Chrysanthemum spray", colors: ["Yellow", "White", "Lavender", "Pink"], occasions: ["Birthday", "Get Well", "Thank You"], season: "Fall", category: "spray" },
  { name: "Matsumoto Aster", scientific: "Callistephus chinensis", colors: ["Pink", "Purple", "Lavender", "White"], occasions: ["Birthday", "Thank You"], season: "Summer-Fall", category: "spray" },
  { name: "Sweet William", scientific: "Dianthus barbatus", colors: ["Pink", "Red", "White", "Purple"], occasions: ["Birthday", "Thank You"], season: "Spring-Summer", category: "spray" },
  { name: "Solidaster", scientific: "x Solidaster luteus", colors: ["Yellow"], occasions: ["Get Well", "Thank You"], season: "Summer-Fall", category: "spray" },
];

const CATEGORY_LABELS: Record<TemplateInfo["category"], string> = {
  focal: "Focal",
  standard: "Standard",
  accent: "Accent / Filler",
  spray: "Spray / Pom",
};

/** Group templates by category for display. */
export function templatesByCategory(): {
  label: string;
  category: TemplateInfo["category"];
  templates: TemplateInfo[];
}[] {
  const categories: TemplateInfo["category"][] = [
    "focal",
    "standard",
    "accent",
    "spray",
  ];
  return categories.map(cat => ({
    label: CATEGORY_LABELS[cat],
    category: cat,
    templates: TEMPLATES.filter(t => t.category === cat),
  }));
}
