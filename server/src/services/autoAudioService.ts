import { freesoundService, FreesoundTrack } from './freesound.js';
import { jamendoService, JamendoTrack } from './jamendo.js';
import { tabletopAudioService, TabletopAudioTrack } from './tabletopAudio.js';
import { aiAudioAnalyzer, AudioSuggestion, SceneType, AnalysisContext } from './aiAudioAnalyzer.js';

export interface AutoAudioSettings {
  enabled: boolean;
  effectFrequency: number; // 0-100, percentage chance to play effects
  musicEnabled: boolean; // Auto-change music with scene
  effectsEnabled: boolean; // Auto-play sound effects
}

export interface AutoAudioTrack {
  id: string;
  name: string;
  src: string;
  type: 'music' | 'effect';
  source: 'freesound' | 'jamendo' | 'tabletop';
  duration: number;
  attribution?: string;
  loop: boolean;
  volume: number;
}

export interface AutoAudioEvent {
  track: AutoAudioTrack;
  action: 'play' | 'crossfade';
  reason: string;
}

// Music search queries for different scenes/moods
const MUSIC_QUERIES: Record<string, string[]> = {
  combat: ['epic battle orchestral', 'intense action music', 'dramatic fight music', 'war drums percussion'],
  exploration: ['adventure journey music', 'exploration ambient', 'wandering orchestral', 'discovery theme'],
  social: ['tavern folk music', 'medieval acoustic', 'happy folk', 'celtic acoustic'],
  tense: ['suspense dark ambient', 'tension horror music', 'ominous orchestral', 'creepy atmosphere'],
  dramatic: ['epic cinematic orchestral', 'dramatic reveal music', 'emotional soundtrack', 'powerful orchestra'],
  tavern: ['medieval tavern music', 'folk pub music', 'acoustic guitar happy', 'drinking songs'],
  forest: ['nature ambient peaceful', 'forest birds ambient', 'woodland atmosphere', 'peaceful nature'],
  dungeon: ['dark dungeon ambient', 'underground cave music', 'mysterious dark', 'eerie atmosphere'],
  ambient: ['calm ambient background', 'peaceful atmosphere', 'relaxing background', 'meditation ambient'],
};

export class AutoAudioService {
  private settings: AutoAudioSettings = {
    enabled: true,
    effectFrequency: 50, // Default 50%
    musicEnabled: true,
    effectsEnabled: true,
  };

  private currentScene: SceneType = 'ambient';
  private currentIntensity = 0.5;
  private recentSegments: string[] = [];
  private maxRecentSegments = 10;

  // Short-lived cache to avoid hitting APIs repeatedly for same query
  private recentSearches: Map<string, { tracks: AutoAudioTrack[]; timestamp: number }> = new Map();
  private searchCacheTTL = 60000; // 1 minute cache

  // Currently playing music track (to avoid repeats)
  private currentMusicTrackId: string | null = null;
  private playedEffectsRecently: Set<string> = new Set();
  private effectCooldown = 30000; // Don't repeat same effect for 30 seconds

  private onAudioEvent: (event: AutoAudioEvent) => void;

  constructor(onAudioEvent: (event: AutoAudioEvent) => void) {
    this.onAudioEvent = onAudioEvent;
  }

  /**
   * Update auto-audio settings
   */
  updateSettings(settings: Partial<AutoAudioSettings>): void {
    this.settings = { ...this.settings, ...settings };
    console.log('🎛️ Auto-audio settings updated:', this.settings);
  }

  getSettings(): AutoAudioSettings {
    return { ...this.settings };
  }

  /**
   * Check if any audio API is available
   */
  private isAnyApiConfigured(): boolean {
    return freesoundService.isConfigured() || jamendoService.isConfigured();
  }

