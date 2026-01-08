import { Router } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { freesoundService, FreesoundTrack } from '../services/freesound.js';
import { jamendoService, JamendoTrack } from '../services/jamendo.js';
import { tabletopAudioService, TabletopAudioTrack } from '../services/tabletopAudio.js';

export const audioLibraryRouter = Router();

// Unified track format for the frontend
interface UnifiedTrack {
  id: string;
  name: string;
  description: string;
  duration: number;
  source: 'freesound' | 'jamendo' | 'tabletop';
  category: string;
  previewUrl: string;
  imageUrl?: string;
  attribution?: string;
  tags: string[];
  externalId?: string;
  isExternalOnly?: boolean; // If true, opens in new tab instead of playing in-app
}

// Convert Freesound track to unified format
function freesoundToUnified(track: FreesoundTrack): UnifiedTrack {
  return {
    id: `freesound-${track.id}`,
    name: track.name,
    description: track.description || '',
    duration: Math.round(track.duration),
    source: 'freesound',
    category: track.tags[0] || 'effects',
    previewUrl: freesoundService.getPreviewUrl(track),
    attribution: freesoundService.buildAttribution(track),
    tags: track.tags,
    externalId: String(track.id),
  };
}

// Convert Jamendo track to unified format
function jamendoToUnified(track: JamendoTrack): UnifiedTrack {
  return {
    id: `jamendo-${track.id}`,
    name: track.name,
    description: `${track.album_name} by ${track.artist_name}`,
    duration: track.duration,
    source: 'jamendo',
    category: 'music',
    previewUrl: track.audio, // Direct MP3 streaming URL
    attribution: jamendoService.buildAttribution(track),
    tags: ['music', 'jamendo'],
    externalId: String(track.id),
  };
}

// Convert Tabletop Audio track to unified format
function tabletopToUnified(track: TabletopAudioTrack): UnifiedTrack {
  return {
    id: track.id,
    name: track.name,
    description: track.description,
    duration: track.duration,
    source: 'tabletop',
    category: track.category,
    previewUrl: track.audioUrl, // Direct MP3 URL from Tabletop Audio!
    imageUrl: track.imageUrl,
    attribution: tabletopAudioService.buildAttribution(track),
    tags: track.tags,
    externalId: track.id,
    isExternalOnly: false, // Now plays directly in-app!
  };
}

