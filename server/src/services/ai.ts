import OpenAI from 'openai';
import { config } from '../config.js';
import type { Campaign, Player, NPC } from '@prisma/client';
import type { TranscriptSegment } from './transcription.js';

type CampaignWithRelations = Campaign & {
  players: Player[];
  npcs: NPC[];
};

export class AIService {
  private openai: OpenAI;
  private campaign: CampaignWithRelations;
  private knownNames: string[];
  private nameCorrections: Map<string, string> = new Map();

  constructor(campaign: CampaignWithRelations) {
    this.openai = new OpenAI({ apiKey: config.openaiApiKey });
    this.campaign = campaign;
    
    // Build list of known names for correction
    this.knownNames = [
      ...campaign.players.map(p => p.characterName),
      ...campaign.players.map(p => p.playerName),
      ...campaign.npcs.map(n => n.name),
      campaign.name,
    ].filter(Boolean) as string[];
    
    console.log('📚 Known names for correction:', this.knownNames.join(', '));
  }

  /**
   * Quick local correction for cached name fixes (instant, no API)
   */
  correctTranscriptText(text: string): string {
    let corrected = text;
    
    // Apply cached corrections
    for (const [wrong, right] of this.nameCorrections) {
      const regex = new RegExp(`\\b${this.escapeRegex(wrong)}\\b`, 'gi');
      corrected = corrected.replace(regex, right);
    }
    
    return corrected;
  }

