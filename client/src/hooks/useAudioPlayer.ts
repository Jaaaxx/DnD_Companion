import { useRef, useState, useCallback, useEffect } from 'react';
import { Howl, Howler } from 'howler';

interface AudioTrack {
  id: string;
  name: string;
  src: string;
  loop?: boolean;
  volume?: number;
  type?: 'music' | 'effect'; // Used to determine if track should replace current or overlay
}

interface UseAudioPlayerOptions {
  crossfadeDuration?: number;
  onError?: (trackId: string, error: string) => void;
}

export function useAudioPlayer(options: UseAudioPlayerOptions = {}) {
  const { crossfadeDuration = 2000, onError } = options;

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<string | null>(null);
  const [currentMusic, setCurrentMusic] = useState<string | null>(null);
  const [volume, setVolume] = useState(0.8);
  const [error, setError] = useState<string | null>(null);

  const howlsRef = useRef<Map<string, Howl>>(new Map());
  const currentMusicHowlRef = useRef<Howl | null>(null); // For music tracks (looping background)
  const activeEffectsRef = useRef<Set<string>>(new Set()); // Track active one-shot effects

  // Initialize Howler global settings
  useEffect(() => {
    Howler.volume(volume);
  }, [volume]);

  const loadTrack = useCallback((track: AudioTrack): Howl => {
    const existing = howlsRef.current.get(track.id);
    if (existing) {
      return existing;
    }

    const howl = new Howl({
      src: [track.src],
      loop: track.loop ?? false,
      volume: track.volume ?? 1,
      preload: true,
      html5: true, // Use HTML5 Audio for better streaming/CORS support
      onloaderror: (_id, errorCode) => {
        const errorMessage = `Failed to load audio: ${errorCode === 1 ? 'File not found' : errorCode === 2 ? 'Network error' : errorCode === 3 ? 'Decode error' : errorCode === 4 ? 'Not supported' : 'Unknown error'}`;
        console.error(`Audio load error for ${track.name}:`, errorMessage);
        setError(errorMessage);
        onError?.(track.id, errorMessage);
      },
      onplayerror: (_id, errorMessage) => {
        console.error(`Audio play error for ${track.name}:`, errorMessage);
        setError(`Failed to play: ${errorMessage || 'Unknown error'}`);
        onError?.(track.id, `Failed to play: ${errorMessage || 'Unknown error'}`);
        // Try to unlock audio on mobile
        howl.once('unlock', () => {
          howl.play();
        });
      },
      onplay: () => {
        setError(null);
        setIsPlaying(true);
      },
      onend: () => {
        if (!track.loop) {
          // Remove from active effects if it's an effect
          activeEffectsRef.current.delete(track.id);
          
          // Only update isPlaying if no music is playing and no effects are active
          if (currentMusicHowlRef.current === null && activeEffectsRef.current.size === 0) {
            setIsPlaying(false);
          }
          
          // If this was the current track, clear it
          if (currentTrack === track.id) {
            setCurrentTrack(null);
          }
          
          // If this was the current music, clear the music ref
          if (currentMusic === track.id) {
            setCurrentMusic(null);
            currentMusicHowlRef.current = null;
          }
        }
      },
    });

    howlsRef.current.set(track.id, howl);
    return howl;
  }, [onError, currentTrack, currentMusic]);

  /**
   * Play a sound effect - overlays on top of current music without stopping it
   */
  const playEffect = useCallback(
    (track: AudioTrack) => {
      const howl = loadTrack(track);
      
      // Track this effect as active
      activeEffectsRef.current.add(track.id);
      
      // Set up cleanup when effect ends
      howl.once('end', () => {
        activeEffectsRef.current.delete(track.id);
      });
      
      howl.play();
      console.log(`🔊 Playing effect: ${track.name} (overlaid on music)`);
    },
    [loadTrack]
  );

  /**
   * Play a music track - replaces current music with optional crossfade
   */
  const playMusic = useCallback(
    (track: AudioTrack, withCrossfade = true) => {
      const howl = loadTrack(track);

      if (withCrossfade && currentMusicHowlRef.current && currentMusicHowlRef.current !== howl) {
        // Crossfade from current music track
        const oldHowl = currentMusicHowlRef.current;
        const fadeSteps = 20;
        const fadeInterval = crossfadeDuration / fadeSteps;
        let step = 0;

        const fadeOut = setInterval(() => {
          step++;
          const oldVolume = (1 - step / fadeSteps) * volume * (track.volume ?? 1);
          const newVolume = (step / fadeSteps) * volume * (track.volume ?? 1);

          oldHowl.volume(Math.max(0, oldVolume));
          howl.volume(Math.min(volume * (track.volume ?? 1), newVolume));

          if (step >= fadeSteps) {
            clearInterval(fadeOut);
            oldHowl.stop();
          }
        }, fadeInterval);

        howl.play();
      } else {
        // No crossfade, just play
        if (currentMusicHowlRef.current && currentMusicHowlRef.current !== howl) {
          currentMusicHowlRef.current.stop();
        }
        howl.play();
      }

      currentMusicHowlRef.current = howl;
      setCurrentMusic(track.id);
      setIsPlaying(true);
      console.log(`🎵 Playing music: ${track.name}`);
    },
    [crossfadeDuration, loadTrack, volume]
  );

  /**
   * Main playTrack function - routes to playMusic or playEffect based on track type
   */
  const playTrack = useCallback(
    (track: AudioTrack, withCrossfade = true) => {
      // If track is an effect (not looping, short), play it overlaid on music
      if (track.type === 'effect' || (!track.loop && track.type !== 'music')) {
        playEffect(track);
      } else {
        // It's music - replace current music
        playMusic(track, withCrossfade);
      }
      setCurrentTrack(track.id);
    },
    [playEffect, playMusic]
  );

  const stopTrack = useCallback((trackId?: string) => {
    if (trackId) {
      const howl = howlsRef.current.get(trackId);
      if (howl) {
        howl.stop();
        activeEffectsRef.current.delete(trackId);
        if (currentMusic === trackId) {
          setCurrentMusic(null);
          currentMusicHowlRef.current = null;
        }
        if (currentTrack === trackId) {
          setCurrentTrack(null);
        }
      }
    } else if (currentMusicHowlRef.current) {
      currentMusicHowlRef.current.stop();
      setCurrentMusic(null);
      setCurrentTrack(null);
      currentMusicHowlRef.current = null;
    }
    // Update playing state
    setIsPlaying(currentMusicHowlRef.current !== null || activeEffectsRef.current.size > 0);
  }, [currentTrack, currentMusic]);

  const stopAll = useCallback(() => {
    howlsRef.current.forEach((howl) => howl.stop());
    setCurrentTrack(null);
    setCurrentMusic(null);
    setIsPlaying(false);
    currentMusicHowlRef.current = null;
    activeEffectsRef.current.clear();
  }, []);

  const stopMusic = useCallback(() => {
    if (currentMusicHowlRef.current) {
      currentMusicHowlRef.current.stop();
      setCurrentMusic(null);
      currentMusicHowlRef.current = null;
    }
  }, []);

  const pauseTrack = useCallback(() => {
    if (currentMusicHowlRef.current) {
      currentMusicHowlRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const resumeTrack = useCallback(() => {
    if (currentMusicHowlRef.current) {
      currentMusicHowlRef.current.play();
      setIsPlaying(true);
    }
  }, []);

  const toggleMute = useCallback(() => {
    const newMuted = !isMuted;
    Howler.mute(newMuted);
    setIsMuted(newMuted);
  }, [isMuted]);

  const setGlobalVolume = useCallback((newVolume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    setVolume(clampedVolume);
    Howler.volume(clampedVolume);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      howlsRef.current.forEach((howl) => howl.unload());
      howlsRef.current.clear();
    };
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isPlaying,
    isMuted,
    currentTrack,
    currentMusic,
    volume,
    error,
    playTrack,
    playMusic,
    playEffect,
    stopTrack,
    stopMusic,
    stopAll,
    pauseTrack,
    resumeTrack,
    toggleMute,
    setVolume: setGlobalVolume,
    loadTrack,
    clearError,
  };
}


