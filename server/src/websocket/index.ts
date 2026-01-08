import { Server, Socket } from 'socket.io';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { TranscriptionService, TranscriptSegment } from '../services/transcription.js';
import { AIService } from '../services/ai.js';
import { AudioTriggerService } from '../services/audioTrigger.js';
import { AutoAudioService, AutoAudioSettings } from '../services/autoAudioService.js';
import { tabletopAudioService } from '../services/tabletopAudio.js';

interface SessionState {
  sessionId: string;
  campaignId: string;
  userId: string;
  isActive: boolean;
  startTime: number;
  transcriptionService: TranscriptionService | null;
  transcriptSegments: TranscriptSegment[];
  saveInterval: ReturnType<typeof setInterval> | null;
  aiService: AIService | null;
  audioTriggerService: AudioTriggerService | null;
  autoAudioService: AutoAudioService | null;
  lastSceneDetectionIndex: number;
  lastSpeakerAttributionIndex: number;
  mergedSegmentIds: Set<string>; // Track which segment pairs have been merged
}

const activeSessions = new Map<string, SessionState>();

// Helper to save transcript to database
async function saveTranscript(sessionId: string, segments: TranscriptSegment[]) {
  if (segments.length === 0) return;
  
  try {
    await prisma.session.update({
      where: { id: sessionId },
      data: { transcript: segments as unknown as Prisma.InputJsonValue },
    });
    console.log(`💾 Saved ${segments.length} transcript segments for session ${sessionId}`);
  } catch (error) {
    console.error('Error saving transcript:', error);
  }
}

// Helper to merge consecutive segments from the same speaker
function mergeConsecutiveSegments(
  segments: TranscriptSegment[],
  startIndex: number,
  endIndex: number,
  socket: import('socket.io').Socket,
  mergedSegmentIds: Set<string>
): void {
  // Track which segments to remove (merged into others)
  const toRemove: Set<string> = new Set();
  
  let i = startIndex;
  while (i < endIndex - 1 && i < segments.length - 1) {
    const current = segments[i];
    const next = segments[i + 1];
    
    // Skip if either segment is already marked for removal
    if (toRemove.has(current.id) || toRemove.has(next.id)) {
      i++;
      continue;
    }
    
    // Get effective speaker names
    const currentSpeaker = current.speakerName || current.speakerLabel;
    const nextSpeaker = next.speakerName || next.speakerLabel;
    
    // Only merge if both have confirmed speaker names (not just "Speaker A")
    const hasConfirmedSpeaker = (s: string) => !s.startsWith('Speaker ');
    
    if (currentSpeaker === nextSpeaker && hasConfirmedSpeaker(currentSpeaker)) {
      // Check if this exact pair has already been merged (avoid duplicating text)
      const mergeKey = `${current.id}:${next.id}`;
      if (mergedSegmentIds.has(mergeKey)) {
        i++;
        continue;
      }
      
      // Merge next into current
      const mergedText = `${current.text} ${next.text}`.trim();
      
      console.log(`🔗 Merging: "${current.text.substring(0, 20)}..." + "${next.text.substring(0, 20)}..." [${currentSpeaker}]`);
      
      // Update current segment
      current.text = mergedText;
      
      // Mark this merge as done
      mergedSegmentIds.add(mergeKey);
      
      // Mark next for removal
      toRemove.add(next.id);
      
      // Emit merge event to client
      socket.emit('transcript:merged', {
        targetId: current.id,
        mergedId: next.id,
        newText: mergedText,
      });
      
      // Move to i+2 to check the segment AFTER the one we just merged
      // (which is now at position i+1 after removal)
      // But since we haven't removed yet, increment by 1 and let the
      // toRemove check skip the merged segment
      i++;
    } else {
      i++;
    }
  }
  
  // Remove merged segments from array (iterate backwards to maintain indices)
  if (toRemove.size > 0) {
    for (let j = segments.length - 1; j >= 0; j--) {
      if (toRemove.has(segments[j].id)) {
        segments.splice(j, 1);
      }
    }
    console.log(`🔗 Removed ${toRemove.size} merged segments, ${segments.length} remaining`);
  }
}

