/**
 * STARTER PACK DATA MODULE
 * 
 * This module contains the curated examples that new users receive to demonstrate
 * the expressive potential of the prompt component system.
 * 
 * Each category contains 10 carefully crafted examples that:
 * - Show the range of creative possibilities
 * - Flow naturally when integrated into prompt prose
 * - Educate users about effective prompt construction
 * - Demonstrate different styles and approaches
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
    "Kaufman's Meta-Narrative Complexity - Stories that fold in on themselves with emotional truth emerging from impossibility",
    "Sorkin's Rapid-Fire Intelligence - Overlapping dialogue at breakneck pace with idealistic characters facing corruption",
    "Goldman's Structural Mastery - Plot mechanics serving character with reversals that feel inevitable in hindsight",
    "Towne's Character Archaeology - Dialogue revealing layers of history with subtext contradicting surface meaning",
    "Wilder's Cynical Romanticism - Sharp wit masking sentiment with morally ambiguous protagonists finding hope",
    "Tarantino's Pop Culture Synthesis - Genre conventions subverted through extended dialogue building character tension",
    "Nolan's Puzzle Box Construction - Nested timelines with concepts explained through action rather than exposition",
    "McKee's Emotional Architecture - Story beats creating maximum impact with surprising yet inevitable character arcs",
    "Ephron's Intimate Observation - Small revealing moments with naturally overheard dialogue and grounded relationships",
    "Mamet's Verbal Minimalism - Spare dialogue implying more than stated with moral complexity through action"
  ],

  films: [
    "Mulholland Drive's Dream Logic - Narrative operating by subconscious rules with identity as fluid construct",
    "2001's Cosmic Evolution - Human development spanning millennia with technology as evolutionary force",
    "Citizen Kane's Rise and Fall - Power's corrupting influence through innovative structure and memory as unreliable narrator",
    "Tokyo Story's Quiet Tragedy - Generational disconnect through subtle observation and time's passage in domestic moments",
    "Vertigo's Obsessive Desire - Love as psychological manipulation with identity as constructed and destructible",
    "Persona's Identity Crisis - Boundaries dissolving between characters with performance and authenticity blurring",
    "Apocalypse Now's Heart of Darkness - War as descent into chaos with civilization's veneer stripped away",
    "The Godfather's Family Business - Crime as alternative American dream with loyalty versus moral compromise",
    "Bicycle Thieves' Economic Desperation - Poverty's pressure on dignity with social systems failing individual needs",
    "8½'s Creative Crisis - Artistic block as paralysis with memories and fantasies interweaving with reality"
  ],

  tones: [
    "Melancholic Nostalgia - Bittersweet longing for irretrievable past with golden hour lighting and haunted characters",
    "Paranoid Conspiracy Thriller - Information as weapon with trust as luxury and truth becoming elusive",
    "Absurdist Dark Comedy - Human behavior as ridiculous with suffering treated through mordant humor",
    "Psychological Horror Unraveling - Reality becoming unreliable with internal fears manifesting as external threats",
    "Epic Mythological Scope - Individual stories reflecting archetypes with natural forces as active participants",
    "Intimate Character Study - Small gestures revealing truth with silence as meaningful as dialogue",
    "Stylized Pop Artifice - Surface appearance as expression with genre conventions as creative playground",
    "Gritty Social Realism - Economic pressures shaping choices with environment as character",
    "Dreamlike Magical Realism - Fantastical elements seamlessly integrated with metaphor made literal",
    "Philosophical Science Fiction - Technology as mirror for humanity with concepts explored through relationships"
  ],

  characters: [
    {
      name: "The Morally Compromised Mentor",
      description: "Experienced guide whose wisdom comes from past failures and moral flexibility. Teaches necessary survival skills while embodying the costs of pragmatic choices. Creates tension between idealism and reality."
    },
    {
      name: "The Reluctant Revolutionary", 
      description: "Ordinary person thrust into extraordinary resistance role, preferring safety to sacrifice but unable to ignore injustice. Growth through forced moral courage despite personal cost."
    },
    {
      name: "The Obsessed Artist",
      description: "Creative genius whose pursuit of perfect expression destroys personal relationships and sanity. Talent as both gift and curse, with creation requiring terrible personal sacrifice."
    },
    {
      name: "The Corrupt System Insider",
      description: "Person embedded within institutional power who discovers its true nature and must choose between complicity and dangerous truth-telling. Knowledge becomes moral burden."
    },
    {
      name: "The Damaged Caregiver",
      description: "Character whose past trauma drives compulsive need to protect others, often at personal expense. Healing others while unable to heal themselves."
    },
    {
      name: "The Privileged Truth-Seeker",
      description: "Wealthy or powerful character who discovers their advantages come from others' suffering. Must choose between comfortable ignorance and uncomfortable action."
    },
    {
      name: "The Survival Pragmatist",
      description: "Character whose harsh experiences have taught ruthless efficiency, but encounters situations requiring trust and vulnerability. Strength versus humanity conflict."
    },
    {
      name: "The Identity Shapeshifter",
      description: "Person whose sense of self changes depending on context or necessity, raising questions about authentic identity versus adaptive survival. Performance as protection."
    },
    {
      name: "The Generational Bridge",
      description: "Character caught between older traditions and newer possibilities, translating between worldviews while belonging fully to neither. Change as personal mission."
    },
    {
      name: "The Innocent Catalyst",
      description: "Naive character whose presence or actions unintentionally expose hidden truths or trigger long-suppressed conflicts. Purity as disruptive force in corrupted systems."
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

module.exports = {
  getStarterPackData,
  getStarterPackCategory,
  getStarterPackCounts,
  STARTER_PACK_DATA
}; 