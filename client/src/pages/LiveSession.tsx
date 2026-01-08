import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Mic,
  Square,
  Pause,
  Play,
  Volume2,
  VolumeX,
  Users,
  Heart,
  MessageSquare,
  Music,
  Check,
  X,
  AlertCircle,
  Wand2,
  Settings2,
  Sparkles,
  SkipForward,
  History,
  Disc3,
  Zap,
} from 'lucide-react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useAudioCapture } from '@/hooks/useAudioCapture';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import { api } from '@/services/api';
import { SoundLibraryBrowser } from '@/components/SoundLibraryBrowser';

interface TranscriptSegment {
  id: string;
  timestamp: number;
  speakerLabel: string;
  speakerName: string | null;
  text: string;
  confidence: number;
  isEdited: boolean;
}

interface Player {
  id: string;
  playerName: string;
  characterName: string;
  currentHp: number;
  maxHp: number;
}

interface HealthEvent {
  id: string;
  playerId: string;
  type: 'damage' | 'healing' | 'status';
  value: number | null;
  description: string;
  confirmed: boolean;
}

interface SoundMapping {
  id: string;
  name: string;
  triggerType: 'keyword' | 'scene' | 'manual';
  audioFile: string;
  audioSource: 'local' | 'freesound' | 'jamendo' | 'tabletop';
  previewUrl?: string;
  attribution?: string;
  volume: number;
  loop: boolean;
}

interface Session {
  id: string;
  sessionNumber: number;
  title: string | null;
}

interface AutoAudioSettings {
  enabled: boolean;
  effectFrequency: number;
  musicEnabled: boolean;
  effectsEnabled: boolean;
  apiStatus?: {
    freesound: boolean;
    jamendo: boolean;
    tabletop: boolean;
  };
}

interface AutoAudioTrack {
  id: string;
  name: string;
  src: string;
  type: 'music' | 'effect';
  source: string;
  duration: number;
  attribution?: string;
  loop: boolean;
  volume: number;
}