  /**
   * Process a new transcript segment and potentially trigger audio
   */
  async processSegment(text: string): Promise<void> {
    if (!this.settings.enabled) return;
    if (!this.isAnyApiConfigured()) {
      console.warn('⚠️ No audio APIs configured - auto-audio disabled');
      return;
    }

    // Add to recent segments
    this.recentSegments.push(text);
    if (this.recentSegments.length > this.maxRecentSegments) {
      this.recentSegments.shift();
    }

    // First try quick pattern detection (no API call)
    if (this.settings.effectsEnabled) {
      const quickEffect = aiAudioAnalyzer.detectQuickEffects(text);
      if (quickEffect && this.shouldPlayEffect()) {
        await this.searchAndPlayEffect(quickEffect.searchQuery, `Pattern match: ${quickEffect.type}`);
        return; // Don't also do AI analysis if we found a quick match
      }
    }

    // For more nuanced analysis, use AI (every 3rd segment or so to reduce API calls)
    if (this.recentSegments.length % 3 === 0) {
      const context: AnalysisContext = {
        recentText: this.recentSegments.slice(-5).join(' '),
        currentScene: this.currentScene,
        currentIntensity: this.currentIntensity,
      };

      const suggestion = await aiAudioAnalyzer.analyzeForAudio(text, context);
      
      if (suggestion) {
        await this.handleSuggestion(suggestion);
      }
    }
  }

  /**
   * Handle scene change from external source (e.g., AI scene detection)
   */
  async handleSceneChange(scene: SceneType, confidence: number): Promise<void> {
    if (!this.settings.enabled || !this.settings.musicEnabled) return;
    if (!this.isAnyApiConfigured()) return;
    if (confidence < 0.6) return;
    if (scene === this.currentScene) return;

    console.log(`🎭 Scene change detected: ${this.currentScene} -> ${scene}`);
    this.currentScene = scene;
    this.currentIntensity = confidence;

    await this.searchAndPlayMusic(scene, `Scene changed to ${scene}`);
  }

  /**
   * Handle AI audio suggestion
   */
  private async handleSuggestion(suggestion: AudioSuggestion): Promise<void> {
    // Handle scene change (music)
    if (suggestion.sceneChange && this.settings.musicEnabled) {
      const { newScene, intensity, reason } = suggestion.sceneChange;
      if (newScene !== this.currentScene) {
        this.currentScene = newScene;
        this.currentIntensity = intensity;
        await this.searchAndPlayMusic(newScene, reason);
      }
    }

    // Handle sound effect
    if (suggestion.soundEffect && this.settings.effectsEnabled) {
      const { searchQuery, urgency, reason } = suggestion.soundEffect;
      
      // Apply frequency setting - higher urgency effects are more likely to play
      const adjustedChance = this.settings.effectFrequency * (0.5 + urgency * 0.5);
      if (this.shouldPlayEffect(adjustedChance)) {
        await this.searchAndPlayEffect(searchQuery, reason);
      }
    }
  }

  /**
   * Check if we should play an effect based on frequency setting
   */
  private shouldPlayEffect(overrideChance?: number): boolean {
    const chance = overrideChance ?? this.settings.effectFrequency;
    return Math.random() * 100 < chance;
  }

  /**
   * Search for and play music based on scene - uses AI-optimized queries
   */
  private async searchAndPlayMusic(scene: SceneType, reason: string): Promise<void> {
    try {
      console.log(`🔍 Searching music for scene "${scene}"`);

      // Use AI to generate optimized search queries for this scene
      const recentDialogue = this.recentSegments.slice(-3).join(' ');
      const aiQueries = await aiAudioAnalyzer.generateMusicSearchQueries(scene, {
        recentDialogue,
        intensity: this.currentIntensity,
      });

      let track: AutoAudioTrack | null = null;

      // Priority 1: Tabletop Audio (designed specifically for TTRPG!)
      if (tabletopAudioService.isReady()) {
        track = await this.searchTabletopAudioWithTags(scene, aiQueries.tabletopTags);
      }

      // Priority 2: Jamendo (background music) with AI-optimized query
      if (!track && jamendoService.isConfigured()) {
        track = await this.searchJamendo(aiQueries.jamendoQuery);
      }

      // Priority 3: Freesound ambient with AI-optimized query
      if (!track && freesoundService.isConfigured()) {
        track = await this.searchFreesoundAmbient(aiQueries.freesoundQuery);
      }

      if (track && track.id !== this.currentMusicTrackId) {
        this.currentMusicTrackId = track.id;
        this.onAudioEvent({
          track,
          action: 'crossfade',
          reason,
        });
        console.log(`🎵 Auto-music: ${track.name} from ${track.source} (${reason})`);
      } else if (!track) {
        console.warn(`⚠️ No music found for scene "${scene}"`);
      }
    } catch (error) {
      console.error('Failed to search/play music:', error);
    }
  }