  /**
   * AI-powered aggressive transcript correction
   * Fixes names, terms, and interprets what the speaker likely meant
   */
  async correctTranscriptWithAI(text: string, recentContext: string = ''): Promise<string> {
    if (!text.trim()) return text;
    
    const namesContext = `
KNOWN NAMES IN THIS CAMPAIGN (use ONLY these, never invent names):
- Player Characters: ${this.campaign.players.map(p => `${p.characterName} (played by ${p.playerName})`).join(', ')}
- NPCs: ${this.campaign.npcs.map(n => n.name).join(', ')}
- Campaign: ${this.campaign.name}
- Locations/Terms from world context: ${this.campaign.worldContext || 'None specified'}
`;

    const prompt = `You are a transcript editor for a D&D session. Fix this audio transcription based on context.

${namesContext}

RULES:
1. Fix misspelled/misheard character names, NPC names, and location names to match the KNOWN NAMES above
2. NEVER invent new names - only use names from the list above
3. Fix obvious speech-to-text errors (e.g., "roll for initiative" not "role for initiative")
4. Fix D&D terminology (e.g., "armor class" not "armor clash", "hit points" not "hit prince")
5. Keep the meaning and tone identical - only fix errors
6. If a word sounds like a known name, replace it with that name
7. Return ONLY the corrected text, nothing else
8. CRITICAL: Output ONLY the corrected version of "TRANSCRIPTION TO FIX". Do NOT include ANY text from "RECENT CONTEXT" in your output.
9. Your output length should be similar to the input length. Never return dramatically longer text.

${recentContext ? `RECENT CONTEXT (for reference only, DO NOT include this in output):\n${recentContext}\n\n` : ''}
TRANSCRIPTION TO FIX (correct ONLY this text):
${text}

Output ONLY the corrected version of the above text, nothing else:`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are a transcript editor. Output ONLY the corrected text, no quotes, no explanation. Keep corrections minimal - only fix clear errors.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 200,
      });

      let corrected = response.choices[0]?.message?.content?.trim();
      
      if (corrected) {
        // Strip any surrounding quotes the AI might have added
        corrected = corrected.replace(/^["']+|["']+$/g, '').trim();
        
        if (corrected && corrected !== text) {
          // SANITY CHECK: Reject corrections that are dramatically longer than original
          // This prevents the AI from including context in its output
          const originalLength = text.length;
          const correctedLength = corrected.length;
          const maxAllowedLength = Math.max(originalLength * 3, originalLength + 50);
          
          if (correctedLength > maxAllowedLength) {
            console.log(`⚠️ AI correction rejected (too long): ${originalLength} chars -> ${correctedLength} chars`);
            return text;
          }
          
          // Cache any name corrections we can detect
          this.learnCorrections(text, corrected);
          console.log(`✏️ AI corrected: "${text}" -> "${corrected}"`);
          return corrected;
        }
      }
      
      return text;
    } catch (error) {
      console.error('AI correction error:', error);
      return text;
    }
  }

  /**
   * Learn corrections from AI fixes to apply them instantly in the future
   */
  private learnCorrections(original: string, corrected: string): void {
    const origWords = original.split(/\s+/);
    const corrWords = corrected.split(/\s+/);
    
    // Simple word-by-word comparison to find corrections
    if (origWords.length === corrWords.length) {
      for (let i = 0; i < origWords.length; i++) {
        const orig = origWords[i].replace(/[.,!?;:]/g, '');
        const corr = corrWords[i].replace(/[.,!?;:]/g, '');
        
        if (orig.toLowerCase() !== corr.toLowerCase() && corr.length > 2) {
          // Check if the correction is a known name
          if (this.knownNames.some(n => n.toLowerCase() === corr.toLowerCase())) {
            this.nameCorrections.set(orig.toLowerCase(), corr);
            console.log(`📚 Learned correction: "${orig}" -> "${corr}"`);
          }
        }
      }
    }
  }
  
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Attribute speakers to transcript segments based on context
   * This runs retroactively on recent segments to correct mistakes as more context is available
   */
  async attributeSpeakers(segments: TranscriptSegment[]): Promise<TranscriptSegment[]> {
    if (segments.length === 0) return segments;

    const context = this.buildCampaignContext();
    
    // Include current attributions so AI can see and correct them
    const segmentsText = segments
      .map((s, i) => `[${i}] ${s.speakerName || s.speakerLabel}: "${s.text}"`)
      .join('\n');

    const prompt = `You are RETROACTIVELY reviewing and correcting speaker attributions for a D&D session transcript.

${context}

CRITICAL RULES FOR SPEAKER IDENTIFICATION:
1. **DM speaks in THIRD PERSON**: "You see a dark cave", "The goblin attacks", "What do you do?", "Roll perception"
2. **Players speak in FIRST PERSON**: "I cast fireball", "I'm going to sneak", "I want to talk to him"
3. **DM as NPC**: When DM voices an NPC directly, use "DM (as NPCName)"
4. **Consistency**: If a speaker pattern is established, maintain it. Same speaking style = same speaker.
5. **Context clues**: 
   - Mentions of "you" (plural) = DM addressing party
   - Mentions specific character by name = likely DM or another player
   - First person singular ("I") = player character action

CURRENT TRANSCRIPT (some attributions may be wrong - CORRECT THEM):
${segmentsText}

Review ALL segments and provide CORRECTED attributions. Fix any mistakes you see.
Be especially careful to distinguish DM narration from player actions.

Respond with JSON:
{
  "speakers": [
    {"index": 0, "speaker": "DM", "reasoning": "Third person narration"},
    {"index": 1, "speaker": "PlayerName", "reasoning": "First person action"}
  ]
}`;

    try {
      console.log('🤖 Running retroactive speaker attribution for', segments.length, 'segments...');
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: `You are an expert D&D transcript analyzer. Your job is to CORRECTLY identify who is speaking each line.
            
KEY DISTINCTION:
- DM: Describes scenes, narrates events, speaks AS NPCs, asks "what do you do?", calls for rolls
- Players: Speak in FIRST PERSON about THEIR character's actions ("I cast...", "I attack...")

The available speakers are: DM, ${this.campaign.players.map(p => p.playerName).join(', ')}

ALWAYS attribute every line. When uncertain, DM is more likely for narrative/descriptive text, players for first-person actions.`,
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1, // Lower temperature for more consistent results
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      
      if (!content) {
        console.warn('🤖 No content in AI response');
        return segments;
      }

      const parsed = JSON.parse(content);
      const attributionArray = parsed.speakers || parsed.attributions || [];
      
      // Log changes
      let changesCount = 0;
      const results = segments.map((segment, index) => {
        const attribution = attributionArray.find((a: { index: number }) => a.index === index);
        const newSpeaker = attribution?.speaker || null;
        const oldSpeaker = segment.speakerName || segment.speakerLabel;
        
        if (newSpeaker && newSpeaker !== oldSpeaker) {
          console.log(`🎤 [${index}] "${segment.text.substring(0, 35)}..." : ${oldSpeaker} -> ${newSpeaker}`);
          changesCount++;
        }
        
        return {
          ...segment,
          speakerName: newSpeaker || segment.speakerName || segment.speakerLabel,
        };
      });
      
      console.log(`🤖 Attribution complete: ${changesCount} changes made`);
      return results;
    } catch (error) {
      console.error('Error attributing speakers:', error);
      return segments;
    }
  }

  /**
   * Detect scene type from recent transcript
   */
  async detectScene(recentText: string): Promise<{
    scene: string;
    confidence: number;
  }> {
    const prompt = `Analyze this D&D session dialogue and determine the current scene type.

Dialogue:
${recentText}

Scene types:
- combat: Battle, fighting, initiative rolls
- exploration: Investigating, traveling, discovering
- social: Conversation, negotiation, roleplay
- tense: Suspenseful moments, danger nearby
- dramatic: Important story moments, revelations
- tavern: Casual social setting, rest
- forest: Outdoor wilderness
- dungeon: Underground, dark places
- ambient: General background, transitions

Respond with JSON: { "scene": "type", "confidence": 0.0-1.0 }`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) return { scene: 'ambient', confidence: 0.5 };

      return JSON.parse(content);
    } catch (error) {
      console.error('Error detecting scene:', error);
      return { scene: 'ambient', confidence: 0.5 };
    }
  }

  /**
   * Extract health events from transcript text
   */
  async extractHealthEvents(text: string): Promise<Array<{
    characterName: string;
    type: 'damage' | 'healing' | 'status';
    value?: number;
    statusEffect?: string;
    description: string;
  }>> {
    const playerNames = this.campaign.players.map(p => p.characterName);
    
    const prompt = `Analyze this D&D session dialogue and extract any health-related events.

Known characters: ${playerNames.join(', ')}

Dialogue:
${text}

Look for:
- Damage taken (e.g., "takes 15 damage", "loses 8 HP", "is hit for 12")
- Healing (e.g., "heals for 10", "regains 5 hit points")
- Status effects (e.g., "is poisoned", "falls unconscious", "is charmed")

Respond with JSON array of events:
[{
  "characterName": "name",
  "type": "damage" | "healing" | "status",
  "value": number (for damage/healing),
  "statusEffect": "effect name" (for status),
  "description": "brief description"
}]

If no health events found, return empty array: []`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) return [];

      const result = JSON.parse(content);
      return Array.isArray(result) ? result : result.events || [];
    } catch (error) {
      console.error('Error extracting health events:', error);
      return [];
    }
  }

  /**
   * Generate a session recap
   */
  async generateRecap(transcript: TranscriptSegment[]): Promise<string> {
    const transcriptText = transcript
      .map(s => `${s.speakerName || s.speakerLabel}: ${s.text}`)
      .join('\n');

    const prompt = `Generate a narrative recap of this D&D session for the "Previously on..." segment.

Campaign: ${this.campaign.name}
${this.campaign.description || ''}

Session Transcript:
${transcriptText}

Write a compelling 2-3 paragraph recap that:
1. Summarizes key events and decisions
2. Highlights memorable moments and character interactions
3. Ends with a hook about what's next or what was left unresolved
4. Uses dramatic, narrative language suitable for reading aloud

Keep it under 300 words.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are a skilled narrator who creates engaging recaps of D&D sessions.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      return response.choices[0]?.message?.content || 'Unable to generate recap.';
    } catch (error) {
      console.error('Error generating recap:', error);
      return 'Unable to generate recap due to an error.';
    }
  }

  private buildCampaignContext(): string {
    const players = this.campaign.players
      .map(p => `- ${p.playerName} plays ${p.characterName} (${p.characterRace || 'Unknown race'} ${p.characterClass || 'Unknown class'})`)
      .join('\n');

    const npcs = this.campaign.npcs
      .map(n => `- ${n.name}: ${n.description || 'No description'}${n.speechPatterns ? ` (speaks: ${n.speechPatterns})` : ''}`)
      .join('\n');

    return `CAMPAIGN CONTEXT:
Campaign: ${this.campaign.name}
${this.campaign.description ? `Description: ${this.campaign.description}` : ''}
${this.campaign.worldContext ? `World: ${this.campaign.worldContext}` : ''}

PLAYERS:
${players || 'No players defined'}

NPCs (all played by DM):
${npcs || 'No NPCs defined'}`;
  }
}

