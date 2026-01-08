import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search,
  Play,
  Square,
  Plus,
  Loader2,
  ExternalLink,
  Music,
  Waves,
  TreePine,
  Swords,
  X,
} from 'lucide-react';
import { api } from '@/services/api';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';

// Types
interface UnifiedTrack {
  id: string;
  name: string;
  description: string;
  duration: number;
  source: 'freesound' | 'jamendo' | 'tabletop';
  category: string;
  previewUrl: string;
  attribution?: string;
  tags: string[];
  externalId?: string;
  isExternalOnly?: boolean; // If true, opens in new tab instead of playing in-app
}

interface AudioSources {
  freesound: { configured: boolean; name: string; description: string };
  jamendo: { configured: boolean; name: string; description: string };
  tabletop: { configured: boolean; name: string; description: string };
}

interface SoundLibraryBrowserProps {
  campaignId: string;
  onAddToSoundboard?: (track: UnifiedTrack, triggerType: 'manual' | 'scene' | 'keyword', triggerValue: string) => void;
  onClose?: () => void;
}

type TabType = 'all' | 'freesound' | 'jamendo' | 'tabletop';

const SCENE_CATEGORIES = [
  { id: 'combat', name: 'Combat', icon: Swords },
  { id: 'tavern', name: 'Tavern', icon: Music },
  { id: 'dungeon', name: 'Dungeon', icon: Waves },
  { id: 'forest', name: 'Forest', icon: TreePine },
  { id: 'tense', name: 'Tense', icon: Waves },
  { id: 'rain', name: 'Rain', icon: Waves },
  { id: 'fire', name: 'Fire', icon: Waves },
  { id: 'ocean', name: 'Ocean', icon: Waves },
  { id: 'night', name: 'Night', icon: Waves },
  { id: 'city', name: 'City', icon: Music },
];