  /**
   * Search Tabletop Audio with specific tags from AI
   */
  private async searchTabletopAudioWithTags(scene: SceneType, tags: string[]): Promise<AutoAudioTrack | null> {
    try {
      // First try with AI-suggested tags
      let results: TabletopAudioTrack[] = [];
      for (const tag of tags) {
        const tagResults = await tabletopAudioService.searchByTag(tag);
        const playable = tagResults.filter(t => !tabletopAudioService.isTrackUnplayable(t.id));
        results.push(...playable);
      }

      // Deduplicate
      const seen = new Set<string>();
      results = results.filter(t => {
        if (seen.has(t.id)) return false;
        seen.add(t.id);
        return true;
      });

      if (results.length === 0) {
        // Fall back to scene-based search
        return this.searchTabletopAudio(scene);
      }

      // Shuffle and validate
      const shuffled = [...results].sort(() => Math.random() - 0.5);
      
      for (let i = 0; i < Math.min(5, shuffled.length); i++) {
        const candidate = shuffled[i];
        
        if (`tta-${candidate.id}` === this.currentMusicTrackId || candidate.id === this.currentMusicTrackId) {
          continue;
        }
        
        const isPlayable = await tabletopAudioService.validateTrackUrl(candidate);
        
        if (isPlayable) {
          console.log(`✅ Found playable track via AI tags: ${candidate.name}`);
          return this.tabletopToAutoTrack(candidate);
        }
      }
      
      // Fall back to standard search if AI tags didn't work
      return this.searchTabletopAudio(scene);
    } catch (error) {
      console.error('Tabletop Audio tag search error:', error);
      return this.searchTabletopAudio(scene);
    }
  }

  /**
   * Search Tabletop Audio for scene-appropriate ambiance
   * Validates tracks before returning to ensure they're playable
   */
  private async searchTabletopAudio(scene: SceneType): Promise<AutoAudioTrack | null> {
    try {
      // Get scene tracks, filtering out known unplayable ones
      const allResults = await tabletopAudioService.getSceneTracks(scene);
      const results = allResults.filter(t => !tabletopAudioService.isTrackUnplayable(t.id));
      
      console.log(`🔎 Found ${results.length} Tabletop Audio tracks for scene "${scene}":`, 
        results.slice(0, 5).map(t => `${t.name} [${t.category}]`).join(', '));
      
      if (results.length === 0) {
        console.log(`⚠️ No playable Tabletop Audio tracks for scene "${scene}"`);
        return null;
      }

      // Shuffle results for variety
      const shuffled = [...results].sort(() => Math.random() - 0.5);
      
      // Try to find a playable track (validate up to 5 candidates)
      for (let i = 0; i < Math.min(5, shuffled.length); i++) {
        const candidate = shuffled[i];
        
        // Skip if it's the currently playing track
        if (`tta-${candidate.id}` === this.currentMusicTrackId || candidate.id === this.currentMusicTrackId) {
          console.log(`⏭️ Skipping current track: ${candidate.name}`);
          continue;
        }
        
        // Validate the track URL
        const isPlayable = await tabletopAudioService.validateTrackUrl(candidate);
        
        if (isPlayable) {
          console.log(`✅ Selected track for "${scene}": ${candidate.name}`);
          return this.tabletopToAutoTrack(candidate);
        }
      }
      
      console.log(`⚠️ Could not find a playable Tabletop Audio track for scene "${scene}" after validation`);
      return null;
    } catch (error) {
      console.error('Tabletop Audio search error:', error);
      return null;
    }
  }

