import { PrismaClient, SceneType } from '@prisma/client';

const prisma = new PrismaClient();

// Default built-in audio tracks
// In a real implementation, these would point to actual audio files
const builtInTracks = [
  // Combat
  {
    name: 'Epic Battle',
    category: 'combat' as SceneType,
    filename: 'combat/epic-battle.mp3',
    duration: 180,
    isBuiltIn: true,
  },
  {
    name: 'Boss Fight',
    category: 'combat' as SceneType,
    filename: 'combat/boss-fight.mp3',
    duration: 240,
    isBuiltIn: true,
  },
  {
    name: 'Skirmish',
    category: 'combat' as SceneType,
    filename: 'combat/skirmish.mp3',
    duration: 120,
    isBuiltIn: true,
  },

  // Exploration
  {
    name: 'Journey Begins',
    category: 'exploration' as SceneType,
    filename: 'exploration/journey-begins.mp3',
    duration: 200,
    isBuiltIn: true,
  },
  {
    name: 'Mountain Pass',
    category: 'exploration' as SceneType,
    filename: 'exploration/mountain-pass.mp3',
    duration: 180,
    isBuiltIn: true,
  },
  {
    name: 'Ocean Voyage',
    category: 'exploration' as SceneType,
    filename: 'exploration/ocean-voyage.mp3',
    duration: 220,
    isBuiltIn: true,
  },

  // Social
  {
    name: 'Court Intrigue',
    category: 'social' as SceneType,
    filename: 'social/court-intrigue.mp3',
    duration: 180,
    isBuiltIn: true,
  },
  {
    name: 'Marketplace',
    category: 'social' as SceneType,
    filename: 'social/marketplace.mp3',
    duration: 150,
    isBuiltIn: true,
  },

  // Tense
  {
    name: 'Growing Dread',
    category: 'tense' as SceneType,
    filename: 'tense/growing-dread.mp3',
    duration: 180,
    isBuiltIn: true,
  },
  {
    name: 'Stalking Shadows',
    category: 'tense' as SceneType,
    filename: 'tense/stalking-shadows.mp3',
    duration: 200,
    isBuiltIn: true,
  },

  // Dramatic
  {
    name: 'Revelation',
    category: 'dramatic' as SceneType,
    filename: 'dramatic/revelation.mp3',
    duration: 90,
    isBuiltIn: true,
  },
  {
    name: 'Victory Fanfare',
    category: 'dramatic' as SceneType,
    filename: 'dramatic/victory-fanfare.mp3',
    duration: 30,
    isBuiltIn: true,
  },
  {
    name: 'Tragedy',
    category: 'dramatic' as SceneType,
    filename: 'dramatic/tragedy.mp3',
    duration: 120,
    isBuiltIn: true,
  },

  // Tavern
  {
    name: 'Cozy Inn',
    category: 'tavern' as SceneType,
    filename: 'tavern/cozy-inn.mp3',
    duration: 240,
    isBuiltIn: true,
  },
  {
    name: 'Rowdy Tavern',
    category: 'tavern' as SceneType,
    filename: 'tavern/rowdy-tavern.mp3',
    duration: 200,
    isBuiltIn: true,
  },
  {
    name: 'Bard\'s Performance',
    category: 'tavern' as SceneType,
    filename: 'tavern/bards-performance.mp3',
    duration: 180,
    isBuiltIn: true,
  },

  // Forest
  {
    name: 'Enchanted Woods',
    category: 'forest' as SceneType,
    filename: 'forest/enchanted-woods.mp3',
    duration: 300,
    isBuiltIn: true,
  },
  {
    name: 'Dark Forest',
    category: 'forest' as SceneType,
    filename: 'forest/dark-forest.mp3',
    duration: 240,
    isBuiltIn: true,
  },
  {
    name: 'Forest Rain',
    category: 'forest' as SceneType,
    filename: 'forest/forest-rain.mp3',
    duration: 360,
    isBuiltIn: true,
  },

  // Dungeon
  {
    name: 'Ancient Crypt',
    category: 'dungeon' as SceneType,
    filename: 'dungeon/ancient-crypt.mp3',
    duration: 240,
    isBuiltIn: true,
  },
  {
    name: 'Underground Lake',
    category: 'dungeon' as SceneType,
    filename: 'dungeon/underground-lake.mp3',
    duration: 200,
    isBuiltIn: true,
  },
  {
    name: 'Abandoned Mine',
    category: 'dungeon' as SceneType,
    filename: 'dungeon/abandoned-mine.mp3',
    duration: 220,
    isBuiltIn: true,
  },

  // Ambient
  {
    name: 'Night Camp',
    category: 'ambient' as SceneType,
    filename: 'ambient/night-camp.mp3',
    duration: 300,
    isBuiltIn: true,
  },
  {
    name: 'Wind Howling',
    category: 'ambient' as SceneType,
    filename: 'ambient/wind-howling.mp3',
    duration: 180,
    isBuiltIn: true,
  },
  {
    name: 'Peaceful Village',
    category: 'ambient' as SceneType,
    filename: 'ambient/peaceful-village.mp3',
    duration: 240,
    isBuiltIn: true,
  },
];

async function seedAudioLibrary() {
  console.log('Seeding audio library...');

  for (const track of builtInTracks) {
    await prisma.audioTrack.upsert({
      where: {
        id: `builtin-${track.filename.replace(/[^a-z0-9]/gi, '-')}`,
      },
      update: track,
      create: {
        id: `builtin-${track.filename.replace(/[^a-z0-9]/gi, '-')}`,
        ...track,
      },
    });
  }

  console.log(`Seeded ${builtInTracks.length} audio tracks.`);
}

seedAudioLibrary()
  .catch(console.error)
  .finally(() => prisma.$disconnect());


