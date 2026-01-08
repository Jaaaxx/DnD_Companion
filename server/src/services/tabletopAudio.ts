/**
 * Tabletop Audio Service
 * 
 * Fetches tracks from Tabletop Audio's public API (tabletopaudio.com)
 * These are high-quality 10-minute soundscapes perfect for D&D sessions.
 * 
 * API provides direct MP3 streaming URLs!
 */

export interface TabletopAudioTrack {
  id: string;
  name: string;
  description: string;
  category: string;
  genres: string[];
  duration: number; // seconds (most are ~600s / 10 minutes)
  audioUrl: string; // Direct MP3 streaming URL
  imageUrl: string;
  tags: string[];
  isNew: boolean;
}

// Raw API response shape
interface TabletopApiTrack {
  key: number;
  track_title: string;
  track_type: string;
  track_genre: string[];
  flavor_text: string;
  link: string;
  small_image: string;
  large_image: string;
  new: string;
  tags: string[];
}

interface TabletopApiResponse {
  tracks: TabletopApiTrack[];
}

// Map genres to D&D scene categories
// Order matters! More specific categories should be checked first
function mapToCategory(genres: string[], tags: string[], trackName: string = ''): string {
  const allTerms = [...genres, ...tags].map(t => t.toLowerCase());
  const nameLower = trackName.toLowerCase();
  
  // Dungeon/Underground - check first and be comprehensive
  // These terms strongly indicate underground/dungeon settings
  const dungeonTerms = ['dungeon', 'cave', 'underground', 'catacomb', 'crypt', 'tomb', 
                        'cavern', 'mine', 'sewer', 'barrow', 'lair', 'depths', 'grotto'];
  if (allTerms.some(t => dungeonTerms.includes(t)) || 
      dungeonTerms.some(t => nameLower.includes(t))) {
    return 'dungeon';
  }
  
  // Combat
  if (allTerms.some(t => ['combat', 'battle', 'fight', 'war', 'siege', 'arena'].includes(t))) {
    return 'combat';
  }
  
  // Tavern/Social
  if (allTerms.some(t => ['tavern', 'inn', 'pub', 'bar', 'feast', 'party'].includes(t))) {
    return 'tavern';
  }
  
  // Forest/Nature
  if (allTerms.some(t => ['forest', 'woods', 'jungle', 'nature', 'birds', 'trees', 'swamp'].includes(t))) {
    return 'forest';
  }
  
  // Town/City
  if (allTerms.some(t => ['town', 'city', 'market', 'village', 'street', 'urban'].includes(t))) {
    return 'town';
  }
  
  // Water (ships, ocean, etc.)
  if (allTerms.some(t => ['ocean', 'sea', 'water', 'ship', 'boat', 'river', 'rain', 'nautical'].includes(t))) {
    return 'water';
  }
  
  // Tense/Horror - AFTER water to avoid ghost ships being categorized as tense
  // Only use if track doesn't have water/ship themes
  if (allTerms.some(t => ['horror', 'scary', 'creepy', 'haunted', 'ghost', 'dark', 'evil'].includes(t)) &&
      !allTerms.some(t => ['ship', 'ocean', 'sea', 'boat'].includes(t))) {
    return 'tense';
  }
  
  // Sci-fi (for modern campaigns)
  if (allTerms.some(t => ['scifi', 'sci-fi', 'space', 'spaceship', 'laboratory'].includes(t))) {
    return 'scifi';
  }
  
  // Default to ambient/exploration
  if (genres.includes('music')) {
    return 'music';
  }
  
  return 'ambient';
}

export class TabletopAudioService {
  private tracks: TabletopAudioTrack[] = [];
  private lastFetch = 0;
  private fetchInterval = 60 * 60 * 1000; // Refresh every hour
  private isLoading = false;
  private loadPromise: Promise<void> | null = null;
  
  // Track IDs that have been found to be unplayable (401, 403, etc.)
  private unplayableTracks: Set<string> = new Set();
  private validatedTracks: Set<string> = new Set();

  constructor() {
    // Initial load
    this.loadTracks();
  }

