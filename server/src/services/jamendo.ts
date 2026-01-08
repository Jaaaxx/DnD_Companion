import { config } from '../config.js';

/**
 * Jamendo Music API Service
 * 
 * Jamendo provides free music under Creative Commons licenses
 * API docs: https://developer.jamendo.com/v3.0
 * 
 * Get a free API key at: https://developer.jamendo.com/
 */

export interface JamendoTrack {
  id: string;
  name: string;
  duration: number;
  artist_name: string;
  album_name: string;
  audio: string; // Direct streaming URL (mp3)
  audiodownload: string; // Download URL
  image: string;
  shareurl: string;
}

export interface JamendoSearchResult {
  headers: {
    status: string;
    code: number;
    results_count: number;
  };
  results: JamendoTrack[];
}

export interface JamendoSearchParams {
  query?: string;
  tags?: string; // Genre/mood tags
  speed?: 'verylow' | 'low' | 'medium' | 'high' | 'veryhigh';
  limit?: number;
  offset?: number;
  order?: 'relevance' | 'buzzrate' | 'downloads_total' | 'listens_total';
  fuzzytags?: string; // Mood-based fuzzy tags
  acousticelectric?: 'acoustic' | 'electric';
  vocalinstrumental?: 'vocal' | 'instrumental';
}

const JAMENDO_API_BASE = 'https://api.jamendo.com/v3.0';

export class JamendoService {
  private clientId: string;

  constructor() {
    // Jamendo uses client_id instead of API key
    this.clientId = config.jamendoClientId || '';
    if (!this.clientId) {
      console.warn('Jamendo client ID not configured - Jamendo integration disabled');
    }
  }

  isConfigured(): boolean {
    return !!this.clientId;
  }

  /**
   * Search for music tracks on Jamendo
   */
  async search(params: JamendoSearchParams = {}): Promise<JamendoSearchResult> {
    if (!this.isConfigured()) {
      return { headers: { status: 'error', code: 0, results_count: 0 }, results: [] };
    }

    const searchParams = new URLSearchParams({
      client_id: this.clientId,
      format: 'json',
      limit: String(params.limit || 20),
      offset: String(params.offset || 0),
      include: 'musicinfo',
      audioformat: 'mp32', // MP3 VBR ~192kbps
    });

    if (params.query) {
      searchParams.append('search', params.query);
    }

    if (params.tags) {
      searchParams.append('tags', params.tags);
    }

    if (params.fuzzytags) {
      searchParams.append('fuzzytags', params.fuzzytags);
    }

    if (params.speed) {
      searchParams.append('speed', params.speed);
    }

    if (params.order) {
      searchParams.append('order', params.order);
    }

    if (params.vocalinstrumental) {
      searchParams.append('vocalinstrumental', params.vocalinstrumental);
    }

    try {
      const response = await fetch(
        `${JAMENDO_API_BASE}/tracks/?${searchParams.toString()}`
      );

      if (!response.ok) {
        throw new Error(`Jamendo API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.headers?.status === 'error') {
        throw new Error(`Jamendo API error: ${data.headers.error_message || 'Unknown error'}`);
      }

      return data;
    } catch (error) {
      console.error('Jamendo search error:', error);
      throw error;
    }
  }

  /**
   * Get music suitable for specific D&D scenes
   */
  async getSceneMusic(scene: string, limit = 10): Promise<JamendoTrack[]> {
    // Map D&D scenes to Jamendo fuzzy tags and parameters
    const sceneConfig: Record<string, JamendoSearchParams> = {
      combat: { 
        fuzzytags: 'epic+energetic+dark',
        speed: 'high',
        vocalinstrumental: 'instrumental',
      },
      exploration: { 
        fuzzytags: 'adventure+inspiring+hopeful',
        vocalinstrumental: 'instrumental',
      },
      social: { 
        fuzzytags: 'happy+acoustic+folk',
        speed: 'medium',
      },
      tense: { 
        fuzzytags: 'dark+suspense+atmospheric',
        speed: 'low',
        vocalinstrumental: 'instrumental',
      },
      dramatic: { 
        fuzzytags: 'epic+cinematic+orchestral',
        vocalinstrumental: 'instrumental',
      },
      tavern: { 
        tags: 'folk',
        fuzzytags: 'happy+acoustic',
        speed: 'medium',
      },
      forest: { 
        fuzzytags: 'nature+peaceful+ambient',
        speed: 'low',
        vocalinstrumental: 'instrumental',
      },
      dungeon: { 
        fuzzytags: 'dark+ambient+atmospheric',
        speed: 'verylow',
        vocalinstrumental: 'instrumental',
      },
      ambient: { 
        fuzzytags: 'ambient+calm+relaxing',
        speed: 'verylow',
        vocalinstrumental: 'instrumental',
      },
    };

    const config = sceneConfig[scene] || { fuzzytags: scene };
    const result = await this.search({
      ...config,
      limit,
      order: 'relevance',
    });

    return result.results;
  }

  /**
   * Search for instrumental background music
   */
  async searchBackgroundMusic(query: string, limit = 20): Promise<JamendoTrack[]> {
    const result = await this.search({
      query,
      vocalinstrumental: 'instrumental',
      limit,
      order: 'relevance',
    });
    return result.results;
  }

  /**
   * Get popular/featured tracks
   */
  async getPopularTracks(limit = 20): Promise<JamendoTrack[]> {
    const result = await this.search({
      limit,
      order: 'listens_total',
      vocalinstrumental: 'instrumental',
    });
    return result.results;
  }

  /**
   * Get the streaming audio URL for a track
   */
  getAudioUrl(track: JamendoTrack): string {
    return track.audio;
  }

  /**
   * Build attribution string (required by Jamendo license)
   */
  buildAttribution(track: JamendoTrack): string {
    return `"${track.name}" by ${track.artist_name} on Jamendo (CC)`;
  }
}

// Singleton instance
export const jamendoService = new JamendoService();