  /**
   * Convert Tabletop Audio track to AutoAudioTrack
   */
  private tabletopToAutoTrack(track: TabletopAudioTrack): AutoAudioTrack {
    console.log(`📎 Tabletop Audio track: ${track.name} -> ${track.audioUrl}`);
    
    return {
      id: track.id,
      name: track.name,
      src: track.audioUrl,
      type: 'music',
      source: 'tabletop',
      duration: track.duration,
      attribution: tabletopAudioService.buildAttribution(track),
      loop: true, // Tabletop Audio tracks are designed to loop
      volume: 0.5, // Slightly louder since these are high-quality
    };
  }

  /**
   * Search for and play a sound effect - uses dynamic search
   */
  private async searchAndPlayEffect(searchQuery: string, reason: string): Promise<void> {
    try {
      console.log(`🔍 Searching effect: "${searchQuery}"`);

      let track: AutoAudioTrack | null = null;

      // Use Freesound for sound effects (better for short sounds)
      if (freesoundService.isConfigured()) {
        track = await this.searchFreesoundEffect(searchQuery);
      }

      if (track && !this.playedEffectsRecently.has(track.id)) {
        // Mark as recently played
        this.playedEffectsRecently.add(track.id);
        setTimeout(() => {
          this.playedEffectsRecently.delete(track!.id);
        }, this.effectCooldown);

        this.onAudioEvent({
          track,
          action: 'play',
          reason,
        });
        console.log(`🔊 Auto-effect: ${track.name} (${reason})`);
      } else if (!track) {
        console.warn(`⚠️ No effect found for: "${searchQuery}"`);
      }
    } catch (error) {
      console.error('Failed to search/play effect:', error);
    }
  }

  /**
   * Search Jamendo for music
   */
  private async searchJamendo(query: string): Promise<AutoAudioTrack | null> {
    const cacheKey = `jamendo:${query}`;
    const cached = this.recentSearches.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.searchCacheTTL && cached.tracks.length > 0) {
      // Return random from cache, excluding current
      const available = cached.tracks.filter(t => t.id !== this.currentMusicTrackId);
      if (available.length > 0) {
        return available[Math.floor(Math.random() * available.length)];
      }
    }