  /**
   * Check if a track URL is accessible (HEAD request with timeout)
   */
  async validateTrackUrl(track: TabletopAudioTrack): Promise<boolean> {
    // Already known to be unplayable
    if (this.unplayableTracks.has(track.id)) {
      return false;
    }
    
    // Already validated as playable
    if (this.validatedTracks.has(track.id)) {
      return true;
    }

    try {
      // Create an abort controller with 3 second timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      
      const response = await fetch(track.audioUrl, {
        method: 'HEAD',
        headers: {
          'Accept': 'audio/*',
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeout);
      
      if (response.ok) {
        this.validatedTracks.add(track.id);
        return true;
      } else {
        console.warn(`⚠️ Tabletop Audio track "${track.name}" returned ${response.status} - marking as unplayable`);
        this.unplayableTracks.add(track.id);
        return false;
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn(`⚠️ Validation timed out for track "${track.name}"`);
      } else {
        console.warn(`⚠️ Failed to validate track "${track.name}":`, error);
      }
      this.unplayableTracks.add(track.id);
      return false;
    }
  }

  /**
   * Mark a track as unplayable (called when playback fails)
   */
  markAsUnplayable(trackId: string): void {
    this.unplayableTracks.add(trackId);
    this.validatedTracks.delete(trackId);
    console.log(`🚫 Marked track ${trackId} as unplayable`);
  }

  /**
   * Check if a track is known to be unplayable
   */
  isTrackUnplayable(trackId: string): boolean {
    return this.unplayableTracks.has(trackId);
  }

  /**
   * Get playable tracks only (filters out known unplayable tracks)
   */
  getPlayableTracks(): TabletopAudioTrack[] {
    return this.tracks.filter(track => !this.unplayableTracks.has(track.id));
  }

  /**
   * Load tracks from the API
   */
  private async loadTracks(): Promise<void> {
    if (this.isLoading) {
      return this.loadPromise || Promise.resolve();
    }

    this.isLoading = true;
    this.loadPromise = this.fetchTracks();
    
    try {
      await this.loadPromise;
    } finally {
      this.isLoading = false;
      this.loadPromise = null;
    }
  }

  private async fetchTracks(): Promise<void> {
    try {
      console.log('🎵 Fetching Tabletop Audio catalog...');
      
      const response = await fetch('https://tabletopaudio.com/tta_data');
      
      if (!response.ok) {
        throw new Error(`Tabletop Audio API error: ${response.status}`);
      }

      const data: TabletopApiResponse = await response.json();
      
      this.tracks = data.tracks.map((track): TabletopAudioTrack => ({
        id: `tta-${track.key}`,
        name: track.track_title,
        description: track.flavor_text,
        category: mapToCategory(track.track_genre, track.tags, track.track_title),
        genres: track.track_genre,
        duration: 600, // Most tracks are ~10 minutes
        audioUrl: track.link, // Direct MP3 URL!
        imageUrl: track.large_image || track.small_image,
        tags: track.tags,
        isNew: track.new === 'true',
      }));

      this.lastFetch = Date.now();
      console.log(`✅ Loaded ${this.tracks.length} Tabletop Audio tracks`);
    } catch (error) {
      console.error('Failed to fetch Tabletop Audio tracks:', error);
      // Keep existing tracks if fetch fails
    }
  }

  /**
   * Ensure tracks are loaded (with caching)
   */
  private async ensureLoaded(): Promise<void> {
    if (this.tracks.length === 0 || Date.now() - this.lastFetch > this.fetchInterval) {
      await this.loadTracks();
    }
  }

  /**
   * Get all tracks in the catalog
   */
  async getAllTracks(): Promise<TabletopAudioTrack[]> {
    await this.ensureLoaded();
    return this.tracks;
  }

  /**
   * Get all tracks synchronously (uses cached data)
   */
  getAllTracksSync(): TabletopAudioTrack[] {
    return this.tracks;
  }

  /**
   * Search tracks by query
   */
  async search(query: string): Promise<TabletopAudioTrack[]> {
    await this.ensureLoaded();
    const lowerQuery = query.toLowerCase();
    return this.tracks.filter(track =>
      track.name.toLowerCase().includes(lowerQuery) ||
      track.description.toLowerCase().includes(lowerQuery) ||
      track.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
      track.genres.some(genre => genre.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Search tracks synchronously (uses cached data)
   */
  searchSync(query: string): TabletopAudioTrack[] {
    const lowerQuery = query.toLowerCase();
    return this.tracks.filter(track =>
      track.name.toLowerCase().includes(lowerQuery) ||
      track.description.toLowerCase().includes(lowerQuery) ||
      track.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
      track.genres.some(genre => genre.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Get tracks by category
   */
  async getByCategory(category: string): Promise<TabletopAudioTrack[]> {
    await this.ensureLoaded();
    return this.tracks.filter(track => track.category === category);
  }

  /**
   * Get tracks matching D&D scene types
   * Uses strict matching to avoid wrong categories (e.g., ghost ships for dungeon)
   */
  async getSceneTracks(scene: string): Promise<TabletopAudioTrack[]> {
    await this.ensureLoaded();
    
    // Map scene types to categories and search terms
    // Using more specific tags to avoid mismatches
    const sceneMapping: Record<string, { categories: string[]; tags: string[]; excludeTags: string[] }> = {
      combat: { categories: ['combat'], tags: ['battle', 'fight', 'war', 'action', 'siege'], excludeTags: [] },
      exploration: { categories: ['ambient', 'forest'], tags: ['adventure', 'journey', 'travel', 'road'], excludeTags: ['combat', 'battle'] },
      social: { categories: ['tavern', 'town'], tags: ['social', 'crowd', 'market', 'festival'], excludeTags: ['combat'] },
      tense: { categories: ['tense'], tags: ['suspense', 'creepy', 'haunted', 'dark'], excludeTags: ['ship', 'ocean', 'sea'] },
      dramatic: { categories: ['music'], tags: ['epic', 'dramatic', 'cinematic', 'orchestral'], excludeTags: [] },
      tavern: { categories: ['tavern'], tags: ['inn', 'pub', 'feast', 'drinking'], excludeTags: [] },
      forest: { categories: ['forest'], tags: ['woods', 'nature', 'wilderness', 'swamp', 'jungle'], excludeTags: ['town', 'city'] },
      dungeon: { categories: ['dungeon'], tags: ['cave', 'underground', 'crypt', 'tomb', 'catacomb', 'mine', 'sewer', 'barrow', 'lair', 'cavern'], excludeTags: ['ship', 'ocean', 'sea', 'tavern', 'town', 'forest'] },
      ambient: { categories: ['ambient'], tags: ['calm', 'peaceful', 'background'], excludeTags: ['combat', 'battle'] },
    };

    const mapping = sceneMapping[scene] || { categories: ['ambient'], tags: [scene], excludeTags: [] };
    
    return this.tracks.filter(track => {
      // Check if track matches any categories or tags
      const matchesCategory = mapping.categories.includes(track.category);
      const matchesTags = track.tags.some(tag => mapping.tags.some(mt => tag.toLowerCase().includes(mt)));
      const matchesName = mapping.tags.some(tag => track.name.toLowerCase().includes(tag));
      
      // Check if track should be excluded
      const isExcluded = mapping.excludeTags.length > 0 && (
        track.tags.some(tag => mapping.excludeTags.some(et => tag.toLowerCase().includes(et))) ||
        track.name.toLowerCase().split(' ').some(word => mapping.excludeTags.includes(word))
      );
      
      return (matchesCategory || matchesTags || matchesName) && !isExcluded;
    });
  }

  /**
   * Get scene tracks synchronously
   */
  getSceneTracksSync(scene: string): TabletopAudioTrack[] {
    const sceneMapping: Record<string, { categories: string[]; tags: string[]; excludeTags: string[] }> = {
      combat: { categories: ['combat'], tags: ['battle', 'fight', 'war', 'action', 'siege'], excludeTags: [] },
      exploration: { categories: ['ambient', 'forest'], tags: ['adventure', 'journey', 'travel', 'road'], excludeTags: ['combat', 'battle'] },
      social: { categories: ['tavern', 'town'], tags: ['social', 'crowd', 'market', 'festival'], excludeTags: ['combat'] },
      tense: { categories: ['tense'], tags: ['suspense', 'creepy', 'haunted', 'dark'], excludeTags: ['ship', 'ocean', 'sea'] },
      dramatic: { categories: ['music'], tags: ['epic', 'dramatic', 'cinematic', 'orchestral'], excludeTags: [] },
      tavern: { categories: ['tavern'], tags: ['inn', 'pub', 'feast', 'drinking'], excludeTags: [] },
      forest: { categories: ['forest'], tags: ['woods', 'nature', 'wilderness', 'swamp', 'jungle'], excludeTags: ['town', 'city'] },
      dungeon: { categories: ['dungeon'], tags: ['cave', 'underground', 'crypt', 'tomb', 'catacomb', 'mine', 'sewer', 'barrow', 'lair', 'cavern'], excludeTags: ['ship', 'ocean', 'sea', 'tavern', 'town', 'forest'] },
      ambient: { categories: ['ambient'], tags: ['calm', 'peaceful', 'background'], excludeTags: ['combat', 'battle'] },
    };

    const mapping = sceneMapping[scene] || { categories: ['ambient'], tags: [scene], excludeTags: [] };
    
    return this.tracks.filter(track => {
      const matchesCategory = mapping.categories.includes(track.category);
      const matchesTags = track.tags.some(tag => mapping.tags.some(mt => tag.toLowerCase().includes(mt)));
      const matchesName = mapping.tags.some(tag => track.name.toLowerCase().includes(tag));
      
      const isExcluded = mapping.excludeTags.length > 0 && (
        track.tags.some(tag => mapping.excludeTags.some(et => tag.toLowerCase().includes(et))) ||
        track.name.toLowerCase().split(' ').some(word => mapping.excludeTags.includes(word))
      );
      
      return (matchesCategory || matchesTags || matchesName) && !isExcluded;
    });
  }

  /**
   * Get a specific track by ID
   */
  async getTrack(id: string): Promise<TabletopAudioTrack | undefined> {
    await this.ensureLoaded();
    return this.tracks.find(track => track.id === id);
  }

  /**
   * Search tracks by a single tag (case-insensitive, partial match)
   */
  async searchByTag(tag: string): Promise<TabletopAudioTrack[]> {
    await this.ensureLoaded();
    const lowerTag = tag.toLowerCase();
    return this.tracks.filter(track =>
      track.tags.some(t => t.toLowerCase().includes(lowerTag)) ||
      track.genres.some(g => g.toLowerCase().includes(lowerTag)) ||
      track.category.toLowerCase().includes(lowerTag) ||
      track.name.toLowerCase().includes(lowerTag)
    );
  }

  /**
   * Get tracks by tags
   */
  async getByTags(tags: string[]): Promise<TabletopAudioTrack[]> {
    await this.ensureLoaded();
    const lowerTags = tags.map(t => t.toLowerCase());
    return this.tracks.filter(track =>
      track.tags.some(tag => lowerTags.includes(tag.toLowerCase()))
    );
  }

  /**
   * Get all available categories
   */
  async getCategories(): Promise<string[]> {
    await this.ensureLoaded();
    const categories = new Set(this.tracks.map(track => track.category));
    return Array.from(categories);
  }

  /**
   * Get the direct audio URL for a track
   */
  getAudioUrl(track: TabletopAudioTrack): string {
    return track.audioUrl;
  }

  /**
   * Build attribution string
   */
  buildAttribution(track: TabletopAudioTrack): string {
    return `"${track.name}" from Tabletop Audio (tabletopaudio.com)`;
  }

  /**
   * Check if the service has loaded tracks
   */
  isReady(): boolean {
    return this.tracks.length > 0;
  }

  /**
   * Get track count
   */
  getTrackCount(): number {
    return this.tracks.length;
  }
}

// Singleton instance
export const tabletopAudioService = new TabletopAudioService();