// GET /api/audio-library/search - Unified search across all sources
audioLibraryRouter.get('/search', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { q, source, limit = '20' } = req.query;
    const query = String(q || '');
    const limitNum = Math.min(parseInt(String(limit), 10), 50);

    const results: UnifiedTrack[] = [];

    // Search Freesound (sound effects)
    if ((!source || source === 'freesound') && freesoundService.isConfigured() && query) {
      try {
        const freesoundResults = await freesoundService.search({
          query,
          pageSize: limitNum,
        });
        results.push(...freesoundResults.results.map(freesoundToUnified));
      } catch (error) {
        console.error('Freesound search error:', error);
      }
    }

    // Search Jamendo (music)
    if ((!source || source === 'jamendo') && jamendoService.isConfigured() && query) {
      try {
        const jamendoResults = await jamendoService.search({
          query,
          limit: limitNum,
        });
        results.push(...jamendoResults.results.map(jamendoToUnified));
      } catch (error) {
        console.error('Jamendo search error:', error);
      }
    }

    // Search Tabletop Audio (ambient soundscapes - now with direct streaming!)
    if (!source || source === 'tabletop') {
      try {
        const tabletopResults = query 
          ? await tabletopAudioService.search(query)
          : await tabletopAudioService.getAllTracks();
        results.push(...tabletopResults.slice(0, limitNum).map(tabletopToUnified));
      } catch (error) {
        console.error('Tabletop Audio search error:', error);
      }
    }

    res.json({
      success: true,
      data: {
        tracks: results.slice(0, limitNum),
        total: results.length,
        sources: {
          freesound: freesoundService.isConfigured(),
          jamendo: jamendoService.isConfigured(),
          tabletop: tabletopAudioService.isReady(),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/audio-library/freesound/search - Search Freesound specifically
audioLibraryRouter.get('/freesound/search', async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!freesoundService.isConfigured()) {
      return res.json({
        success: true,
        data: { tracks: [], total: 0, configured: false },
      });
    }

    const { q, tags, page = '1', limit = '15' } = req.query;
    const query = String(q || '');
    const tagsArray = tags ? String(tags).split(',') : undefined;

    let results;
    if (tagsArray && tagsArray.length > 0) {
      results = await freesoundService.searchByTags(tagsArray, {
        query: query || undefined,
        page: parseInt(String(page), 10),
        pageSize: parseInt(String(limit), 10),
      });
    } else {
      results = await freesoundService.search({
        query: query || '*',
        page: parseInt(String(page), 10),
        pageSize: parseInt(String(limit), 10),
      });
    }

    res.json({
      success: true,
      data: {
        tracks: results.results.map(freesoundToUnified),
        total: results.count,
        hasMore: !!results.next,
        configured: true,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/audio-library/freesound/scene/:scene - Get Freesound tracks for a scene
audioLibraryRouter.get('/freesound/scene/:scene', async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!freesoundService.isConfigured()) {
      return res.json({ success: true, data: [] });
    }

    const { scene } = req.params;
    const { limit = '10' } = req.query;
    
    const tracks = await freesoundService.getSceneSounds(scene, parseInt(String(limit), 10));

    res.json({
      success: true,
      data: tracks.map(freesoundToUnified),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/audio-library/freesound/ambient/:scene - Get ambient soundscapes (longer duration)
audioLibraryRouter.get('/freesound/ambient/:scene', async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!freesoundService.isConfigured()) {
      return res.json({ success: true, data: [] });
    }

    const { scene } = req.params;
    const { limit = '10' } = req.query;
    
    const tracks = await freesoundService.getAmbientSoundscapes(scene, parseInt(String(limit), 10));

    res.json({
      success: true,
      data: tracks.map(freesoundToUnified),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/audio-library/jamendo/search - Search Jamendo specifically
audioLibraryRouter.get('/jamendo/search', async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!jamendoService.isConfigured()) {
      return res.json({
        success: true,
        data: { tracks: [], total: 0, configured: false },
      });
    }

    const { q, page = '1', limit = '20' } = req.query;

    const results = await jamendoService.search({
      query: q ? String(q) : undefined,
      offset: (parseInt(String(page), 10) - 1) * parseInt(String(limit), 10),
      limit: parseInt(String(limit), 10),
    });

    res.json({
      success: true,
      data: {
        tracks: results.results.map(jamendoToUnified),
        total: results.headers.results_count,
        configured: true,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/audio-library/jamendo/scene/:scene - Get Jamendo music for a scene
audioLibraryRouter.get('/jamendo/scene/:scene', async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!jamendoService.isConfigured()) {
      return res.json({ success: true, data: [] });
    }

    const { scene } = req.params;
    const { limit = '10' } = req.query;
    
    const tracks = await jamendoService.getSceneMusic(scene, parseInt(String(limit), 10));

    res.json({
      success: true,
      data: tracks.map(jamendoToUnified),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/audio-library/tabletop - Get all Tabletop Audio tracks
audioLibraryRouter.get('/tabletop', async (_req: AuthenticatedRequest, res, next) => {
  try {
    const tracks = await tabletopAudioService.getAllTracks();
    const categories = await tabletopAudioService.getCategories();

    res.json({
      success: true,
      data: {
        tracks: tracks.map(tabletopToUnified),
        categories,
        trackCount: tabletopAudioService.getTrackCount(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/audio-library/tabletop/category/:category - Get Tabletop Audio by category
audioLibraryRouter.get('/tabletop/category/:category', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { category } = req.params;
    const tracks = await tabletopAudioService.getByCategory(category);

    res.json({
      success: true,
      data: tracks.map(tabletopToUnified),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/audio-library/tabletop/scene/:scene - Get Tabletop Audio for a scene
audioLibraryRouter.get('/tabletop/scene/:scene', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { scene } = req.params;
    const tracks = await tabletopAudioService.getSceneTracks(scene);

    res.json({
      success: true,
      data: tracks.map(tabletopToUnified),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/audio-library/scene/:scene - Get tracks from all sources for a scene
audioLibraryRouter.get('/scene/:scene', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { scene } = req.params;
    const { limit = '10' } = req.query;
    const limitNum = parseInt(String(limit), 10);

    const results: UnifiedTrack[] = [];

    // Priority 1: Tabletop Audio (high-quality 10-minute soundscapes, perfect for D&D)
    try {
      const tabletopTracks = await tabletopAudioService.getSceneTracks(scene);
      results.push(...tabletopTracks.slice(0, 5).map(tabletopToUnified));
    } catch (error) {
      console.error('Tabletop Audio scene fetch error:', error);
    }

    // Priority 2: Freesound ambient soundscapes (longer duration, good for backgrounds)
    if (freesoundService.isConfigured() && results.length < limitNum) {
      try {
        const ambientTracks = await freesoundService.getAmbientSoundscapes(scene, limitNum - results.length);
        results.push(...ambientTracks.map(freesoundToUnified));
      } catch (error) {
        console.error('Freesound ambient fetch error:', error);
      }
    }

    // Priority 3: Jamendo music (background music)
    if (jamendoService.isConfigured() && results.length < limitNum) {
      try {
        const jamendoTracks = await jamendoService.getSceneMusic(scene, Math.ceil(limitNum / 2));
        results.push(...jamendoTracks.map(jamendoToUnified));
      } catch (error) {
        console.error('Jamendo scene fetch error:', error);
      }
    }

    res.json({
      success: true,
      data: results.slice(0, limitNum),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/audio-library/sources - Get status of all audio sources
audioLibraryRouter.get('/sources', async (_req: AuthenticatedRequest, res) => {
  res.json({
    success: true,
    data: {
      freesound: {
        configured: freesoundService.isConfigured(),
        name: 'Freesound',
        description: 'Sound effects (attribution required)',
      },
      jamendo: {
        configured: jamendoService.isConfigured(),
        name: 'Jamendo',
        description: 'Music tracks (Creative Commons)',
      },
      tabletop: {
        configured: tabletopAudioService.isReady(),
        name: 'Tabletop Audio',
        description: `TTRPG soundscapes (${tabletopAudioService.getTrackCount()} tracks)`,
      },
    },
  });
});