export function LiveSession() {
  const { campaignId, sessionId: urlSessionId } = useParams<{ campaignId: string; sessionId?: string }>();
  const navigate = useNavigate();
  
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(urlSessionId || null);
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [pendingHealthEvents, setPendingHealthEvents] = useState<HealthEvent[]>([]);
  const [manualTriggers, setManualTriggers] = useState<SoundMapping[]>([]);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [currentScene, setCurrentScene] = useState<{ scene: string; confidence: number } | null>(null);
  const [showSoundLibrary, setShowSoundLibrary] = useState(false);
  const [showAutoAudioSettings, setShowAutoAudioSettings] = useState(false);
  const [autoAudioSettings, setAutoAudioSettings] = useState<AutoAudioSettings>({
    enabled: true,
    effectFrequency: 50,
    musicEnabled: true,
    effectsEnabled: true,
  });
  const [autoPlayingTrack, setAutoPlayingTrack] = useState<{ name: string; type: string } | null>(null);
  
  // Now Playing state
  const [nowPlayingMusic, setNowPlayingMusic] = useState<AutoAudioTrack | null>(null);
  const [activeEffects, setActiveEffects] = useState<AutoAudioTrack[]>([]);
  const [audioHistory, setAudioHistory] = useState<AutoAudioTrack[]>([]);
  const [isMusicPaused, setIsMusicPaused] = useState(false);
  const MAX_HISTORY_SIZE = 20;
  
  const transcriptRef = useRef<HTMLDivElement>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval>>();
  const autoAudioDropdownRef = useRef<HTMLDivElement>(null);
  
  // Use refs to avoid stale closures in audio callback
  const isSessionActiveRef = useRef(false);
  const isPausedRef = useRef(false);
  
  // Keep refs in sync with state
  useEffect(() => {
    isSessionActiveRef.current = isSessionActive;
  }, [isSessionActive]);
  
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  // WebSocket connection
  const { socket, isConnected, emit } = useWebSocket();
  
  // Audio capture - use refs to get latest state values
  const { isRecording, startRecording, stopRecording, audioLevel } = useAudioCapture({
    onAudioData: (data) => {
      if (isSessionActiveRef.current && !isPausedRef.current) {
        emit('audio:chunk', { audio: data, timestamp: Date.now() });
      }
    },
  });

  // Track metadata for failed tracks (to report correct source to server)
  const failedTrackMetaRef = useRef<Map<string, { source: string }>>(new Map());
  
  // Audio player for sound effects and music
  const { isMuted, playTrack, stopTrack, toggleMute, stopAll, pauseTrack, resumeTrack, error: audioError, clearError: clearAudioError } = useAudioPlayer({
    onError: (trackId, errorMsg) => {
      console.error(`🚫 Audio playback failed for ${trackId}: ${errorMsg}`);
      const meta = failedTrackMetaRef.current.get(trackId);
      // Report playback failure to server so it can skip this track in the future
      emit('auto-audio:playback-failed', { 
        trackId, 
        source: meta?.source || 'unknown',
        error: errorMsg,
      });
      failedTrackMetaRef.current.delete(trackId);
    }
  });
  
  // Track currently playing sound for visual feedback

  // Load initial data
  useEffect(() => {
    if (campaignId) {
      loadCampaignData();
    }
  }, [campaignId]);

  // Update currentSessionId when URL changes
  useEffect(() => {
    if (urlSessionId) {
      setCurrentSessionId(urlSessionId);
    }
  }, [urlSessionId]);

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    socket.on('transcript:segment', (segment: TranscriptSegment) => {
      setTranscript((prev) => [...prev, segment]);
      scrollToBottom();
    });

    socket.on('speaker:updated', ({ segmentId, speakerName }: { segmentId: string; speakerName: string }) => {
      setTranscript((prev) =>
        prev.map((s) =>
          s.id === segmentId ? { ...s, speakerName, isEdited: true } : s
        )
      );
    });

    socket.on('transcript:corrected', ({ segmentId, text }: { segmentId: string; text: string }) => {
      console.log('✏️ Transcript corrected:', segmentId, text.substring(0, 30));
      setTranscript((prev) =>
        prev.map((s) =>
          s.id === segmentId ? { ...s, text } : s
        )
      );
    });

    socket.on('transcript:merged', ({ targetId, mergedId, newText }: { targetId: string; mergedId: string; newText: string }) => {
      console.log('🔗 Transcript merged:', targetId, '<-', mergedId);
      setTranscript((prev) => {
        // Update the target segment with merged text and remove the merged segment
        return prev
          .map((s) => s.id === targetId ? { ...s, text: newText } : s)
          .filter((s) => s.id !== mergedId);
      });
    });

    socket.on('audio:trigger', ({ mappingId, action }: { mappingId: string; action: 'play' | 'stop' | 'crossfade' }) => {
      const mapping = manualTriggers.find((m) => m.id === mappingId);
      if (mapping) {
        console.log(`🔊 Audio trigger: ${mapping.name} (${action})`);
        if (action === 'stop') {
          stopTrack(mappingId);
        } else {
          // Get the audio URL based on source
          const { url: audioUrl, isExternal, error: urlError } = getAudioUrl(mapping);
          
          if (isExternal && audioUrl) {
            window.open(audioUrl, '_blank', 'noopener,noreferrer');
            return;
          }
          
          if (urlError) {
            console.warn(`Audio error: ${urlError}`);
            return;
          }
          
          if (audioUrl) {
            playTrack({
              id: mappingId,
              name: mapping.name,
              src: audioUrl,
              loop: mapping.loop,
              volume: mapping.volume / 100,
            }, action === 'crossfade');
          }
        }
      }
    });

    socket.on('health:event', (event: HealthEvent) => {
      setPendingHealthEvents((prev) => [...prev, event]);
    });

    socket.on('scene:detected', (scene: { scene: string; confidence: number }) => {
      console.log(`🎭 Scene detected: ${scene.scene} (${Math.round(scene.confidence * 100)}%)`);
      setCurrentScene(scene);
    });

    // Auto-audio events
    socket.on('auto-audio:play', (data: { track: AutoAudioTrack; action: string; reason: string }) => {
      console.log(`🎵 Auto-audio: ${data.track.name} from ${data.track.source} (${data.reason})`);
      setAutoPlayingTrack({ name: data.track.name, type: data.track.type });
      
      // Store track metadata so we can report the source if playback fails
      failedTrackMetaRef.current.set(data.track.id, { source: data.track.source });
      
      // Track what's playing
      if (data.track.type === 'music') {
        // Add previous music to history if exists
        setNowPlayingMusic((prev) => {
          if (prev && prev.id !== data.track.id) {
            setAudioHistory((history) => {
              const filtered = history.filter(h => h.id !== prev.id);
              return [prev, ...filtered].slice(0, MAX_HISTORY_SIZE);
            });
          }
          return data.track;
        });
        setIsMusicPaused(false);
      } else {
        // Add effect to active effects
        setActiveEffects((prev) => [...prev, data.track]);
        // Remove effect after it ends (based on duration + buffer)
        const durationMs = (data.track.duration || 5) * 1000 + 500;
        setTimeout(() => {
          setActiveEffects((prev) => prev.filter(e => e.id !== data.track.id));
        }, durationMs);
      }
      
      // Play the track using our audio player
      // Include type so effects overlay on music instead of replacing it
      playTrack({
        id: data.track.id,
        name: data.track.name,
        src: data.track.src,
        loop: data.track.loop,
        volume: data.track.volume,
        type: data.track.type, // 'music' or 'effect' - effects will overlay
      }, data.action === 'crossfade');
      
      // Clear the indicator after a few seconds for effects
      if (data.track.type === 'effect') {
        setTimeout(() => {
          setAutoPlayingTrack((prev) => prev?.name === data.track.name ? null : prev);
        }, 3000);
      }
    });

    socket.on('auto-audio:settings-updated', (settings: AutoAudioSettings) => {
      console.log('🎛️ Auto-audio settings updated:', settings);
      setAutoAudioSettings(settings);
    });

    socket.on('player:updated', ({ playerId, currentHp }: { playerId: string; currentHp: number }) => {
      setPlayers((prev) =>
        prev.map((p) => (p.id === playerId ? { ...p, currentHp } : p))
      );
    });

    socket.on('session:started', ({ sessionId }: { sessionId: string }) => {
      console.log('Session started:', sessionId);
      setCurrentSessionId(sessionId);
      setIsSessionActive(true);
      setIsStarting(false);
      setError(null);
      startDurationTimer();
    });

    socket.on('session:paused', () => {
      setIsPaused(true);
    });

    socket.on('session:resumed', () => {
      setIsPaused(false);
    });

    socket.on('session:ended', () => {
      setIsSessionActive(false);
      stopDurationTimer();
    });

    socket.on('error', ({ message }: { message: string }) => {
      console.error('WebSocket error:', message);
      setError(message);
      setIsStarting(false);
    });

    return () => {
      socket.off('transcript:segment');
      socket.off('transcript:corrected');
      socket.off('transcript:merged');
      socket.off('speaker:updated');
      socket.off('audio:trigger');
      socket.off('health:event');
      socket.off('scene:detected');
      socket.off('player:updated');
      socket.off('session:started');
      socket.off('session:paused');
      socket.off('session:resumed');
      socket.off('session:ended');
      socket.off('error');
      socket.off('auto-audio:play');
      socket.off('auto-audio:settings-updated');
    };
  }, [socket, manualTriggers, playTrack]);

  const loadCampaignData = async () => {
    try {
      const [playersRes, mappingsRes] = await Promise.all([
        api.get<Player[]>(`/players?campaignId=${campaignId}`),
        api.get<SoundMapping[]>(`/sound-mappings?campaignId=${campaignId}`),
      ]);
      
      setPlayers(playersRes.data || []);
      setManualTriggers(
        (mappingsRes.data || []).filter((m) => m.triggerType === 'manual')
      );
    } catch (error) {
      console.error('Failed to load campaign data:', error);
    }
  };

  const startDurationTimer = () => {
    durationIntervalRef.current = setInterval(() => {
      setSessionDuration((prev) => prev + 1);
    }, 1000);
  };

  const stopDurationTimer = () => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }
  };

  const scrollToBottom = () => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  };

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartSession = async () => {
    setIsStarting(true);
    setError(null);

    try {
      let sessionIdToUse = currentSessionId;

      // If no session ID, create a new session first
      if (!sessionIdToUse) {
        console.log('Creating new session...');
        const response = await api.post<Session>('/sessions', { campaignId });
        if (response.data?.id) {
          sessionIdToUse = response.data.id;
          setCurrentSessionId(sessionIdToUse);
          // Update URL without full navigation
          window.history.replaceState(null, '', `/app/campaigns/${campaignId}/live/${sessionIdToUse}`);
        } else {
          throw new Error('Failed to create session');
        }
      }

      // Start the WebSocket session and recording
      console.log('Starting WebSocket session:', sessionIdToUse);
      
      // The session:started event is handled by the global useEffect handler
      // which sets isSessionActive and starts the duration timer
      emit('session:start', { sessionId: sessionIdToUse });
      
      // Start recording immediately - the session:started handler will update state
      // Small delay to let WebSocket message be sent before audio starts
      await new Promise(resolve => setTimeout(resolve, 100));
      console.log('Starting audio capture...');
      await startRecording();
      
    } catch (error) {
      console.error('Failed to start session:', error);
      setError('Failed to start session. Please try again.');
      setIsStarting(false);
      setIsSessionActive(false);
    }
  };

  const handlePauseResume = () => {
    if (isPaused) {
      emit('session:resume');
    } else {
      emit('session:pause');
    }
  };

  const handleEndSession = async () => {
    stopRecording();
    emit('session:end');
    stopAll();
    if (currentSessionId) {
      navigate(`/app/campaigns/${campaignId}/sessions/${currentSessionId}`);
    } else {
      navigate(`/app/campaigns/${campaignId}`);
    }
  };

  const handleSpeakerCorrection = (segmentId: string, speakerName: string) => {
    emit('speaker:attribute', { segmentId, speakerName });
    setSelectedSegmentId(null);
  };

  const handleHealthEventConfirm = (eventId: string, confirmed: boolean, modifiedValue?: number) => {
    emit('health:confirm', { eventId, confirmed, modifiedValue });
    setPendingHealthEvents((prev) => prev.filter((e) => e.id !== eventId));
  };

  // Get the audio URL based on source type
  const getAudioUrl = (mapping: SoundMapping): { url: string | null; isExternal: boolean; error?: string } => {
    // Freesound, Jamendo, and Tabletop Audio all have direct streaming URLs now
    if (mapping.audioSource === 'freesound' || mapping.audioSource === 'jamendo' || mapping.audioSource === 'tabletop') {
      if (mapping.previewUrl && mapping.previewUrl.startsWith('http')) {
        return { url: mapping.previewUrl, isExternal: false };
      }
      return { 
        url: null, 
        isExternal: false, 
        error: `Missing URL for ${mapping.audioSource} sound. Try removing and re-adding this sound.` 
      };
    }
    
    // Local files - not supported anymore
    if (mapping.audioSource === 'local') {
      return { 
        url: null, 
        isExternal: false, 
        error: 'Local audio files are no longer supported. Please use the Sound Library.' 
      };
    }
    
    // Fallback to previewUrl if available
    if (mapping.previewUrl) {
      return { url: mapping.previewUrl, isExternal: false };
    }
    
    return { url: null, isExternal: false, error: 'No audio URL available for this sound.' };
  };

  const handleStopAudio = () => {
    stopAll();
    setNowPlayingMusic(null);
    setActiveEffects([]);
  };

  const handlePauseMusic = () => {
    if (isMusicPaused) {
      resumeTrack();
      setIsMusicPaused(false);
    } else {
      pauseTrack();
      setIsMusicPaused(true);
    }
  };

  const handleCycleMusic = () => {
    // Request server to play a different track in the same theme
    if (currentScene) {
      emit('auto-audio:set-scene', { scene: currentScene.scene });
    } else {
      emit('auto-audio:set-scene', { scene: 'ambient' });
    }
  };

  const handlePlayFromHistory = (track: AutoAudioTrack) => {
    // Play a track from history
    playTrack({
      id: track.id,
      name: track.name,
      src: track.src,
      loop: track.loop,
      volume: track.volume,
      type: track.type,
    }, true);
    
    // Update now playing
    if (track.type === 'music') {
      setNowPlayingMusic(track);
      setIsMusicPaused(false);
      // Remove from history
      setAudioHistory((prev) => prev.filter(h => h.id !== track.id));
    }
  };

  const handleSoundAdded = () => {
    // Reload sound mappings when a new sound is added
    loadCampaignData();
  };

  // Auto-audio settings handlers
  const updateAutoAudioSettings = useCallback((newSettings: Partial<AutoAudioSettings>) => {
    emit('auto-audio:settings', newSettings);
    // Optimistic update
    setAutoAudioSettings((prev) => ({ ...prev, ...newSettings }));
  }, [emit]);

  const handleEffectFrequencyChange = useCallback((value: number) => {
    updateAutoAudioSettings({ effectFrequency: value });
  }, [updateAutoAudioSettings]);

  const handleAutoAudioToggle = useCallback(() => {
    updateAutoAudioSettings({ enabled: !autoAudioSettings.enabled });
  }, [updateAutoAudioSettings, autoAudioSettings.enabled]);

  const handleMusicToggle = useCallback(() => {
    updateAutoAudioSettings({ musicEnabled: !autoAudioSettings.musicEnabled });
  }, [updateAutoAudioSettings, autoAudioSettings.musicEnabled]);

  const handleEffectsToggle = useCallback(() => {
    updateAutoAudioSettings({ effectsEnabled: !autoAudioSettings.effectsEnabled });
  }, [updateAutoAudioSettings, autoAudioSettings.effectsEnabled]);

  // Request initial settings when session becomes active
  useEffect(() => {
    if (isSessionActive && socket) {
      emit('auto-audio:get-settings');
    }
  }, [isSessionActive, socket, emit]);

  // Click outside handler for auto-audio dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        autoAudioDropdownRef.current &&
        !autoAudioDropdownRef.current.contains(event.target as Node)
      ) {
        setShowAutoAudioSettings(false);
      }
    };

    if (showAutoAudioSettings) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAutoAudioSettings]);

  const getHealthPercentage = (current: number, max: number) => {
    return Math.round((current / max) * 100);
  };

  const getHealthStatus = (current: number, max: number) => {
    const percentage = getHealthPercentage(current, max);
    if (percentage > 50) return 'healthy';
    if (percentage > 25) return 'injured';
    return 'critical';
  };

  const getSpeakerOptions = () => {
    const options = [
      { value: 'DM', label: 'DM (Narrating)' },
      ...players.map((p) => ({
        value: p.playerName,
        label: `${p.playerName} (${p.characterName})`,
      })),
    ];
    return options;
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="bg-dungeon-900/80 border-b border-dungeon-700/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to={`/app/campaigns/${campaignId}`}
              className="text-dungeon-400 hover:text-parchment-200"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="font-display text-xl font-semibold">Live Session</h1>
              <p className="text-sm text-dungeon-400">
                {isSessionActive ? formatDuration(sessionDuration) : 'Not started'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Error message */}
            {error && (
              <div className="flex items-center gap-2 text-dragon-400 text-sm">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            {/* Recording indicator */}
            {isRecording && (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-dragon-500 recording-pulse" />
                <span className="text-sm text-dragon-400">Recording</span>
                {/* Audio level indicator */}
                <div className="w-24 h-2 bg-dungeon-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-mystic-500 transition-all duration-75"
                    style={{ width: `${audioLevel * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Connection status */}
            <div className={`flex items-center gap-1 text-xs ${isConnected ? 'text-emerald-400' : 'text-dragon-400'}`}>
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-dragon-400'}`} />
              {isConnected ? 'Connected' : 'Disconnected'}
            </div>

            {/* Current scene indicator */}
            {currentScene && (
              <div className="flex items-center gap-2 px-3 py-1 bg-dungeon-800 rounded-lg">
                <span className="text-xs text-dungeon-400">Scene:</span>
                <span className="text-sm font-medium text-mystic-400 capitalize">{currentScene.scene}</span>
                <span className="text-xs text-dungeon-500">
                  {Math.round(currentScene.confidence * 100)}%
                </span>
              </div>
            )}

            {/* Auto-audio indicator and toggle */}
            <div className="relative" ref={autoAudioDropdownRef}>
              <button
                onClick={() => setShowAutoAudioSettings(!showAutoAudioSettings)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
                  autoAudioSettings.enabled
                    ? 'bg-mystic-600/30 text-mystic-300 hover:bg-mystic-600/40'
                    : 'bg-dungeon-800 text-dungeon-400 hover:bg-dungeon-700'
                }`}
              >
                <Wand2 className={`w-4 h-4 ${autoAudioSettings.enabled ? 'text-mystic-400' : ''}`} />
                <span className="text-xs font-medium">AI Audio</span>
                {autoAudioSettings.enabled && (
                  <Sparkles className="w-3 h-3 text-mystic-400 animate-pulse" />
                )}
              </button>

              {/* Auto-audio settings dropdown */}
              {showAutoAudioSettings && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-dungeon-900 border border-dungeon-700 rounded-lg shadow-xl z-50 p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <Settings2 className="w-4 h-4 text-mystic-400" />
                      AI Audio Settings
                    </h4>
                    <button
                      onClick={() => setShowAutoAudioSettings(false)}
                      className="text-dungeon-400 hover:text-parchment-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* API Status Warning */}
                  {autoAudioSettings.apiStatus && 
                   !autoAudioSettings.apiStatus.freesound && 
                   !autoAudioSettings.apiStatus.jamendo &&
                   !autoAudioSettings.apiStatus.tabletop && (
                    <div className="mb-4 p-2 bg-dragon-900/50 border border-dragon-600/50 rounded-lg">
                      <div className="flex items-center gap-2 text-dragon-400 text-xs">
                        <AlertCircle className="w-3 h-3" />
                        <span>No audio sources available</span>
                      </div>
                      <p className="text-xs text-dungeon-400 mt-1">
                        Tabletop Audio should load automatically. Check your network connection.
                      </p>
                    </div>
                  )}

                  {/* API Status */}
                  {autoAudioSettings.apiStatus && (
                    <div className="mb-4 flex flex-wrap gap-2 text-xs">
                      <span className={`px-2 py-0.5 rounded ${
                        autoAudioSettings.apiStatus.tabletop 
                          ? 'bg-purple-900/50 text-purple-400' 
                          : 'bg-dungeon-800 text-dungeon-500'
                      }`}>
                        Tabletop Audio: {autoAudioSettings.apiStatus.tabletop ? '✓' : '...'}
                      </span>
                      <span className={`px-2 py-0.5 rounded ${
                        autoAudioSettings.apiStatus.freesound 
                          ? 'bg-emerald-900/50 text-emerald-400' 
                          : 'bg-dungeon-800 text-dungeon-500'
                      }`}>
                        Freesound: {autoAudioSettings.apiStatus.freesound ? '✓' : '✗'}
                      </span>
                      <span className={`px-2 py-0.5 rounded ${
                        autoAudioSettings.apiStatus.jamendo 
                          ? 'bg-emerald-900/50 text-emerald-400' 
                          : 'bg-dungeon-800 text-dungeon-500'
                      }`}>
                        Jamendo: {autoAudioSettings.apiStatus.jamendo ? '✓' : '✗'}
                      </span>
                    </div>
                  )}

                  {/* Master toggle */}
                  <div className="flex items-center justify-between mb-4 pb-4 border-b border-dungeon-700">
                    <span className="text-sm">AI Audio Enabled</span>
                    <button
                      onClick={handleAutoAudioToggle}
                      className={`w-12 h-6 rounded-full transition-colors relative ${
                        autoAudioSettings.enabled ? 'bg-mystic-600' : 'bg-dungeon-700'
                      }`}
                    >
                      <div
                        className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                          autoAudioSettings.enabled ? 'translate-x-7' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Music toggle */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-dungeon-300">Auto-change Music</span>
                    <button
                      onClick={handleMusicToggle}
                      disabled={!autoAudioSettings.enabled}
                      className={`w-10 h-5 rounded-full transition-colors relative ${
                        autoAudioSettings.musicEnabled && autoAudioSettings.enabled
                          ? 'bg-mystic-600'
                          : 'bg-dungeon-700'
                      } ${!autoAudioSettings.enabled ? 'opacity-50' : ''}`}
                    >
                      <div
                        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                          autoAudioSettings.musicEnabled ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Effects toggle */}
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm text-dungeon-300">Auto Sound Effects</span>
                    <button
                      onClick={handleEffectsToggle}
                      disabled={!autoAudioSettings.enabled}
                      className={`w-10 h-5 rounded-full transition-colors relative ${
                        autoAudioSettings.effectsEnabled && autoAudioSettings.enabled
                          ? 'bg-mystic-600'
                          : 'bg-dungeon-700'
                      } ${!autoAudioSettings.enabled ? 'opacity-50' : ''}`}
                    >
                      <div
                        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                          autoAudioSettings.effectsEnabled ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Effect frequency slider */}
                  <div className={`${!autoAudioSettings.enabled || !autoAudioSettings.effectsEnabled ? 'opacity-50' : ''}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-dungeon-300">Effect Frequency</span>
                      <span className="text-xs font-mono text-mystic-400">
                        {autoAudioSettings.effectFrequency}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={autoAudioSettings.effectFrequency}
                      onChange={(e) => handleEffectFrequencyChange(parseInt(e.target.value, 10))}
                      disabled={!autoAudioSettings.enabled || !autoAudioSettings.effectsEnabled}
                      className="w-full h-2 bg-dungeon-700 rounded-lg appearance-none cursor-pointer accent-mystic-500"
                    />
                    <div className="flex justify-between text-xs text-dungeon-500 mt-1">
                      <span>Rare</span>
                      <span>Often</span>
                    </div>
                  </div>

                  {/* Auto-playing indicator */}
                  {autoPlayingTrack && (
                    <div className="mt-4 pt-4 border-t border-dungeon-700">
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-2 h-2 rounded-full bg-mystic-400 animate-pulse" />
                        <span className="text-dungeon-400">Now playing:</span>
                        <span className="text-mystic-300 truncate">{autoPlayingTrack.name}</span>
                        <span className="text-xs text-dungeon-500 capitalize">({autoPlayingTrack.type})</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Audio mute toggle */}
            <button
              onClick={toggleMute}
              className={`p-2 rounded-lg ${
                isMuted ? 'text-dungeon-500' : 'text-parchment-200'
              } hover:bg-dungeon-800`}
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>

            {/* Session controls */}
            {!isSessionActive ? (
              <button
                onClick={handleStartSession}
                disabled={!isConnected || isStarting}
                className="btn-primary flex items-center gap-2 disabled:opacity-50"
              >
                <Mic className="w-4 h-4" />
                {isStarting ? 'Starting...' : 'Start Session'}
              </button>
            ) : (
              <>
                <button
                  onClick={handlePauseResume}
                  className="btn-secondary flex items-center gap-2"
                >
                  {isPaused ? (
                    <>
                      <Play className="w-4 h-4" />
                      Resume
                    </>
                  ) : (
                    <>
                      <Pause className="w-4 h-4" />
                      Pause
                    </>
                  )}
                </button>
                <button
                  onClick={handleEndSession}
                  className="btn-danger flex items-center gap-2"
                >
                  <Square className="w-4 h-4" />
                  End Session
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Transcript Panel */}
        <div className="flex-1 flex flex-col">
          <div className="px-6 py-3 border-b border-dungeon-700/50 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-mystic-400" />
            <h2 className="font-display font-semibold">Transcript</h2>
            <span className="text-sm text-dungeon-400">({transcript.length} segments)</span>
          </div>

          <div
            ref={transcriptRef}
            className="flex-1 overflow-y-auto p-6 space-y-2 scrollbar-thin"
          >
            {transcript.length === 0 ? (
              <div className="text-center py-12 text-dungeon-400">
                {isSessionActive
                  ? 'Listening... Speak to begin transcription.'
                  : 'Start the session to begin transcription.'}
              </div>
            ) : (
              transcript.map((segment) => (
                <div
                  key={segment.id}
                  className={`transcript-segment ${
                    segment.speakerName?.includes('DM')
                      ? 'transcript-segment-dm'
                      : 'transcript-segment-player'
                  } ${selectedSegmentId === segment.id ? 'bg-dungeon-800/50' : ''}`}
                  onClick={() => setSelectedSegmentId(segment.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <span className="text-sm font-semibold text-mystic-400">
                        {segment.speakerName || segment.speakerLabel}
                      </span>
                      {segment.isEdited && (
                        <span className="ml-2 text-xs text-dungeon-500">(edited)</span>
                      )}
                      <p className="text-parchment-200 mt-1">{segment.text}</p>
                    </div>
                    <span className="text-xs text-dungeon-500 whitespace-nowrap">
                      {new Date(segment.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  {/* Speaker correction dropdown */}
                  {selectedSegmentId === segment.id && (
                    <div className="mt-3 p-3 bg-dungeon-800 rounded-lg">
                      <p className="text-xs text-dungeon-400 mb-2">Correct speaker:</p>
                      <div className="flex flex-wrap gap-2">
                        {getSpeakerOptions().map((option) => (
                          <button
                            key={option.value}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSpeakerCorrection(segment.id, option.value);
                            }}
                            className="px-3 py-1 text-sm bg-dungeon-700 hover:bg-dungeon-600 rounded-lg transition-colors"
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Sidebar */}
        <aside className="w-80 border-l border-dungeon-700/50 flex flex-col bg-dungeon-900/30">
          {/* Players */}
          <div className="p-4 border-b border-dungeon-700/50">
            <h3 className="font-display font-semibold flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-mystic-400" />
              Players
            </h3>
            <div className="space-y-3">
              {players.map((player) => (
                <div key={player.id} className="bg-dungeon-800/50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm">{player.characterName}</span>
                    <span className="text-xs text-dungeon-400">
                      {player.currentHp}/{player.maxHp}
                    </span>
                  </div>
                  <div className="health-bar">
                    <div
                      className={`health-bar-fill ${getHealthStatus(
                        player.currentHp,
                        player.maxHp
                      )}`}
                      style={{
                        width: `${getHealthPercentage(player.currentHp, player.maxHp)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pending Health Events */}
          {pendingHealthEvents.length > 0 && (
            <div className="p-4 border-b border-dungeon-700/50">
              <h3 className="font-display font-semibold flex items-center gap-2 mb-4">
                <Heart className="w-4 h-4 text-dragon-400" />
                Pending Events
              </h3>
              <div className="space-y-2">
                {pendingHealthEvents.map((event) => (
                  <div
                    key={event.id}
                    className="bg-dragon-900/30 border border-dragon-700/50 rounded-lg p-3"
                  >
                    <p className="text-sm mb-2">{event.description}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleHealthEventConfirm(event.id, true)}
                        className="btn-ghost p-1 text-emerald-400 hover:bg-emerald-900/30"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleHealthEventConfirm(event.id, false)}
                        className="btn-ghost p-1 text-dragon-400 hover:bg-dragon-900/30"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Auto-Audio Status */}
          {autoAudioSettings.enabled && autoPlayingTrack && (
            <div className="p-4 border-b border-dungeon-700/50">
              <h3 className="font-display font-semibold flex items-center gap-2 mb-3">
                <Wand2 className="w-4 h-4 text-mystic-400" />
                AI Audio
              </h3>
              <div className="bg-mystic-900/30 border border-mystic-700/50 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-mystic-400 animate-pulse" />
                  <span className="text-xs text-mystic-400">Auto-playing:</span>
                </div>
                <p className="text-sm font-medium text-mystic-300 mt-1 truncate">
                  {autoPlayingTrack.name}
                </p>
                <span className="text-xs text-dungeon-500 capitalize">
                  {autoPlayingTrack.type}
                </span>
              </div>
            </div>
          )}

          {/* Now Playing & Audio Controls */}
          <div className="p-4 flex-1 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold flex items-center gap-2">
                <Music className="w-4 h-4 text-parchment-400" />
                Now Playing
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleMute}
                  className={`p-1.5 rounded transition-colors ${isMuted ? 'bg-dragon-600' : 'bg-dungeon-700 hover:bg-dungeon-600'}`}
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => setShowSoundLibrary(true)}
                  className="px-2 py-1 text-xs bg-mystic-600 hover:bg-mystic-500 rounded transition-colors"
                >
                  Browse
                </button>
              </div>
            </div>
            
            {/* Audio Error */}
            {audioError && (
              <div className="mb-3 p-2 bg-dragon-900/30 border border-dragon-700/50 rounded-lg">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-dragon-400">{audioError}</span>
                  <button onClick={clearAudioError} className="text-dragon-500 hover:text-dragon-400">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}
            
            {/* Currently Playing Music */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Disc3 className={`w-4 h-4 text-mystic-400 ${nowPlayingMusic && !isMusicPaused ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
                <span className="text-xs font-medium text-dungeon-400 uppercase tracking-wider">Music</span>
              </div>
              
              {nowPlayingMusic ? (
                <div className="p-3 bg-mystic-900/30 border border-mystic-700/50 rounded-lg">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-mystic-200 truncate">{nowPlayingMusic.name}</p>
                      <p className="text-xs text-mystic-500 capitalize">{nowPlayingMusic.source}</p>
                      {nowPlayingMusic.attribution && (
                        <p className="text-xs text-dungeon-500 mt-1 truncate">{nowPlayingMusic.attribution}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={handlePauseMusic}
                        className="p-1.5 bg-dungeon-700 hover:bg-dungeon-600 rounded transition-colors"
                        title={isMusicPaused ? 'Resume' : 'Pause'}
                      >
                        {isMusicPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={handleCycleMusic}
                        className="p-1.5 bg-dungeon-700 hover:bg-dungeon-600 rounded transition-colors"
                        title="Play different track in same theme"
                      >
                        <SkipForward className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleStopAudio}
                        className="p-1.5 bg-dragon-700 hover:bg-dragon-600 rounded transition-colors"
                        title="Stop all audio"
                      >
                        <Square className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {isMusicPaused && (
                    <div className="mt-2 text-xs text-amber-400 flex items-center gap-1">
                      <Pause className="w-3 h-3" /> Paused
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-dungeon-900/50 border border-dungeon-700/30 rounded-lg text-center">
                  <p className="text-sm text-dungeon-500">No music playing</p>
                  <button
                    onClick={() => emit('auto-audio:set-scene', { scene: currentScene?.scene || 'ambient' })}
                    className="mt-2 text-xs text-mystic-400 hover:text-mystic-300 underline"
                  >
                    Start ambient music
                  </button>
                </div>
              )}
            </div>
            
            {/* Active Sound Effects */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-medium text-dungeon-400 uppercase tracking-wider">Effects</span>
              </div>
              
              {activeEffects.length > 0 ? (
                <div className="space-y-2">
                  {activeEffects.map((effect) => (
                    <div
                      key={effect.id}
                      className="p-2 bg-amber-900/20 border border-amber-700/30 rounded-lg flex items-center gap-2"
                    >
                      <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                      <span className="text-sm text-amber-200 truncate flex-1">{effect.name}</span>
                      <span className="text-xs text-amber-500">{Math.round(effect.duration)}s</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-dungeon-500 italic">Sound effects will appear here when triggered</p>
              )}
            </div>
            
            {/* Audio History */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <History className="w-4 h-4 text-dungeon-400" />
                <span className="text-xs font-medium text-dungeon-400 uppercase tracking-wider">History</span>
              </div>
              
              {audioHistory.length > 0 ? (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {audioHistory.map((track) => (
                    <button
                      key={track.id}
                      onClick={() => handlePlayFromHistory(track)}
                      className="w-full p-2 bg-dungeon-800/50 hover:bg-dungeon-700/50 rounded-lg text-left transition-colors group"
                    >
                      <div className="flex items-center gap-2">
                        <Play className="w-3 h-3 text-dungeon-500 group-hover:text-mystic-400 transition-colors" />
                        <span className="text-sm text-dungeon-300 truncate flex-1">{track.name}</span>
                        <span className="text-xs text-dungeon-600 capitalize">{track.source}</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-dungeon-500 italic">Previously played tracks will appear here</p>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Sound Library Modal */}
      {showSoundLibrary && campaignId && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-4xl h-[80vh] relative">
            <SoundLibraryBrowser
              campaignId={campaignId}
              onAddToSoundboard={handleSoundAdded}
              onClose={() => setShowSoundLibrary(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