export function setupWebSocket(io: Server) {
  io.on('connection', (socket: Socket) => {
    console.log(`Client connected: ${socket.id}`);
    
    let currentSessionState: SessionState | null = null;

    // Authenticate socket connection
    socket.on('authenticate', async (data: { token: string; userId: string }) => {
      try {
        // In production, verify the token properly
        // For now, we'll accept the userId directly in development
        socket.data.userId = data.userId;
        socket.emit('authenticated', { success: true });
      } catch (error) {
        socket.emit('error', { message: 'Authentication failed' });
      }
    });

    // Start a session
    socket.on('session:start', async (data: { sessionId: string }) => {
      try {
        const { sessionId } = data;
        
        console.log('Starting session with ID:', sessionId);
        
        // Validate sessionId
        if (!sessionId) {
          console.error('No sessionId provided');
          socket.emit('error', { message: 'No session ID provided' });
          return;
        }
        
        // Get session and verify ownership
        const session = await prisma.session.findUnique({
          where: { id: sessionId },
          include: {
            campaign: {
              include: {
                players: true,
                npcs: true,
                soundMappings: true,
              },
            },
          },
        });

        if (!session) {
          console.error('Session not found:', sessionId);
          socket.emit('error', { message: 'Session not found' });
          return;
        }

        // Update session status
        await prisma.session.update({
          where: { id: sessionId },
          data: { status: 'in_progress' },
        });

        // Initialize transcript storage
        const transcriptSegments: TranscriptSegment[] = [];
        const mergedSegmentIds = new Set<string>(); // Track which segment pairs have been merged
        let lastSceneDetectionIndex = 0;
        let lastSpeakerAttributionIndex = 0;
        
        // Create AI service early so we can use it in the callback
        const aiServiceInstance = new AIService(session.campaign);
        
        // Create audio trigger service early
        const audioTriggerServiceInstance = new AudioTriggerService(
          session.campaign.soundMappings,
          (trigger) => {
            socket.emit('audio:trigger', trigger);
            console.log(`🔊 Audio trigger: ${trigger.mappingId} (${trigger.action})`);
          }
        );
        
        // Create auto-audio service for AI-driven audio
        const autoAudioServiceInstance = new AutoAudioService((event) => {
          // Emit the auto-generated audio event to the client
          socket.emit('auto-audio:play', {
            track: event.track,
            action: event.action,
            reason: event.reason,
          });
          console.log(`🎵 Auto-audio: ${event.track.name} (${event.reason})`);
        });
        autoAudioServiceInstance.reset();
        
        // Create transcription service for this session (only if API key is configured)
        let transcriptionService: TranscriptionService | null = null;
        if (process.env.DEEPGRAM_API_KEY) {
          transcriptionService = new TranscriptionService(
            session.campaign,
            async (segment) => {
              // === INSTANT LOCAL CORRECTIONS (cached, no API) ===
              segment.text = aiServiceInstance.correctTranscriptText(segment.text);
              
              // Store the segment
              transcriptSegments.push(segment);
              const segmentIndex = transcriptSegments.length - 1;
              
              // Emit to client immediately (may be corrected later)
              socket.emit('transcript:segment', segment);
              console.log(`📝 Transcript segment ${transcriptSegments.length}: "${segment.text.substring(0, 50)}..."`);
              
              // === AI-POWERED CORRECTION (runs in background) ===
              // Get recent context for better correction
              const recentContext = transcriptSegments
                .slice(-5, -1)
                .map(s => s.text)
                .join(' ');
              
              aiServiceInstance.correctTranscriptWithAI(segment.text, recentContext)
                .then(correctedText => {
                  if (correctedText !== segment.text) {
                    // Update the segment
                    transcriptSegments[segmentIndex].text = correctedText;
                    // Emit correction to client
                    socket.emit('transcript:corrected', {
                      segmentId: segment.id,
                      text: correctedText,
                    });
                  }
                })
                .catch(err => console.error('AI correction error:', err));
              
              // === KEYWORD TRIGGERS (fast, no API call) ===
              audioTriggerServiceInstance.checkKeywordTriggers(segment.text);
              
              // === AUTO-AUDIO PROCESSING (AI-driven audio selection) ===
              // Process segment for automatic sound effects and music
              autoAudioServiceInstance.processSegment(segment.text)
                .catch(err => console.error('Auto-audio processing error:', err));
              
              // === AI ENHANCEMENTS (batched to avoid API overload) ===
              const segmentCount = transcriptSegments.length;
              
              // Scene detection every 5 segments
              if (segmentCount >= lastSceneDetectionIndex + 5) {
                lastSceneDetectionIndex = segmentCount;
                const recentText = transcriptSegments
                  .slice(-5)
                  .map(s => s.text)
                  .join(' ');
                
                try {
                  const sceneResult = await aiServiceInstance.detectScene(recentText);
                  console.log(`🎭 Scene detected: ${sceneResult.scene} (${Math.round(sceneResult.confidence * 100)}% confidence)`);
                  socket.emit('scene:detected', sceneResult);
                  audioTriggerServiceInstance.handleSceneChange(sceneResult.scene, sceneResult.confidence);
                  
                  // Also notify auto-audio service of scene change for music selection
                  autoAudioServiceInstance.handleSceneChange(
                    sceneResult.scene as 'combat' | 'exploration' | 'social' | 'tense' | 'dramatic' | 'tavern' | 'forest' | 'dungeon' | 'ambient',
                    sceneResult.confidence
                  ).catch(err => console.error('Auto-audio scene change error:', err));
                } catch (error) {
                  console.error('Scene detection error:', error);
                }
              }
              
              // RETROACTIVE speaker attribution every 4 segments
              // Processes the last 16 segments to fix mistakes as more context is available
              if (segmentCount >= lastSpeakerAttributionIndex + 4) {
                lastSpeakerAttributionIndex = segmentCount;
                
                // Get up to 16 recent segments for retroactive correction
                const retroactiveStart = Math.max(0, segmentCount - 16);
                const segmentsToAttribute = transcriptSegments.slice(retroactiveStart, segmentCount);
                
                // Run attribution in background (don't await to avoid blocking transcription)
                aiServiceInstance.attributeSpeakers(segmentsToAttribute)
                  .then(attributed => {
                    // Update ALL processed segments (retroactive)
                    attributed.forEach((attr, i) => {
                      const globalIndex = retroactiveStart + i;
                      const currentSegment = transcriptSegments[globalIndex];
                      
                      // Update if AI provided a meaningful speaker name different from current
                      if (currentSegment && attr.speakerName && 
                          attr.speakerName !== currentSegment.speakerName) {
                        const oldSpeaker = currentSegment.speakerName || currentSegment.speakerLabel;
                        currentSegment.speakerName = attr.speakerName;
                        
                        // Only emit update if it's a meaningful change
                        if (oldSpeaker !== attr.speakerName) {
                          socket.emit('speaker:updated', {
                            segmentId: currentSegment.id,
                            speakerName: attr.speakerName,
                          });
                        }
                      }
                    });
                    
                    // === MERGE CONSECUTIVE SEGMENTS FROM SAME SPEAKER ===
                    // Only merge segments that are "settled" (not the most recent 4, which might still change)
                    const settledEnd = Math.max(0, transcriptSegments.length - 4);
                    if (settledEnd > 1) {
                      mergeConsecutiveSegments(transcriptSegments, 0, settledEnd, socket, mergedSegmentIds);
                    }
                  })
                  .catch(error => {
                    console.error('Speaker attribution error:', error);
                  });
              }
              
              // Health event extraction - only if text likely contains health info
              const healthKeywords = /damage|hit|heal|hp|hit point|unconscious|poison|charm|stun|blind|deaf|prone|restrain|frighten|takes?\s+\d+|loses?\s+\d+|regains?\s+\d+/i;
              if (healthKeywords.test(segment.text)) {
                // Run in background to not block transcription
                aiServiceInstance.extractHealthEvents(segment.text)
                  .then(async (healthEvents) => {
                    for (const event of healthEvents) {
                      // Find the player
                      const player = session.campaign.players.find(
                        p => p.characterName.toLowerCase() === event.characterName.toLowerCase()
                      );
                      
                      if (player) {
                        // Create pending health event
                        const healthEvent = await prisma.healthEvent.create({
                          data: {
                            sessionId: sessionId,
                            playerId: player.id,
                            type: event.type,
                            value: event.value || null,
                            statusEffect: event.statusEffect || null,
                            description: event.description,
                            timestamp: Date.now(),
                            confirmed: false,
                          },
                        });
                        
                        socket.emit('health:event', {
                          id: healthEvent.id,
                          playerId: player.id,
                          type: event.type,
                          value: event.value,
                          description: event.description,
                          confirmed: false,
                        });
                        console.log(`💊 Health event: ${event.characterName} - ${event.type} ${event.value || event.statusEffect}`);
                      }
                    }
                  })
                  .catch(error => {
                    console.error('Health extraction error:', error);
                  });
              }
            }
          );
        } else {
          console.warn('Deepgram API key not configured - transcription disabled');
        }

        // Set up periodic transcript saving (every 30 seconds)
        const saveInterval = setInterval(async () => {
          if (transcriptSegments.length > 0) {
            await saveTranscript(sessionId, transcriptSegments);
          }
        }, 30000);

        // Store session state
        currentSessionState = {
          sessionId,
          campaignId: session.campaignId,
          userId: session.campaign.userId,
          isActive: true,
          startTime: Date.now(),
          transcriptionService,
          transcriptSegments,
          saveInterval,
          aiService: aiServiceInstance,
          audioTriggerService: audioTriggerServiceInstance,
          autoAudioService: autoAudioServiceInstance,
          lastSceneDetectionIndex,
          lastSpeakerAttributionIndex,
          mergedSegmentIds,
        };

        activeSessions.set(socket.id, currentSessionState);

        // Join session room for broadcasts
        socket.join(`session:${sessionId}`);

        socket.emit('session:started', {
          sessionId,
          startTime: currentSessionState.startTime,
        });

        console.log(`Session started: ${sessionId}`);
      } catch (error) {
        console.error('Error starting session:', error);
        socket.emit('error', { message: 'Failed to start session' });
      }
    });

    // Receive audio chunk
    socket.on('audio:chunk', async (data: { audio: ArrayBuffer; timestamp: number }) => {
      if (!currentSessionState?.isActive || !currentSessionState.transcriptionService) {
        return;
      }

      try {
        await currentSessionState.transcriptionService.processAudioChunk(
          Buffer.from(data.audio),
          data.timestamp
        );
      } catch (error) {
        console.error('Error processing audio chunk:', error);
      }
    });

    // Manual speaker attribution
    socket.on('speaker:attribute', async (data: { segmentId: string; speakerName: string }) => {
      if (!currentSessionState?.isActive) {
        return;
      }

      try {
        // Update the segment in the local transcript array
        const segmentIndex = currentSessionState.transcriptSegments.findIndex(
          seg => seg.id === data.segmentId
        );
        
        if (segmentIndex !== -1) {
          currentSessionState.transcriptSegments[segmentIndex] = {
            ...currentSessionState.transcriptSegments[segmentIndex],
            speakerName: data.speakerName,
            isEdited: true,
          };
          
          // Save to database
          await saveTranscript(currentSessionState.sessionId, currentSessionState.transcriptSegments);

          // Broadcast to all clients in the session
          io.to(`session:${currentSessionState.sessionId}`).emit('speaker:updated', {
            segmentId: data.segmentId,
            speakerName: data.speakerName,
          });
        }
      } catch (error) {
        console.error('Error updating speaker attribution:', error);
      }
    });

    // Manual sound trigger - works even without active session for testing
    socket.on('audio:manual-trigger', (data: { mappingId: string }) => {
      console.log('Manual audio trigger:', data.mappingId);
      socket.emit('audio:trigger', {
        mappingId: data.mappingId,
        action: 'play',
        manual: true,
      });
    });

    // Update auto-audio settings
    socket.on('auto-audio:settings', (data: Partial<AutoAudioSettings>) => {
      if (currentSessionState?.autoAudioService) {
        currentSessionState.autoAudioService.updateSettings(data);
        // Echo back the current settings
        socket.emit('auto-audio:settings-updated', currentSessionState.autoAudioService.getSettings());
      }
    });

    // Get current auto-audio settings
    socket.on('auto-audio:get-settings', () => {
      if (currentSessionState?.autoAudioService) {
        const settings = currentSessionState.autoAudioService.getSettings();
        const diagnostics = currentSessionState.autoAudioService.getDiagnostics();
        socket.emit('auto-audio:settings-updated', {
          ...settings,
          apiStatus: diagnostics,
        });
      } else {
        // Send default settings if no session active
        socket.emit('auto-audio:settings-updated', {
          enabled: true,
          effectFrequency: 50,
          musicEnabled: true,
          effectsEnabled: true,
          apiStatus: { freesound: false, jamendo: false },
        });
      }
    });

    // Manually request scene music (for testing or manual override)
    socket.on('auto-audio:set-scene', async (data: { scene: string }) => {
      if (currentSessionState?.autoAudioService) {
        const validScenes = ['combat', 'exploration', 'social', 'tense', 'dramatic', 'tavern', 'forest', 'dungeon', 'ambient'];
        if (validScenes.includes(data.scene)) {
          await currentSessionState.autoAudioService.manualSceneMusic(
            data.scene as 'combat' | 'exploration' | 'social' | 'tense' | 'dramatic' | 'tavern' | 'forest' | 'dungeon' | 'ambient'
          );
        }
      }
    });

    // Report playback failure (so we can skip unplayable tracks)
    socket.on('auto-audio:playback-failed', (data: { trackId: string; source: string; error?: string }) => {
      console.log(`🚫 Playback failed for ${data.trackId} (${data.source}): ${data.error || 'Unknown error'}`);
      
      // Mark Tabletop Audio tracks as unplayable
      if (data.source === 'tabletop') {
        tabletopAudioService.markAsUnplayable(data.trackId);
      }
      
      // If auto-audio is active, try to play a different track
      if (currentSessionState?.autoAudioService) {
        // The auto-audio service will pick a different track next time
        console.log('⏭️ Will select a different track on next scene change');
      }
    });

    // Health event confirmation
    socket.on('health:confirm', async (data: { eventId: string; confirmed: boolean; modifiedValue?: number }) => {
      try {
        const event = await prisma.healthEvent.update({
          where: { id: data.eventId },
          data: {
            confirmed: data.confirmed,
            value: data.modifiedValue,
          },
          include: { player: true },
        });

        if (data.confirmed && event.value !== null) {
          // Apply the health change to the player
          let newHp = event.player.currentHp;
          if (event.type === 'damage') {
            newHp = Math.max(0, event.player.currentHp - event.value);
          } else if (event.type === 'healing') {
            newHp = Math.min(event.player.maxHp, event.player.currentHp + event.value);
          }

          await prisma.player.update({
            where: { id: event.playerId },
            data: { currentHp: newHp },
          });

          socket.emit('player:updated', {
            playerId: event.playerId,
            currentHp: newHp,
          });
        }
      } catch (error) {
        console.error('Error confirming health event:', error);
      }
    });

    // Pause session
    socket.on('session:pause', () => {
      if (currentSessionState) {
        currentSessionState.isActive = false;
        socket.emit('session:paused');
      }
    });

    // Resume session
    socket.on('session:resume', () => {
      if (currentSessionState) {
        currentSessionState.isActive = true;
        socket.emit('session:resumed');
      }
    });

    // End session
    socket.on('session:end', async () => {
      if (!currentSessionState) {
        return;
      }

      try {
        // Clear save interval
        if (currentSessionState.saveInterval) {
          clearInterval(currentSessionState.saveInterval);
        }
        
        // Close transcription service
        if (currentSessionState.transcriptionService) {
          await currentSessionState.transcriptionService.close();
        }

        // Save final transcript
        console.log(`📝 Saving final transcript with ${currentSessionState.transcriptSegments.length} segments`);
        await saveTranscript(currentSessionState.sessionId, currentSessionState.transcriptSegments);

        // Update session status
        await prisma.session.update({
          where: { id: currentSessionState.sessionId },
          data: { status: 'completed' },
        });

        // Generate recap (async, don't wait)
        generateSessionRecap(currentSessionState.sessionId).catch(console.error);

        socket.emit('session:ended', {
          sessionId: currentSessionState.sessionId,
        });

        // Cleanup
        socket.leave(`session:${currentSessionState.sessionId}`);
        activeSessions.delete(socket.id);
        currentSessionState = null;

        console.log('Session ended');
      } catch (error) {
        console.error('Error ending session:', error);
        socket.emit('error', { message: 'Failed to end session' });
      }
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      console.log(`Client disconnected: ${socket.id}`);
      
      if (currentSessionState) {
        // Clear save interval
        if (currentSessionState.saveInterval) {
          clearInterval(currentSessionState.saveInterval);
        }
        
        // Save transcript before disconnecting
        if (currentSessionState.transcriptSegments.length > 0) {
          console.log(`📝 Saving transcript on disconnect: ${currentSessionState.transcriptSegments.length} segments`);
          await saveTranscript(currentSessionState.sessionId, currentSessionState.transcriptSegments);
        }
        
        // Cleanup transcription service
        if (currentSessionState.transcriptionService) {
          await currentSessionState.transcriptionService.close();
        }
        activeSessions.delete(socket.id);
      }
    });
  });
}

async function generateSessionRecap(sessionId: string) {
  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        campaign: {
          include: {
            players: true,
            npcs: true,
          },
        },
      },
    });

    if (!session) return;

    const aiService = new AIService(session.campaign);
    const recap = await aiService.generateRecap(session.transcript as never[]);

    await prisma.session.update({
      where: { id: sessionId },
      data: { recap },
    });

    console.log(`Recap generated for session ${sessionId}`);
  } catch (error) {
    console.error('Error generating recap:', error);
  }
}