    try {
      const results = await jamendoService.search({
        query,
        vocalinstrumental: 'instrumental',
        limit: 15,
        order: 'relevance',
      });

      if (results.results.length === 0) {
        return null;
      }

      const tracks = results.results.map((t: JamendoTrack) => this.jamendoToAutoTrack(t));
      this.recentSearches.set(cacheKey, { tracks, timestamp: Date.now() });

      // Filter out current track and return random
      const available = tracks.filter(t => t.id !== this.currentMusicTrackId);
      return available.length > 0 ? available[Math.floor(Math.random() * available.length)] : null;
    } catch (error) {
      console.error('Jamendo search error:', error);
      return null;
    }
  }

  /**
   * Search Freesound for ambient/music sounds
   */
  private async searchFreesoundAmbient(query: string): Promise<AutoAudioTrack | null> {
    const cacheKey = `freesound-ambient:${query}`;
    const cached = this.recentSearches.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.searchCacheTTL && cached.tracks.length > 0) {
      const available = cached.tracks.filter(t => t.id !== this.currentMusicTrackId);
      if (available.length > 0) {
        return available[Math.floor(Math.random() * available.length)];
      }
    }

    try {
      const results = await freesoundService.search({
        query: `${query} ambient loop`,
        filter: 'duration:[30 TO *]', // At least 30 seconds for ambience
        sort: 'rating_desc',
        pageSize: 15,
      });

      if (results.results.length === 0) {
        return null;
      }

      const tracks = results.results.map((t: FreesoundTrack) => this.freesoundToAutoTrack(t, true));
      this.recentSearches.set(cacheKey, { tracks, timestamp: Date.now() });

      const available = tracks.filter(t => t.id !== this.currentMusicTrackId);
      return available.length > 0 ? available[Math.floor(Math.random() * available.length)] : null;
    } catch (error) {
      console.error('Freesound ambient search error:', error);
      return null;
    }
  }

  /**
   * Search Freesound for sound effects
   */
  private async searchFreesoundEffect(query: string): Promise<AutoAudioTrack | null> {
    const cacheKey = `freesound-effect:${query}`;
    const cached = this.recentSearches.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.searchCacheTTL && cached.tracks.length > 0) {
      return cached.tracks[Math.floor(Math.random() * cached.tracks.length)];
    }

    try {
      const results = await freesoundService.search({
        query,
        filter: 'duration:[0.5 TO 15]', // Short sounds for effects
        sort: 'rating_desc',
        pageSize: 10,
      });

      if (results.results.length === 0) {
        // Try a broader search without duration filter
        const fallbackResults = await freesoundService.search({
          query,
          pageSize: 10,
          sort: 'rating_desc',
        });
        
        if (fallbackResults.results.length === 0) {
          return null;
        }
        
        const tracks = fallbackResults.results.map((t: FreesoundTrack) => this.freesoundToAutoTrack(t, false));
        this.recentSearches.set(cacheKey, { tracks, timestamp: Date.now() });
        return tracks[Math.floor(Math.random() * tracks.length)];
      }

      const tracks = results.results.map((t: FreesoundTrack) => this.freesoundToAutoTrack(t, false));
      this.recentSearches.set(cacheKey, { tracks, timestamp: Date.now() });

      return tracks[Math.floor(Math.random() * tracks.length)];
    } catch (error) {
      console.error('Freesound effect search error:', error);
      return null;
    }
  }

  /**
   * Convert Freesound track to AutoAudioTrack
   */
  private freesoundToAutoTrack(track: FreesoundTrack, isMusic: boolean): AutoAudioTrack {
    const previewUrl = freesoundService.getPreviewUrl(track);
    console.log(`📎 Freesound track: ${track.name} -> ${previewUrl}`);
    
    return {
      id: `freesound-${track.id}`,
      name: track.name,
      src: previewUrl,
      type: isMusic ? 'music' : 'effect',
      source: 'freesound',
      duration: track.duration,
      attribution: freesoundService.buildAttribution(track),
      loop: isMusic, // Loop music, don't loop effects
      volume: isMusic ? 0.4 : 0.7, // Music quieter, effects louder
    };
  }

  /**
   * Convert Jamendo track to AutoAudioTrack
   */
  private jamendoToAutoTrack(track: JamendoTrack): AutoAudioTrack {
    const audioUrl = jamendoService.getAudioUrl(track);
    console.log(`📎 Jamendo track: ${track.name} -> ${audioUrl}`);
    
    return {
      id: `jamendo-${track.id}`,
      name: track.name,
      src: audioUrl,
      type: 'music',
      source: 'jamendo',
      duration: track.duration,
      attribution: `"${track.name}" by ${track.artist_name} - Jamendo`,
      loop: true,
      volume: 0.4, // Background music at lower volume
    };
  }

  /**
   * Manually trigger music for a specific scene
   */
  async manualSceneMusic(scene: SceneType): Promise<void> {
    await this.searchAndPlayMusic(scene, 'Manual scene selection');
  }

  /**
   * Reset state (call when session starts)
   */
  reset(): void {
    this.currentScene = 'ambient';
    this.currentIntensity = 0.5;
    this.recentSegments = [];
    this.currentMusicTrackId = null;
    this.playedEffectsRecently.clear();
    this.recentSearches.clear();
    aiAudioAnalyzer.reset();
    console.log('🔄 Auto-audio service reset');
  }

  /**
   * Clear search cache
   */
  clearCaches(): void {
    this.recentSearches.clear();
    console.log('🗑️ Audio caches cleared');
  }

  /**
   * Get diagnostic info about API configuration
   */
  getDiagnostics(): { freesound: boolean; jamendo: boolean; tabletop: boolean } {
    return {
      freesound: freesoundService.isConfigured(),
      jamendo: jamendoService.isConfigured(),
      tabletop: tabletopAudioService.isReady(),
    };
  }
}
