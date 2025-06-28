/**
 * STARTER PACK DATA MODULE
 * 
 * This module contains the curated examples that new users receive to demonstrate
 * the expressive potential of the prompt component system.
 * 
 * Each category contains 10 carefully crafted examples that:
 * - Show the FULL BREADTH of creative possibilities across all mediums and approaches
 * - Mix specific works, authors, genres, atmospheric descriptions, and cultural references
 * - Include literature, TV, theater, journalism, poetry, genre conventions, and experiential moods
 * - Flow naturally when integrated into prompt prose
 * - Educate users that prompts can channel ANY artistic influence, written work, or atmospheric feeling
 * - Balance traditional genre approaches with innovative atmospheric and cross-medium inspirations
 */

const STARTER_PACK_DATA = {
  directors: [
    "Kubrick's Geometric Precision - Methodical visual composition with symmetrical framing that creates psychological unease",
    "Lynch's Surreal Americana - Subverts wholesome imagery with dark undercurrents and dream logic editing",
    "Tarkovsky's Philosophical Cinema - Extended contemplative takes with natural elements as spiritual metaphors",
    "Wes Anderson's Doll House Aesthetic - Hyper-stylized symmetrical compositions in meticulously crafted miniature worlds",
    "Malick's Nature Poetry - Flowing cinematography with whispered voiceovers and golden hour lighting",
    "Fincher's Dark Perfectionism - Razor-sharp digital precision with desaturated colors and atmospheric menace",
    "Scorsese's Kinetic Energy - Propulsive camera movement with popular music as emotional punctuation",
    "Hitchcock's Suspense Architecture - Methodical tension building through precise editing and strategic withholding",
    "Godard's Rebellious Innovation - Jump cuts and direct address that shatter conventional film language",
    "Kurosawa's Epic Humanism - Weather as dramatic force with sweeping action and ensemble dynamics"
  ],

  screenwriters: [
    "Joan Didion's 'The White Album' Fragmentation - Crystalline observations of cultural collapse through personal nervous breakdown",
    "The Catcher in the Rye's Authentic Voice - Teenage disillusionment expressed through stream-of-consciousness vernacular truth-telling",
    "Raymond Carver's 'Cathedral' Minimalism - Blue-collar epiphanies emerging from spare dialogue and unspoken understanding",
    "Toni Morrison's Beloved Haunting - Past trauma bleeding into present reality through poetic ancestral memory",
    "Shakespeare's Hamlet Soliloquies - Internal conflict elevated through verse that makes personal anguish feel cosmic",
    "The Wire's Institutional Dialogue - Street vernacular revealing systemic complexity through authentic character voices",
    "Elena Ferrante's Neapolitan Novels Intimacy - Female friendship dissected through confessional brutal honesty over decades",
    "Sylvia Plath's 'Ariel' Intensity - Raw emotional confession with metaphorical language that transforms pain into art",
    "James Baldwin's 'Giovanni's Room' Moral Complexity - Personal struggle expanding into broader questions of identity and society",
    "New York Times Op-Ed Persuasive Structure - Complex arguments delivered through accessible language and compelling examples"
  ],

  films: [
    "Channeling The Great Gatsby's Jazz Age Decadence - Glittering surface hiding moral emptiness with parties masking desperation",
    "Breaking Bad's Moral Transformation - Ordinary person's gradual descent into corruption through justifiable choices",  
    "Chekhov's Three Sisters Yearning - Characters trapped by circumstance while dreaming of impossible escapes",
    "True Detective's Cosmic Horror - Rural mysticism meeting procedural investigation with time as circular prison",
    "One Hundred Years of Solitude's Magical Realism - Fantastical events treated as mundane within family saga scope",
    "The Wire's Institutional Decay - Systems failing individuals while personal choices echo through community consequences",
    "Hamlet's Paralysis of Thought - Intellectual complexity preventing decisive action with reality questioned at every turn",
    "Studio Ghibli's Environmental Wonder - Nature as living character with childhood innocence confronting adult complexity",
    "David Foster Wallace's Hyperaware Consciousness - Characters drowning in their own self-awareness and cultural critique",
    "The Twilight Zone's Moral Fables - Ordinary situations revealing deeper truths about human nature through supernatural lens"
  ],

  tones: [
    "Rain-Soaked Melancholy with Sudden Sunbreak - Persistent sadness interrupted by moments of unexpected hope and clarity",
    "Paranoid Conspiracy Thriller - Information as weapon with trust as luxury and truth becoming elusive",
    "3 AM Convenience Store Fluorescence - Harsh artificial light revealing life's mundane desperation and quiet dignity",
    "Absurdist Dark Comedy - Human behavior as ridiculous with suffering treated through mordant humor",
    "Jazz Club Cigarette Smoke Intimacy - Dimly lit confession spaces where truth emerges through musical conversation",
    "Psychological Horror Unraveling - Reality becoming unreliable with internal fears manifesting as external threats",
    "Summer Afternoon Suburban Unease - Perfect lawns hiding family secrets with air conditioning hum masking tension",
    "Epic Mythological Scope - Individual stories reflecting archetypes with natural forces as active participants",
    "Small Town Diner Coffee Shop Americana - Blue-collar wisdom shared over bottomless cups in vinyl booth therapy sessions",
    "Golden Hour Nostalgia with Dark Undertones - Beautiful light concealing painful truths about memory and loss"
  ],

  characters: [
    {
      name: "Frank Castellano",
      description: "The Morally Compromised Mentor - Experienced guide whose wisdom comes from past failures and moral flexibility. Teaches necessary survival skills while embodying the costs of pragmatic choices. Creates tension between idealism and reality."
    },
    {
      name: "Maya Patel", 
      description: "The Reluctant Revolutionary - Ordinary person thrust into extraordinary resistance role, preferring safety to sacrifice but unable to ignore injustice. Growth through forced moral courage despite personal cost."
    },
    {
      name: "Vincent Torres",
      description: "The Obsessed Artist - Creative genius whose pursuit of perfect expression destroys personal relationships and sanity. Talent as both gift and curse, with creation requiring terrible personal sacrifice."
    },
    {
      name: "Diana Wellington",
      description: "The Corrupt System Insider - Person embedded within institutional power who discovers its true nature and must choose between complicity and dangerous truth-telling. Knowledge becomes moral burden."
    },
    {
      name: "Sarah Kim",
      description: "The Damaged Caregiver - Character whose past trauma drives compulsive need to protect others, often at personal expense. Healing others while unable to heal themselves."
    },
    {
      name: "Alexander Hartwell",
      description: "The Privileged Truth-Seeker - Wealthy or powerful character who discovers their advantages come from others' suffering. Must choose between comfortable ignorance and uncomfortable action."
    },
    {
      name: "Rosa Martinez",
      description: "The Survival Pragmatist - Character whose harsh experiences have taught ruthless efficiency, but encounters situations requiring trust and vulnerability. Strength versus humanity conflict."
    },
    {
      name: "Jamie Chen",
      description: "The Identity Shapeshifter - Person whose sense of self changes depending on context or necessity, raising questions about authentic identity versus adaptive survival. Performance as protection."
    },
    {
      name: "David Okafor",
      description: "The Generational Bridge - Character caught between older traditions and newer possibilities, translating between worldviews while belonging fully to neither. Change as personal mission."
    },
    {
      name: "Emma Sullivan",
      description: "The Innocent Catalyst - Naive character whose presence or actions unintentionally expose hidden truths or trigger long-suppressed conflicts. Purity as disruptive force in corrupted systems."
    }
  ]
};

/**
 * Get the complete starter pack data
 */
function getStarterPackData() {
  return STARTER_PACK_DATA;
}

/**
 * Get starter pack data for a specific category
 */
function getStarterPackCategory(category) {
  return STARTER_PACK_DATA[category] || [];
}

/**
 * Get counts for all starter pack categories
 */
function getStarterPackCounts() {
  return {
    directors: STARTER_PACK_DATA.directors.length,
    screenwriters: STARTER_PACK_DATA.screenwriters.length,
    films: STARTER_PACK_DATA.films.length,
    tones: STARTER_PACK_DATA.tones.length,
    characters: STARTER_PACK_DATA.characters.length,
    total: Object.values(STARTER_PACK_DATA).reduce((sum, category) => sum + category.length, 0)
  };
}

/**
 * Generate a safe entry key from a name string
 */
function generateEntryKey(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-')         // Replace spaces with hyphens
    .substring(0, 50);            // Limit length
}

module.exports = {
  getStarterPackData,
  getStarterPackCategory,
  getStarterPackCounts,
  generateEntryKey,
  STARTER_PACK_DATA
}; 