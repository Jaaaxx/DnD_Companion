import { createClient, LiveTranscriptionEvents, LiveClient } from '@deepgram/sdk';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config.js';
import type { Campaign, Player, NPC } from '@prisma/client';

export interface TranscriptSegment {
  id: string;
  timestamp: number;
  speakerLabel: string;
  speakerName: string | null;
  text: string;
  confidence: number;
  isEdited: boolean;
}

type CampaignWithRelations = Campaign & {
  players: Player[];
  npcs: NPC[];
};

export class TranscriptionService {
  private deepgram;
  private connection: LiveClient | null = null;
  private campaign: CampaignWithRelations;
  private onSegment: (segment: TranscriptSegment) => void;
  private sessionStartTime: number;
  private isConnecting: boolean = false;
  private isConnected: boolean = false;
  private keepAliveInterval: ReturnType<typeof setInterval> | null = null;
  private lastSpeaker: number | null = null;
  private speakerChangeCount: number = 0;

  constructor(
    campaign: CampaignWithRelations,
    onSegment: (segment: TranscriptSegment) => void
  ) {
    const apiKey = config.deepgramApiKey;
    if (!apiKey) {
      console.error('❌ DEEPGRAM_API_KEY is not configured');
      throw new Error('DEEPGRAM_API_KEY is required');
    }
    console.log('🎤 Initializing Deepgram with API key:', apiKey.substring(0, 8) + '...');
    
    this.deepgram = createClient(apiKey);
    this.campaign = campaign;
    this.onSegment = onSegment;
    this.sessionStartTime = Date.now();
    
    this.initializeConnection();
  }

  private async initializeConnection(): Promise<void> {
    if (this.isConnecting || this.isConnected) {
      return;
    }
    
    this.isConnecting = true;
    
    try {
      console.log('Initializing Deepgram connection...');
      
      // Deepgram configuration optimized for speaker diarization
      // See: https://developers.deepgram.com/docs/diarization
      this.connection = this.deepgram.listen.live({
        model: 'nova-2',
        language: 'en-US',
        smart_format: true,
        punctuate: true,
        // Diarization - critical for speaker identification
        diarize: true,
        // Use latest diarization version for best results
        diarize_version: '2024-01-09',
        // Utterances help group speech by natural pauses
        utterances: true,
        // Higher utterance split helps separate speakers
        utt_split: 0.8,
        // No interim results - only final for cleaner segments
        interim_results: false,
        // Longer endpointing (ms) gives better speaker separation
        // Higher value = wait longer for speaker to finish
        endpointing: 500,
        // Audio format
        encoding: 'linear16',
        sample_rate: 16000,
        channels: 1,
        // VAD (Voice Activity Detection) events help track speech boundaries
        vad_events: true,
      });
      
      console.log('🎤 Deepgram config: diarize=true, utt_split=0.8, endpointing=500ms');

      this.connection.on(LiveTranscriptionEvents.Open, () => {
        console.log('✅ Deepgram connection opened successfully');
        console.log('   - Diarization: ENABLED');
        console.log('   - Model: nova-2');
        console.log('   - Looking for speaker changes...');
        this.isConnected = true;
        this.isConnecting = false;
        
        // Start keep-alive to prevent connection timeout
        this.startKeepAlive();
      });

      this.connection.on(LiveTranscriptionEvents.Transcript, (data) => {
        this.handleTranscript(data);
      });
      
      // Log speech start/end events for debugging speaker boundaries
      this.connection.on(LiveTranscriptionEvents.SpeechStarted, () => {
        console.log('🎙️ Speech started');
      });
      
      // Utterance end events (if available)
      this.connection.on(LiveTranscriptionEvents.UtteranceEnd, () => {
        console.log('⏸️ Utterance ended (potential speaker boundary)');
      });

      this.connection.on(LiveTranscriptionEvents.Error, (error) => {
        console.error('Deepgram error:', error);
        this.isConnected = false;
        this.isConnecting = false;
      });

      this.connection.on(LiveTranscriptionEvents.Close, () => {
        console.log('Deepgram connection closed');
        this.isConnected = false;
        this.isConnecting = false;
        this.stopKeepAlive();
      });
      
      // Wait for connection to be ready
      await this.waitForConnection();
      
    } catch (error) {
      console.error('Failed to initialize Deepgram connection:', error);
      this.isConnecting = false;
      throw error;
    }
  }
  
