import type { SoundMapping, TriggerType } from '@prisma/client';

export interface AudioTriggerEvent {
  mappingId: string;
  action: 'play' | 'stop' | 'crossfade';
  manual?: boolean;
}

type SoundMappingWithRelations = SoundMapping;

export class AudioTriggerService {
  private soundMappings: SoundMappingWithRelations[];
  private onTrigger: (event: AudioTriggerEvent) => void;
  private currentlyPlaying: string | null = null;
  private keywordPatterns: Map<string, RegExp> = new Map();

  constructor(
    soundMappings: SoundMappingWithRelations[],
    onTrigger: (event: AudioTriggerEvent) => void
  ) {
    this.soundMappings = soundMappings;
    this.onTrigger = onTrigger;
    
    // Pre-compile keyword patterns
    this.soundMappings
      .filter(m => m.triggerType === 'keyword')
      .forEach(m => {
        try {
          // Convert trigger value to case-insensitive regex
          const pattern = new RegExp(m.triggerValue, 'i');
          this.keywordPatterns.set(m.id, pattern);
        } catch {
          // If invalid regex, use literal match
          const escaped = m.triggerValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          this.keywordPatterns.set(m.id, new RegExp(escaped, 'i'));
        }
      });
  }

  /**
   * Check transcript text for keyword triggers
   */
  checkKeywordTriggers(text: string): void {
    for (const mapping of this.soundMappings) {
      if (mapping.triggerType !== 'keyword') continue;

      const pattern = this.keywordPatterns.get(mapping.id);
      if (pattern && pattern.test(text)) {
        this.triggerSound(mapping.id);
        break; // Only trigger one sound per text segment
      }
    }
  }

  /**
   * Handle scene change from AI detection
   */
  handleSceneChange(scene: string, confidence: number): void {
    if (confidence < 0.6) return; // Ignore low-confidence detections

    // Find sound mapping for this scene type
    const mapping = this.soundMappings.find(
      m => m.triggerType === 'scene' && m.triggerValue === scene
    );

    if (mapping && mapping.id !== this.currentlyPlaying) {
      this.triggerSound(mapping.id, 'crossfade');
    }
  }

  /**
   * Manual trigger from DM
   */
  manualTrigger(mappingId: string): void {
    this.triggerSound(mappingId, 'play');
  }

  /**
   * Stop current audio
   */
  stopAudio(): void {
    if (this.currentlyPlaying) {
      this.onTrigger({
        mappingId: this.currentlyPlaying,
        action: 'stop',
      });
      this.currentlyPlaying = null;
    }
  }

  private triggerSound(mappingId: string, action: 'play' | 'crossfade' = 'play'): void {
    const mapping = this.soundMappings.find(m => m.id === mappingId);
    if (!mapping) return;

    // Determine action based on current state
    const finalAction = this.currentlyPlaying ? 'crossfade' : action;

    this.onTrigger({
      mappingId,
      action: finalAction,
    });

    this.currentlyPlaying = mappingId;
  }

  /**
   * Get all manual trigger mappings (for UI display)
   */
  getManualTriggers(): SoundMappingWithRelations[] {
    return this.soundMappings.filter(m => m.triggerType === 'manual');
  }

  /**
   * Get mapping by ID
   */
  getMapping(mappingId: string): SoundMappingWithRelations | undefined {
    return this.soundMappings.find(m => m.id === mappingId);
  }
}

// Common keyword patterns for D&D
export const COMMON_TRIGGERS = {
  combat: [
    'roll for initiative',
    'roll initiative',
    'combat begins',
    'we roll initiative',
    'let\'s roll initiative',
  ],
  victory: [
    'you have defeated',
    'the enemy falls',
    'you win',
    'combat is over',
    'you are victorious',
  ],
  dramatic: [
    'roll a death saving throw',
    'death save',
    'you fall unconscious',
    'critical hit',
    'natural 20',
    'natural 1',
  ],
  rest: [
    'long rest',
    'short rest',
    'you take a rest',
    'make camp',
    'set up camp',
  ],
};


