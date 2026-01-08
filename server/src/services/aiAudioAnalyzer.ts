import OpenAI from 'openai';
import { config } from '../config.js';

export type SceneType = 'combat' | 'exploration' | 'social' | 'tense' | 'dramatic' | 'tavern' | 'forest' | 'dungeon' | 'ambient';

export interface AudioSuggestion {
  // Music/ambiance recommendation
  sceneChange?: {
    newScene: SceneType;
    intensity: number; // 0-1 scale
    reason: string;
  };
  
  // Sound effect recommendation
  soundEffect?: {
    type: string; // e.g., 'sword_clash', 'door_creak', 'thunder', 'spell_cast'
    searchQuery: string; // Query to use for searching audio APIs
    urgency: number; // 0-1 scale, how important this effect is
    reason: string;
  };
}

export interface AnalysisContext {
  recentText: string; // Last few segments combined
  currentScene: SceneType;
  currentIntensity: number;
}

// Common sound effect types mapped to search queries
const EFFECT_QUERIES: Record<string, string[]> = {
  // Combat
  sword_clash: ['sword clash metal', 'sword fight', 'blade impact'],
  shield_block: ['shield block impact', 'metal shield hit'],
  arrow_shoot: ['arrow whoosh', 'bow shoot', 'arrow release'],
  arrow_hit: ['arrow impact', 'arrow thud'],
  hit_impact: ['punch impact', 'hit body', 'combat impact'],
  critical_hit: ['powerful hit impact', 'heavy blow', 'critical strike'],
  death_blow: ['death blow', 'fatal strike', 'final hit'],
  
  // Magic
  spell_cast: ['magic spell cast', 'arcane energy', 'spell release'],
  fireball: ['fireball explosion', 'fire burst magic', 'flame blast'],
  lightning: ['lightning bolt', 'electric shock magic', 'thunder spell'],
  healing: ['healing magic', 'restoration spell', 'divine heal'],
  teleport: ['teleport whoosh', 'magical teleport', 'blink spell'],
  summoning: ['summoning magic', 'conjure creature', 'portal open'],
  
  // Environment
  door_open: ['wooden door open creak', 'door creak', 'heavy door'],
  door_close: ['door close slam', 'door shut'],
  footsteps: ['footsteps stone', 'walking footsteps'],
  running: ['running footsteps', 'fast footsteps'],
  chains: ['chains rattle', 'metal chains'],
  wind: ['wind howling', 'wind gust'],
  rain: ['rain falling', 'rain storm'],
  thunder: ['thunder crack', 'thunderclap', 'storm thunder'],
  fire_crackling: ['fire crackling', 'campfire', 'torch fire'],
  water_splash: ['water splash', 'water drop'],
  cave_drip: ['cave dripping water', 'underground drip'],
  
  // Creatures
  growl: ['monster growl', 'creature growl', 'beast growl'],
  roar: ['dragon roar', 'monster roar', 'beast roar'],
  hiss: ['snake hiss', 'creature hiss'],
  wings: ['wings flapping', 'large wings', 'dragon wings'],
  
  // Social/Other
  crowd_murmur: ['crowd murmur tavern', 'people talking background'],
  laughter: ['laughter crowd', 'people laughing'],
  coins: ['coins jingling', 'gold coins', 'money coins'],
  drink_pour: ['pouring drink', 'mug pour'],
  glass_clink: ['glass clink toast', 'mugs clinking'],
  horse_neigh: ['horse neigh', 'horse whinny'],
  horse_gallop: ['horse galloping', 'horses running'],
  
  // Dramatic
  revelation: ['dramatic reveal', 'revelation sting', 'dramatic moment'],
  suspense: ['suspense tension', 'ominous tone'],
  victory: ['victory fanfare', 'triumph', 'heroic victory'],
  defeat: ['defeat somber', 'sad defeat'],
  death: ['death knell', 'character death', 'tragic death'],
};

export class AIAudioAnalyzer {
  private openai: OpenAI;
  private lastSceneChangeTime = 0;
  private lastEffectTime = 0;
  private minSceneChangeInterval = 30000; // 30 seconds minimum between scene changes
  private minEffectInterval = 5000; // 5 seconds minimum between effects

  constructor() {
    this.openai = new OpenAI({ apiKey: config.openaiApiKey });
  }

