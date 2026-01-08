// Shared types for D&D Companion

// ============ Campaign Types ============

export interface Campaign {
  id: string;
  name: string;
  description: string | null;
  worldContext: string | null;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
}

export interface CreateCampaignInput {
  name: string;
  description?: string;
  worldContext?: string;
}

export interface UpdateCampaignInput {
  name?: string;
  description?: string;
  worldContext?: string;
}

// ============ Session Types ============

export type SessionStatus = 'draft' | 'in_progress' | 'completed';

export interface Session {
  id: string;
  campaignId: string;
  sessionNumber: number;
  title: string | null;
  date: Date;
  transcript: TranscriptSegment[];
  notes: string | null;
  recap: string | null;
  status: SessionStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSessionInput {
  campaignId: string;
  title?: string;
  date?: Date;
}

export interface UpdateSessionInput {
  title?: string;
  notes?: string;
  recap?: string;
  status?: SessionStatus;
}

// ============ Player Types ============

export interface Player {
  id: string;
  campaignId: string;
  playerName: string;
  characterName: string;
  characterClass: string | null;
  characterRace: string | null;
  maxHp: number;
  currentHp: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePlayerInput {
  campaignId: string;
  playerName: string;
  characterName: string;
  characterClass?: string;
  characterRace?: string;
  maxHp?: number;
  currentHp?: number;
}

export interface UpdatePlayerInput {
  playerName?: string;
  characterName?: string;
  characterClass?: string;
  characterRace?: string;
  maxHp?: number;
  currentHp?: number;
  notes?: string;
}

// ============ NPC Types ============

export interface NPC {
  id: string;
  campaignId: string;
  name: string;
  description: string | null;
  speechPatterns: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateNPCInput {
  campaignId: string;
  name: string;
  description?: string;
  speechPatterns?: string;
}

export interface UpdateNPCInput {
  name?: string;
  description?: string;
  speechPatterns?: string;
}

// ============ Sound Mapping Types ============

export type TriggerType = 'keyword' | 'scene' | 'manual';
export type SceneType = 'combat' | 'exploration' | 'social' | 'tense' | 'dramatic' | 'tavern' | 'forest' | 'dungeon' | 'ambient';

export interface SoundMapping {
  id: string;
  campaignId: string;
  name: string;
  triggerType: TriggerType;
  triggerValue: string; // keyword pattern, scene type, or manual cue name
  audioFile: string; // path or URL to audio file
  volume: number; // 0-100
  loop: boolean;
  crossfadeDuration: number; // milliseconds
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSoundMappingInput {
  campaignId: string;
  name: string;
  triggerType: TriggerType;
  triggerValue: string;
  audioFile: string;
  volume?: number;
  loop?: boolean;
  crossfadeDuration?: number;
}

// ============ Transcript Types ============

export interface TranscriptSegment {
  id: string;
  timestamp: number; // milliseconds from session start
  speakerLabel: string; // Raw from Deepgram (Speaker 0, Speaker 1, etc.)
  speakerName: string | null; // Attributed name (player name, character name, or "DM (as NPC)")
  text: string;
  confidence: number;
  isEdited: boolean;
}

export interface SpeakerAttribution {
  segmentId: string;
  speakerName: string;
}

// ============ Health Event Types ============

export type HealthEventType = 'damage' | 'healing' | 'status' | 'death' | 'revive';

export interface HealthEvent {
  id: string;
  sessionId: string;
  playerId: string;
  type: HealthEventType;
  value: number | null;
  statusEffect: string | null;
  description: string;
  timestamp: number;
  confirmed: boolean;
  createdAt: Date;
}

export interface CreateHealthEventInput {
  sessionId: string;
  playerId: string;
  type: HealthEventType;
  value?: number;
  statusEffect?: string;
  description: string;
  timestamp: number;
}

// ============ WebSocket Event Types ============

export interface WSAudioChunk {
  type: 'audio_chunk';
  data: ArrayBuffer;
  timestamp: number;
}

export interface WSTranscriptUpdate {
  type: 'transcript_update';
  segment: TranscriptSegment;
}

export interface WSAttributionUpdate {
  type: 'attribution_update';
  attributions: SpeakerAttribution[];
}

export interface WSSceneChange {
  type: 'scene_change';
  scene: SceneType;
  confidence: number;
}

export interface WSSoundTrigger {
  type: 'sound_trigger';
  mappingId: string;
  action: 'play' | 'stop' | 'crossfade';
}

export interface WSHealthEvent {
  type: 'health_event';
  event: HealthEvent;
}

export interface WSSessionControl {
  type: 'session_control';
  action: 'start' | 'pause' | 'resume' | 'end';
  sessionId: string;
}

export type WSClientMessage = WSAudioChunk | WSSessionControl | {
  type: 'manual_attribution';
  segmentId: string;
  speakerName: string;
} | {
  type: 'manual_sound_trigger';
  mappingId: string;
} | {
  type: 'confirm_health_event';
  eventId: string;
  confirmed: boolean;
  modifiedValue?: number;
};

export type WSServerMessage = 
  | WSTranscriptUpdate 
  | WSAttributionUpdate 
  | WSSceneChange 
  | WSSoundTrigger 
  | WSHealthEvent
  | { type: 'session_started'; sessionId: string }
  | { type: 'session_paused' }
  | { type: 'session_resumed' }
  | { type: 'session_ended'; recap: string }
  | { type: 'error'; message: string };

// ============ API Response Types ============

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ============ Audio Library Types ============

export interface AudioTrack {
  id: string;
  name: string;
  category: SceneType;
  filename: string;
  duration: number; // seconds
  isBuiltIn: boolean;
}

export interface AudioCategory {
  type: SceneType;
  name: string;
  tracks: AudioTrack[];
}