export function SoundLibraryBrowser({ campaignId, onAddToSoundboard, onClose }: SoundLibraryBrowserProps) {
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [tracks, setTracks] = useState<UnifiedTrack[]>([]);
  const [sources, setSources] = useState<AudioSources | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [previewingTrack, setPreviewingTrack] = useState<string | null>(null);
  const [addingTrack, setAddingTrack] = useState<UnifiedTrack | null>(null);
  const [triggerType, setTriggerType] = useState<'manual' | 'scene' | 'keyword'>('manual');
  const [triggerValue, setTriggerValue] = useState('');
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const { playTrack, stopTrack } = useAudioPlayer();

  // Load audio sources on mount
  useEffect(() => {
    loadSources();
  }, []);

  // Search when query or tab changes (debounced)
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      performSearch();
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, activeTab, selectedCategory]);

  const loadSources = async () => {
    try {
      const response = await api.get<AudioSources>('/audio-library/sources');
      if (response.data) {
        setSources(response.data);
      }
    } catch (error) {
      console.error('Failed to load audio sources:', error);
    }
  };

  const performSearch = async () => {
    setIsLoading(true);
    try {
      let endpoint = '/audio-library/search?';
      const params = new URLSearchParams();
      
      if (searchQuery) {
        params.append('q', searchQuery);
      }
      
      if (activeTab !== 'all') {
        params.append('source', activeTab);
      }
      
      if (selectedCategory) {
        params.append('category', selectedCategory);
      }
      
      params.append('limit', '30');

      const response = await api.get<{ tracks: UnifiedTrack[] }>(endpoint + params.toString());
      if (response.data?.tracks) {
        setTracks(response.data.tracks);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSceneTracks = async (scene: string) => {
    setIsLoading(true);
    setSelectedCategory(scene);
    try {
      // Fetch from both scene and ambient endpoints for better variety
      const [sceneResponse, ambientResponse] = await Promise.all([
        api.get<UnifiedTrack[]>(`/audio-library/scene/${scene}?limit=10`),
        api.get<UnifiedTrack[]>(`/audio-library/freesound/ambient/${scene}?limit=10`),
      ]);
      
      const allTracks: UnifiedTrack[] = [];
      if (sceneResponse.data) {
        allTracks.push(...sceneResponse.data);
      }
      if (ambientResponse.data) {
        allTracks.push(...ambientResponse.data);
      }
      
      // Remove duplicates by ID
      const uniqueTracks = allTracks.filter((track, index, self) => 
        index === self.findIndex(t => t.id === track.id)
      );
      
      setTracks(uniqueTracks);
    } catch (error) {
      console.error('Failed to load scene tracks:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreview = useCallback((track: UnifiedTrack) => {
    // For external-only tracks, open in new tab
    if (track.isExternalOnly) {
      window.open(track.previewUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    setPlaybackError(null);
    
    if (previewingTrack === track.id) {
      stopTrack(track.id);
      setPreviewingTrack(null);
    } else {
      if (previewingTrack) {
        stopTrack(previewingTrack);
      }
      try {
        playTrack({
          id: track.id,
          name: track.name,
          src: track.previewUrl,
          loop: false,
          volume: 0.7,
        }, false);
        setPreviewingTrack(track.id);
      } catch (error) {
        console.error('Failed to play track:', error);
        setPlaybackError(`Failed to play "${track.name}"`);
      }
    }
  }, [previewingTrack, playTrack, stopTrack]);

  const handleAddToSoundboard = async () => {
    if (!addingTrack || !triggerValue) return;

    try {
      await api.post('/sound-mappings', {
        campaignId,
        name: addingTrack.name,
        triggerType,
        triggerValue,
        audioFile: addingTrack.previewUrl,
        audioSource: addingTrack.source,
        externalId: addingTrack.externalId,
        previewUrl: addingTrack.previewUrl,
        attribution: addingTrack.attribution,
        volume: 80,
        loop: addingTrack.source === 'tabletop' || addingTrack.category === 'ambient',
      });

      if (onAddToSoundboard) {
        onAddToSoundboard(addingTrack, triggerType, triggerValue);
      }

      setAddingTrack(null);
      setTriggerValue('');
    } catch (error) {
      console.error('Failed to add to soundboard:', error);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'freesound': return 'text-orange-400';
      case 'jamendo': return 'text-green-400';
      case 'tabletop': return 'text-purple-400';
      default: return 'text-dungeon-400';
    }
  };

  const getSourceBadge = (source: string) => {
    switch (source) {
      case 'freesound': return 'Freesound';
      case 'jamendo': return 'Jamendo';
      case 'tabletop': return 'Tabletop Audio';
      default: return source;
    }
  };

  return (
    <div className="flex flex-col h-full bg-dungeon-900 rounded-lg border border-dungeon-700">
      {/* Header */}
      <div className="p-4 border-b border-dungeon-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-semibold flex items-center gap-2">
            <Music className="w-5 h-5 text-mystic-400" />
            Sound Library
          </h2>
          {onClose && (
            <button onClick={onClose} className="text-dungeon-400 hover:text-parchment-200">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Search Bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dungeon-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search sounds and music..."
            className="w-full pl-10 pr-4 py-2 bg-dungeon-800 border border-dungeon-700 rounded-lg text-parchment-200 placeholder-dungeon-500 focus:outline-none focus:border-mystic-500"
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[
            { id: 'all', label: 'All Sources' },
            { id: 'freesound', label: 'Freesound', disabled: !sources?.freesound?.configured },
            { id: 'jamendo', label: 'Jamendo', disabled: !sources?.jamendo?.configured },
            { id: 'tabletop', label: 'Tabletop Audio' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as TabType);
                setSelectedCategory(null);
              }}
              disabled={tab.disabled}
              className={`px-3 py-1.5 text-sm rounded-lg whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-mystic-600 text-white'
                  : tab.disabled
                  ? 'bg-dungeon-800 text-dungeon-600 cursor-not-allowed'
                  : 'bg-dungeon-800 text-dungeon-300 hover:bg-dungeon-700'
              }`}
            >
              {tab.label}
              {tab.disabled && <span className="ml-1 text-xs">(No API key)</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Scene Quick Filters */}
      <div className="p-3 border-b border-dungeon-700 bg-dungeon-850">
        <div className="flex gap-2 overflow-x-auto">
          {SCENE_CATEGORIES.map((scene) => {
            const Icon = scene.icon;
            return (
              <button
                key={scene.id}
                onClick={() => loadSceneTracks(scene.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg whitespace-nowrap transition-colors ${
                  selectedCategory === scene.id
                    ? 'bg-mystic-700 text-white'
                    : 'bg-dungeon-800 text-dungeon-300 hover:bg-dungeon-700'
                }`}
              >
                <Icon className="w-3 h-3" />
                {scene.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Playback Error */}
      {playbackError && (
        <div className="mx-4 mt-2 p-2 bg-dragon-900/50 border border-dragon-700 rounded-lg text-sm text-dragon-300">
          {playbackError}
          <button 
            onClick={() => setPlaybackError(null)}
            className="ml-2 text-dragon-400 hover:text-dragon-300"
          >
            ×
          </button>
        </div>
      )}

      {/* Track List */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-mystic-400" />
          </div>
        ) : tracks.length === 0 ? (
          <div className="text-center py-12 text-dungeon-400">
            {searchQuery ? 'No sounds found. Try a different search.' : 'Search for sounds or select a category above.'}
          </div>
        ) : (
          <div className="space-y-2">
            {tracks.map((track) => (
              <div
                key={track.id}
                className={`p-3 rounded-lg border transition-colors ${
                  previewingTrack === track.id
                    ? 'bg-mystic-900/30 border-mystic-600'
                    : 'bg-dungeon-800/50 border-dungeon-700 hover:border-dungeon-600'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Preview Button */}
                  <button
                    onClick={() => handlePreview(track)}
                    className={`p-2 rounded-lg transition-colors ${
                      previewingTrack === track.id
                        ? 'bg-mystic-600 text-white'
                        : track.isExternalOnly
                        ? 'bg-purple-700 text-purple-200 hover:bg-purple-600'
                        : 'bg-dungeon-700 text-dungeon-300 hover:bg-dungeon-600'
                    }`}
                    title={track.isExternalOnly ? 'Opens in new tab' : 'Preview'}
                  >
                    {track.isExternalOnly ? (
                      <ExternalLink className="w-4 h-4" />
                    ) : previewingTrack === track.id ? (
                      <Square className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </button>

                  {/* Track Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-medium text-parchment-200 truncate">{track.name}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs ${getSourceColor(track.source)}`}>
                            {getSourceBadge(track.source)}
                            {track.isExternalOnly && (
                              <span className="ml-1 text-dungeon-500">(external)</span>
                            )}
                          </span>
                          <span className="text-xs text-dungeon-500">
                            {formatDuration(track.duration)}
                          </span>
                          {track.category && (
                            <span className="text-xs text-dungeon-500 capitalize">
                              {track.category}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setAddingTrack(track);
                            setTriggerType('manual');
                            setTriggerValue(track.name);
                          }}
                          className="p-1.5 text-dungeon-400 hover:text-mystic-400 hover:bg-dungeon-700 rounded transition-colors"
                          title="Add to Sound Board"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        {track.source === 'tabletop' && (
                          <a
                            href={track.previewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-dungeon-400 hover:text-mystic-400 hover:bg-dungeon-700 rounded transition-colors"
                            title="Open in Tabletop Audio"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Tags */}
                    {track.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {track.tags.slice(0, 5).map((tag, i) => (
                          <span
                            key={i}
                            className="px-1.5 py-0.5 text-xs bg-dungeon-700 text-dungeon-300 rounded"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Attribution */}
                    {track.attribution && (
                      <p className="text-xs text-dungeon-500 mt-1 truncate">
                        {track.attribution}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add to Soundboard Modal */}
      {addingTrack && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-dungeon-900 rounded-lg border border-dungeon-700 p-6 max-w-md w-full">
            <h3 className="font-display text-lg font-semibold mb-4">Add to Sound Board</h3>
            
            <div className="space-y-4">
              <div>
                <p className="text-sm text-dungeon-300 mb-1">Sound:</p>
                <p className="font-medium text-parchment-200">{addingTrack.name}</p>
                {addingTrack.attribution && (
                  <p className="text-xs text-dungeon-500 mt-1">{addingTrack.attribution}</p>
                )}
              </div>

              <div>
                <label className="block text-sm text-dungeon-300 mb-2">Trigger Type</label>
                <div className="flex gap-2">
                  {(['manual', 'scene', 'keyword'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => {
                        setTriggerType(type);
                        if (type === 'scene') {
                          setTriggerValue(addingTrack.category || '');
                        } else if (type === 'keyword') {
                          setTriggerValue('');
                        } else {
                          setTriggerValue(addingTrack.name);
                        }
                      }}
                      className={`px-3 py-1.5 text-sm rounded-lg capitalize transition-colors ${
                        triggerType === type
                          ? 'bg-mystic-600 text-white'
                          : 'bg-dungeon-800 text-dungeon-300 hover:bg-dungeon-700'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-dungeon-300 mb-2">
                  {triggerType === 'manual' ? 'Button Name' :
                   triggerType === 'scene' ? 'Scene Type' :
                   'Keyword Pattern'}
                </label>
                {triggerType === 'scene' ? (
                  <select
                    value={triggerValue}
                    onChange={(e) => setTriggerValue(e.target.value)}
                    className="w-full px-3 py-2 bg-dungeon-800 border border-dungeon-700 rounded-lg text-parchment-200 focus:outline-none focus:border-mystic-500"
                  >
                    <option value="">Select a scene...</option>
                    {SCENE_CATEGORIES.map((scene) => (
                      <option key={scene.id} value={scene.id}>{scene.name}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={triggerValue}
                    onChange={(e) => setTriggerValue(e.target.value)}
                    placeholder={triggerType === 'keyword' ? 'e.g., roll for initiative' : 'Sound name'}
                    className="w-full px-3 py-2 bg-dungeon-800 border border-dungeon-700 rounded-lg text-parchment-200 placeholder-dungeon-500 focus:outline-none focus:border-mystic-500"
                  />
                )}
                {triggerType === 'keyword' && (
                  <p className="text-xs text-dungeon-500 mt-1">
                    This sound will play when these words are detected in the transcript.
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setAddingTrack(null)}
                className="px-4 py-2 text-sm bg-dungeon-800 text-dungeon-300 hover:bg-dungeon-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddToSoundboard}
                disabled={!triggerValue}
                className="px-4 py-2 text-sm bg-mystic-600 text-white hover:bg-mystic-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add to Sound Board
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Source Info Footer */}
      {sources && (
        <div className="p-3 border-t border-dungeon-700 bg-dungeon-850">
          <div className="flex items-center gap-4 text-xs text-dungeon-500">
            <span>Sources:</span>
            {Object.entries(sources).map(([key, source]) => (
              <span key={key} className={source.configured ? 'text-emerald-400' : 'text-dungeon-600'}>
                {source.name}: {source.configured ? '✓' : '✗'}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