  /**
   * Analyze a transcript segment and suggest audio to play
   */
  async analyzeForAudio(
    segmentText: string,
    context: AnalysisContext
  ): Promise<AudioSuggestion | null> {
    const prompt = `You are an audio director for a D&D tabletop session. Analyze this dialogue and suggest appropriate audio.

CURRENT STATE:
- Scene: ${context.currentScene}
- Intensity: ${Math.round(context.currentIntensity * 100)}%
- Recent dialogue: "${context.recentText}"

NEW DIALOGUE:
"${segmentText}"

AVAILABLE SOUND EFFECT TYPES:
${Object.keys(EFFECT_QUERIES).join(', ')}

SCENE TYPES (for music/ambiance):
combat, exploration, social, tense, dramatic, tavern, forest, dungeon, ambient

ANALYZE AND RESPOND:
1. Should the background music/ambiance CHANGE? Only suggest a change if the mood has significantly shifted.
2. Should a SOUND EFFECT play? Suggest one if there's a clear action that warrants it (attack, spell, door opening, etc.)

IMPORTANT RULES:
- Don't suggest music changes for minor dialogue - only for significant mood shifts
- Sound effects should match explicit actions mentioned in the dialogue
- Prefer subtle, non-disruptive effects over dramatic ones
- Combat sounds only during actual fights, not just mentions of weapons
- Be conservative - silence is okay, don't force audio

Respond with JSON:
{
  "sceneChange": {
    "newScene": "scene_type or null",
    "intensity": 0.0-1.0,
    "reason": "brief explanation"
  },
  "soundEffect": {
    "type": "effect_type or null", 
    "urgency": 0.0-1.0,
    "reason": "brief explanation"
  }
}

If no changes needed, use null for the respective fields. Only include what's actually warranted.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are an expert audio director for immersive TTRPG sessions. You have impeccable timing and know when audio enhances vs distracts from gameplay. Be conservative with suggestions.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
        max_tokens: 200,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) return null;

      const parsed = JSON.parse(content);
      const suggestion: AudioSuggestion = {};
      const now = Date.now();

      // Process scene change suggestion
      if (parsed.sceneChange?.newScene && 
          parsed.sceneChange.newScene !== context.currentScene &&
          now - this.lastSceneChangeTime > this.minSceneChangeInterval) {
        suggestion.sceneChange = {
          newScene: parsed.sceneChange.newScene as SceneType,
          intensity: parsed.sceneChange.intensity || 0.5,
          reason: parsed.sceneChange.reason || '',
        };
        this.lastSceneChangeTime = now;
      }

      // Process sound effect suggestion
      if (parsed.soundEffect?.type && 
          EFFECT_QUERIES[parsed.soundEffect.type] &&
          now - this.lastEffectTime > this.minEffectInterval) {
        const queries = EFFECT_QUERIES[parsed.soundEffect.type];
        suggestion.soundEffect = {
          type: parsed.soundEffect.type,
          searchQuery: queries[Math.floor(Math.random() * queries.length)],
          urgency: parsed.soundEffect.urgency || 0.5,
          reason: parsed.soundEffect.reason || '',
        };
        this.lastEffectTime = now;
      }

      // Return null if no suggestions
      if (!suggestion.sceneChange && !suggestion.soundEffect) {
        return null;
      }

      return suggestion;
    } catch (error) {
      console.error('AI audio analysis error:', error);
      return null;
    }
  }

  /**
   * Quick pattern-based effect detection (no API call)
   * Use this for common patterns to reduce API usage
   */
  detectQuickEffects(text: string): { type: string; searchQuery: string } | null {
    const lowerText = text.toLowerCase();

    // Combat patterns
    if (/\b(roll(s|ed)?|rolls?\s+for)\s+initiative\b/i.test(text)) {
      return { type: 'revelation', searchQuery: 'combat start dramatic' };
    }
    if (/\b(critical|nat(ural)?\s*(20|twenty))\b/i.test(text)) {
      return { type: 'critical_hit', searchQuery: 'critical hit powerful impact' };
    }
    if (/\bnat(ural)?\s*(1|one)\b/i.test(text)) {
      return { type: 'defeat', searchQuery: 'fail sound comedic' };
    }
    if (/\b(attack(s|ed)?|strike(s|d)?|hit(s)?|slash(es|ed)?)\b/i.test(text) && 
        /\b(sword|blade|axe|weapon)\b/i.test(text)) {
      return { type: 'sword_clash', searchQuery: EFFECT_QUERIES.sword_clash[0] };
    }

    // Magic patterns
    if (/\bcast(s|ed)?\s+(fireball|fire\s*ball)\b/i.test(text)) {
      return { type: 'fireball', searchQuery: EFFECT_QUERIES.fireball[0] };
    }
    if (/\bcast(s|ed)?\s+(lightning|thunder)\b/i.test(text)) {
      return { type: 'lightning', searchQuery: EFFECT_QUERIES.lightning[0] };
    }
    if (/\b(heal(s|ed)?|healing|cure(s|d)?)\b/i.test(text) && /\b(spell|magic|points?)\b/i.test(text)) {
      return { type: 'healing', searchQuery: EFFECT_QUERIES.healing[0] };
    }
    if (/\bcast(s|ed)?\b/i.test(text) && !/(fireball|lightning|thunder|heal)/i.test(text)) {
      return { type: 'spell_cast', searchQuery: EFFECT_QUERIES.spell_cast[0] };
    }

    // Environment patterns
    if (/\b(open(s|ed)?|push(es|ed)?)\s+(the\s+)?(door|gate)\b/i.test(text)) {
      return { type: 'door_open', searchQuery: EFFECT_QUERIES.door_open[0] };
    }
    if (/\bthunder\b/i.test(text) && !/lightning/i.test(text)) {
      return { type: 'thunder', searchQuery: EFFECT_QUERIES.thunder[0] };
    }

    // Death/unconscious
    if (/\b(falls?\s+unconscious|death\s+saving?\s+throw|dying)\b/i.test(text)) {
      return { type: 'death', searchQuery: EFFECT_QUERIES.death[0] };
    }

    // Creature sounds
    if (/\b(dragon|drake)\b/i.test(text) && /\b(roar(s|ed)?|scream(s|ed)?)\b/i.test(text)) {
      return { type: 'roar', searchQuery: EFFECT_QUERIES.roar[0] };
    }
    if (/\b(growl(s|ed)?|snarl(s|ed)?)\b/i.test(text)) {
      return { type: 'growl', searchQuery: EFFECT_QUERIES.growl[0] };
    }

    return null;
  }

  /**
   * Get a random search query for an effect type
   */
  getEffectSearchQuery(effectType: string): string | null {
    const queries = EFFECT_QUERIES[effectType];
    if (!queries || queries.length === 0) return null;
    return queries[Math.floor(Math.random() * queries.length)];
  }

  /**
   * Generate optimized music search queries for a scene using AI
   * This creates highly specific queries that find the most fitting tracks
   */
  async generateMusicSearchQueries(
    scene: SceneType,
    context?: {
      recentDialogue?: string;
      intensity?: number;
      specificMood?: string;
    }
  ): Promise<{ jamendoQuery: string; freesoundQuery: string; tabletopTags: string[] }> {
    // Default queries if AI is unavailable
    const defaultQueries = this.getDefaultMusicQueries(scene);
    
    if (!config.openaiApiKey) {
      return defaultQueries;
    }

    const intensityDesc = context?.intensity 
      ? (context.intensity > 0.7 ? 'intense/high energy' : context.intensity > 0.4 ? 'moderate energy' : 'calm/low energy')
      : 'moderate energy';

    const prompt = `Generate optimized music search queries for a D&D tabletop session.

SCENE TYPE: ${scene}
INTENSITY: ${intensityDesc}
${context?.recentDialogue ? `RECENT CONTEXT: "${context.recentDialogue.substring(0, 200)}"` : ''}
${context?.specificMood ? `SPECIFIC MOOD: ${context.specificMood}` : ''}

Generate search queries optimized for each music service:

1. JAMENDO (royalty-free music streaming):
   - Use music genre/mood terms
   - Prefer: instrumental, cinematic, orchestral, ambient, folk
   - Examples: "epic orchestral cinematic", "medieval folk acoustic", "dark ambient atmospheric"

2. FREESOUND (sound effects & ambient):
   - Use descriptive soundscape terms
   - Include: ambient, loop, atmosphere, background
   - Examples: "forest birds ambient loop", "dungeon dripping cave atmosphere"

3. TABLETOP AUDIO TAGS (curated TTRPG soundscapes):
   - Pick 2-4 relevant category keywords that SPECIFICALLY match the scene
   - For dungeon scenes: use cave, crypt, underground, catacomb, tomb, mine, sewer (NOT horror - that includes ghost ships!)
   - For combat: battle, combat, siege, war
   - For forest/nature: forest, wilderness, swamp, jungle
   - For tavern/social: tavern, inn, town, market
   - For tension/horror: haunted, suspense, dark, creepy (be specific about setting)
   - Avoid generic tags like "horror" or "dark" alone - they match too many unrelated tracks

Respond with JSON:
{
  "jamendoQuery": "specific search terms for music",
  "freesoundQuery": "specific search terms for ambient sounds",
  "tabletopTags": ["tag1", "tag2"],
  "reasoning": "brief explanation of choices"
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at finding the perfect background music for immersive TTRPG sessions. Generate highly specific, evocative search queries.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
        max_tokens: 200,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) return defaultQueries;

      const parsed = JSON.parse(content);
      
      console.log(`🎼 AI music query for "${scene}": ${parsed.reasoning || 'Generated'}`);
      
      return {
        jamendoQuery: parsed.jamendoQuery || defaultQueries.jamendoQuery,
        freesoundQuery: parsed.freesoundQuery || defaultQueries.freesoundQuery,
        tabletopTags: parsed.tabletopTags || defaultQueries.tabletopTags,
      };
    } catch (error) {
      console.error('AI music query generation error:', error);
      return defaultQueries;
    }
  }

  /**
   * Get default music queries for a scene (no AI required)
   */
  private getDefaultMusicQueries(scene: SceneType): { jamendoQuery: string; freesoundQuery: string; tabletopTags: string[] } {
    const defaults: Record<SceneType, { jamendoQuery: string; freesoundQuery: string; tabletopTags: string[] }> = {
      combat: {
        jamendoQuery: 'epic orchestral battle cinematic intense',
        freesoundQuery: 'battle ambient war atmosphere tension',
        tabletopTags: ['combat', 'battle', 'siege'],
      },
      exploration: {
        jamendoQuery: 'adventure orchestral journey discovery inspiring',
        freesoundQuery: 'exploration ambient outdoor atmosphere mysterious',
        tabletopTags: ['wilderness', 'road', 'journey'],
      },
      social: {
        jamendoQuery: 'medieval folk acoustic tavern happy',
        freesoundQuery: 'tavern crowd ambient medieval inn',
        tabletopTags: ['tavern', 'town', 'market'],
      },
      tense: {
        jamendoQuery: 'dark suspense atmospheric horror ominous',
        freesoundQuery: 'suspense horror ambient dark creepy',
        tabletopTags: ['haunted', 'suspense', 'dark'],
      },
      dramatic: {
        jamendoQuery: 'epic cinematic emotional orchestral powerful',
        freesoundQuery: 'dramatic cinematic atmosphere epic',
        tabletopTags: ['epic', 'temple', 'throne'],
      },
      tavern: {
        jamendoQuery: 'celtic folk acoustic medieval drinking songs',
        freesoundQuery: 'tavern inn medieval crowd fireplace ambient',
        tabletopTags: ['tavern', 'inn', 'pub'],
      },
      forest: {
        jamendoQuery: 'nature peaceful ambient forest calm',
        freesoundQuery: 'forest birds nature ambient outdoor loop',
        tabletopTags: ['forest', 'wilderness', 'swamp'],
      },
      dungeon: {
        jamendoQuery: 'dark ambient underground mysterious eerie cave',
        freesoundQuery: 'dungeon cave dripping underground atmosphere',
        tabletopTags: ['dungeon', 'cave', 'crypt', 'underground', 'catacomb'],
      },
      ambient: {
        jamendoQuery: 'ambient peaceful calm background instrumental',
        freesoundQuery: 'ambient calm peaceful background loop',
        tabletopTags: ['town', 'village', 'peaceful'],
      },
    };

    return defaults[scene] || defaults.ambient;
  }

  /**
   * Reset timing (call when session starts)
   */
  reset(): void {
    this.lastSceneChangeTime = 0;
    this.lastEffectTime = 0;
  }
}

export const aiAudioAnalyzer = new AIAudioAnalyzer();