  private waitForConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Deepgram connection timeout'));
      }, 10000);
      
      const checkConnection = () => {
        if (this.isConnected) {
          clearTimeout(timeout);
          resolve();
        } else if (!this.isConnecting) {
          clearTimeout(timeout);
          reject(new Error('Deepgram connection failed'));
        } else {
          setTimeout(checkConnection, 100);
        }
      };
      
      checkConnection();
    });
  }
  
  private startKeepAlive() {
    this.stopKeepAlive();
    // Send keep-alive every 8 seconds to prevent timeout
    this.keepAliveInterval = setInterval(() => {
      if (this.connection && this.isConnected) {
        try {
          this.connection.keepAlive();
        } catch (e) {
          console.warn('Keep-alive failed:', e);
        }
      }
    }, 8000);
  }
  
  private stopKeepAlive() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }

  private handleTranscript(data: {
    channel?: {
      alternatives?: Array<{
        transcript?: string;
        confidence?: number;
        words?: Array<{
          word: string;
          speaker?: number;
          speaker_confidence?: number;
          start: number;
          end: number;
        }>;
      }>;
    };
    is_final?: boolean;
    speech_final?: boolean;
  }) {
    const alternative = data.channel?.alternatives?.[0];
    
    if (!alternative?.transcript) return;

    const transcript = alternative.transcript.trim();
    if (!transcript) return;

    const words = alternative.words || [];
    
    // Log detailed speaker info from Deepgram
    const speakerInfo = words.map(w => ({ word: w.word, speaker: w.speaker, conf: w.speaker_confidence }));
    const uniqueSpeakers = [...new Set(words.map(w => w.speaker).filter(s => s !== undefined))];
    
    console.log('📝 Deepgram transcript:', {
      text: transcript.substring(0, 40),
      wordCount: words.length,
      speakers: uniqueSpeakers,
      speakerDetails: speakerInfo.slice(0, 5), // First 5 words with speaker info
    });

    // Check if there are speaker changes within this utterance
    if (uniqueSpeakers.length > 1) {
      // Split by speaker - create separate segments for each speaker's portion
      console.log(`🔀 Multiple speakers in utterance: ${uniqueSpeakers.join(', ')}`);
      this.splitBySpeaker(words, alternative.confidence ?? 0);
      return;
    }

    // Single speaker utterance
    const speakerNum = words[0]?.speaker ?? 0;
    
    // Track speaker changes
    if (this.lastSpeaker !== null && speakerNum !== this.lastSpeaker) {
      this.speakerChangeCount++;
      console.log(`🔄 Speaker change detected! ${this.lastSpeaker} -> ${speakerNum} (change #${this.speakerChangeCount})`);
    }
    this.lastSpeaker = speakerNum;
    
    // Use letter labels (A, B, C, etc.)
    const speakerLetter = String.fromCharCode(65 + (speakerNum % 26));
    const speakerLabel = `Speaker ${speakerLetter}`;

    // Calculate timestamp relative to session start
    const timestamp = Date.now() - this.sessionStartTime;

    const segment: TranscriptSegment = {
      id: uuidv4(),
      timestamp,
      speakerLabel,
      speakerName: null,
      text: transcript,
      confidence: alternative.confidence ?? 0,
      isEdited: false,
    };

    console.log(`🎯 Segment [${speakerLabel}]: "${transcript.substring(0, 50)}..."`);
    this.onSegment(segment);
  }

  /**
   * Split an utterance with multiple speakers into separate segments
   */
  private splitBySpeaker(
    words: Array<{ word: string; speaker?: number; start: number; end: number }>,
    confidence: number
  ) {
    let currentSpeaker: number | undefined = words[0]?.speaker;
    let currentWords: string[] = [];
    const timestamp = Date.now() - this.sessionStartTime;

    for (const word of words) {
      if (word.speaker !== currentSpeaker && currentWords.length > 0) {
        // Emit segment for previous speaker
        const speakerNum = currentSpeaker ?? 0;
        const speakerLetter = String.fromCharCode(65 + (speakerNum % 26));
        const speakerLabel = `Speaker ${speakerLetter}`;
        
        const segment: TranscriptSegment = {
          id: uuidv4(),
          timestamp,
          speakerLabel,
          speakerName: null,
          text: currentWords.join(' '),
          confidence,
          isEdited: false,
        };
        
        console.log(`🎯 Split segment [${speakerLabel}]: "${segment.text}"`);
        this.onSegment(segment);
        
        // Track speaker change
        if (this.lastSpeaker !== null && speakerNum !== this.lastSpeaker) {
          this.speakerChangeCount++;
          console.log(`🔄 Speaker change: ${this.lastSpeaker} -> ${speakerNum}`);
        }
        this.lastSpeaker = speakerNum;
        
        // Start new speaker's words
        currentWords = [];
        currentSpeaker = word.speaker;
      }
      
      currentWords.push(word.word);
    }
    
    // Emit final segment
    if (currentWords.length > 0) {
      const speakerNum = currentSpeaker ?? 0;
      const speakerLetter = String.fromCharCode(65 + (speakerNum % 26));
      const speakerLabel = `Speaker ${speakerLetter}`;
      
      const segment: TranscriptSegment = {
        id: uuidv4(),
        timestamp,
        speakerLabel,
        speakerName: null,
        text: currentWords.join(' '),
        confidence,
        isEdited: false,
      };
      
      console.log(`🎯 Split segment [${speakerLabel}]: "${segment.text}"`);
      this.onSegment(segment);
      
      if (this.lastSpeaker !== null && speakerNum !== this.lastSpeaker) {
        this.speakerChangeCount++;
      }
      this.lastSpeaker = speakerNum;
    }
  }

  private audioChunkCount = 0;
  
  async processAudioChunk(audioData: Buffer, _timestamp: number) {
    this.audioChunkCount++;
    
    // Log every 50 chunks (~3-4 seconds of audio)
    if (this.audioChunkCount % 50 === 0) {
      console.log(`🔊 Received ${this.audioChunkCount} audio chunks, size: ${audioData.length} bytes, connected: ${this.isConnected}`);
    }
    
    // Ensure connection is ready
    if (!this.isConnected) {
      if (!this.isConnecting) {
        console.log('Reconnecting to Deepgram...');
        await this.initializeConnection();
      } else {
        // Wait a bit for connection to establish
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    if (this.connection && this.isConnected) {
      try {
        // Convert Buffer to ArrayBuffer for Deepgram SDK
        const arrayBuffer = audioData.buffer.slice(
          audioData.byteOffset,
          audioData.byteOffset + audioData.byteLength
        );
        this.connection.send(arrayBuffer);
      } catch (error) {
        console.error('Error sending audio to Deepgram:', error);
      }
    } else if (this.audioChunkCount % 50 === 1) {
      console.warn('⚠️ Cannot send audio: Deepgram not connected');
    }
  }

  async close() {
    console.log('Closing transcription service...');
    this.stopKeepAlive();
    
    if (this.connection) {
      try {
        this.connection.requestClose();
      } catch (e) {
        // Ignore errors during close
      }
      this.connection = null;
    }
    
    this.isConnected = false;
    this.isConnecting = false;
  }

  // Get campaign context for AI attribution
  getCampaignContext(): string {
    const players = this.campaign.players
      .map(p => `${p.playerName} plays ${p.characterName} (${p.characterRace} ${p.characterClass})`)
      .join('\n');

    const npcs = this.campaign.npcs
      .map(n => `${n.name}: ${n.description || 'No description'}${n.speechPatterns ? ` - Speech: ${n.speechPatterns}` : ''}`)
      .join('\n');

    return `
Campaign: ${this.campaign.name}
${this.campaign.description || ''}

World Context:
${this.campaign.worldContext || 'No world context provided'}

Players:
${players || 'No players defined'}

NPCs (played by DM):
${npcs || 'No NPCs defined'}
`.trim();
  }
}

