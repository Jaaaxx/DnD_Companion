import { config } from '../config.js';

export interface FreesoundTrack {
  id: number;
  name: string;
  description: string;
  duration: number;
  username: string;
  license: string;
  tags: string[];
  previews: {
    'preview-hq-mp3': string;
    'preview-lq-mp3': string;
    'preview-hq-ogg': string;
    'preview-lq-ogg': string;
  };
  images: {
    waveform_m: string;
    waveform_l: string;
    spectral_m: string;
  };
}

export interface FreesoundSearchResult {
  count: number;
  next: string | null;
  previous: string | null;
  results: FreesoundTrack[];
}

export interface FreesoundSearchParams {
  query: string;
  filter?: string;
  sort?: 'score' | 'duration_desc' | 'duration_asc' | 'created_desc' | 'created_asc' | 'downloads_desc' | 'rating_desc';
  page?: number;
  pageSize?: number;
}

const FREESOUND_API_BASE = 'https://freesound.org/apiv2';

export class FreesoundService {
  private apiKey: string;

  constructor() {
    this.apiKey = config.freesoundApiKey;
    if (!this.apiKey) {
      console.warn('Freesound API key not configured - Freesound integration disabled');
    }
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Search for sounds on Freesound
   */
  async search(params: FreesoundSearchParams): Promise<FreesoundSearchResult> {
    if (!this.isConfigured()) {
      return { count: 0, next: null, previous: null, results: [] };
    }

    const searchParams = new URLSearchParams({
      token: this.apiKey,
      query: params.query,
      fields: 'id,name,description,duration,username,license,tags,previews,images',
      page_size: String(params.pageSize || 15),
      page: String(params.page || 1),
    });

    if (params.filter) {
      searchParams.append('filter', params.filter);
    }

    if (params.sort) {
      searchParams.append('sort', params.sort);
    }

    try {
      const response = await fetch(
        `${FREESOUND_API_BASE}/search/text/?${searchParams.toString()}`
      );

      if (!response.ok) {
        throw new Error(`Freesound API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Freesound search error:', error);
      throw error;
    }
  }

  /**
   * Get a specific sound by ID
   */
  async getSound(id: number): Promise<FreesoundTrack | null> {
    if (!this.isConfigured()) {
      return null;
    }

    try {
      const response = await fetch(
        `${FREESOUND_API_BASE}/sounds/${id}/?token=${this.apiKey}&fields=id,name,description,duration,username,license,tags,previews,images`
      );

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Freesound API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Freesound getSound error:', error);
      throw error;
    }
  }

  /**
   * Search for sounds by tags (useful for D&D categories)
   */
  async searchByTags(tags: string[], params?: Partial<FreesoundSearchParams>): Promise<FreesoundSearchResult> {
    const tagFilter = tags.map(t => `tag:${t}`).join(' ');
    return this.search({
      query: params?.query || '*',
      filter: tagFilter,
      ...params,
    });
  }

  /**
   * Get sounds suitable for specific D&D scenes
   */
  async getSceneSounds(scene: string, limit = 10): Promise<FreesoundTrack[]> {
    const sceneTagMap: Record<string, string[]> = {
      combat: ['battle', 'combat', 'sword', 'fight', 'weapon'],
      exploration: ['adventure', 'exploration', 'walking', 'footsteps', 'travel'],
      social: ['crowd', 'tavern', 'people', 'talking', 'chatter'],
      tense: ['suspense', 'tension', 'horror', 'scary', 'creepy'],
      dramatic: ['dramatic', 'epic', 'cinematic', 'orchestra'],
      tavern: ['tavern', 'inn', 'bar', 'medieval', 'pub'],
      forest: ['forest', 'nature', 'birds', 'wind', 'leaves'],
      dungeon: ['dungeon', 'cave', 'dripping', 'underground', 'echo'],
      ambient: ['ambient', 'background', 'atmosphere', 'loop'],
    };

    const tags = sceneTagMap[scene] || [scene];
    const result = await this.searchByTags(tags, { pageSize: limit });
    return result.results;
  }

  /**
   * Get ambient soundscapes (longer duration atmospheric sounds)
   */
  async getAmbientSoundscapes(scene: string, limit = 10): Promise<FreesoundTrack[]> {
    const sceneQueryMap: Record<string, string> = {
      combat: 'battle ambience war background',
      exploration: 'nature outdoor ambient walking',
      social: 'crowd murmur tavern people ambient',
      tense: 'horror suspense dark ambient atmosphere',
      dramatic: 'cinematic epic orchestral ambient',
      tavern: 'tavern inn medieval ambient crowd',
      forest: 'forest nature birds ambient loop',
      dungeon: 'dungeon cave underground dripping ambient',
      ambient: 'ambient atmosphere background loop',
      rain: 'rain ambient loop weather',
      thunder: 'thunderstorm storm rain ambient',
      wind: 'wind ambient outdoor atmosphere',
      fire: 'fire crackling fireplace ambient',
      ocean: 'ocean waves sea ambient loop',
      night: 'night crickets ambient outdoor',
      city: 'city urban ambient traffic',
      market: 'market crowd medieval busy',
    };

    const query = sceneQueryMap[scene] || `${scene} ambient atmosphere`;
    
    // Filter for longer sounds (30+ seconds) for better ambience
    const result = await this.search({
      query,
      filter: 'duration:[30 TO *]', // At least 30 seconds
      sort: 'duration_desc', // Prefer longer sounds
      pageSize: limit,
    });
    
    return result.results;
  }

  /**
   * Build attribution string for a Freesound track
   */
  buildAttribution(track: FreesoundTrack): string {
    return `"${track.name}" by ${track.username} on Freesound.org (${track.license})`;
  }

  /**
   * Get the best quality preview URL
   */
  getPreviewUrl(track: FreesoundTrack): string {
    return track.previews['preview-hq-mp3'] || track.previews['preview-lq-mp3'];
  }
}

// Singleton instance
export const freesoundService = new FreesoundService();

