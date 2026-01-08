import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Trash2, Music } from 'lucide-react';
import { useCampaignStore } from '@/stores/campaignStore';
import { api } from '@/services/api';

interface PlayerInput {
  id?: string;
  playerName: string;
  characterName: string;
  characterClass: string;
  characterRace: string;
  maxHp: number;
}

interface NPCInput {
  id?: string;
  name: string;
  description: string;
  speechPatterns: string;
}

export function CampaignSetup() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentCampaign, fetchCampaign, createCampaign, updateCampaign } = useCampaignStore();
  const isEditing = Boolean(id);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [worldContext, setWorldContext] = useState('');
  const [players, setPlayers] = useState<PlayerInput[]>([]);
  const [npcs, setNpcs] = useState<NPCInput[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'players' | 'npcs' | 'audio'>('info');

  useEffect(() => {
    if (id) {
      fetchCampaign(id);
    }
  }, [id, fetchCampaign]);

  useEffect(() => {
    if (isEditing && currentCampaign) {
      setName(currentCampaign.name);
      setDescription(currentCampaign.description || '');
      setWorldContext(currentCampaign.worldContext || '');
      // Load players and NPCs
      loadRelatedData(currentCampaign.id);
    }
  }, [isEditing, currentCampaign]);

  const loadRelatedData = async (campaignId: string) => {
    try {
      const [playersRes, npcsRes] = await Promise.all([
        api.get<PlayerInput[]>(`/players?campaignId=${campaignId}`),
        api.get<NPCInput[]>(`/npcs?campaignId=${campaignId}`),
      ]);
      setPlayers(playersRes.data || []);
      setNpcs(npcsRes.data || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      let campaignId = id;

      if (isEditing && id) {
        await updateCampaign(id, { name, description, worldContext });
      } else {
        const newCampaign = await createCampaign({ name, description, worldContext });
        campaignId = newCampaign.id;
      }

      // Save players
      for (const player of players) {
        if (player.id) {
          await api.patch(`/players/${player.id}`, player);
        } else if (campaignId) {
          await api.post('/players', { ...player, campaignId });
        }
      }

      // Save NPCs
      for (const npc of npcs) {
        if (npc.id) {
          await api.patch(`/npcs/${npc.id}`, npc);
        } else if (campaignId) {
          await api.post('/npcs', { ...npc, campaignId });
        }
      }

      navigate(`/app/campaigns/${campaignId}`);
    } catch (error) {
      console.error('Failed to save campaign:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const addPlayer = () => {
    setPlayers([
      ...players,
      {
        playerName: '',
        characterName: '',
        characterClass: '',
        characterRace: '',
        maxHp: 10,
      },
    ]);
  };

  const updatePlayer = (index: number, field: keyof PlayerInput, value: string | number) => {
    const updated = [...players];
    updated[index] = { ...updated[index], [field]: value };
    setPlayers(updated);
  };

  const removePlayer = (index: number) => {
    setPlayers(players.filter((_, i) => i !== index));
  };

  const addNPC = () => {
    setNpcs([
      ...npcs,
      {
        name: '',
        description: '',
        speechPatterns: '',
      },
    ]);
  };

  const updateNPC = (index: number, field: keyof NPCInput, value: string) => {
    const updated = [...npcs];
    updated[index] = { ...updated[index], [field]: value };
    setNpcs(updated);
  };

  const removeNPC = (index: number) => {
    setNpcs(npcs.filter((_, i) => i !== index));
  };

  const tabs = [
    { id: 'info', label: 'Campaign Info' },
    { id: 'players', label: 'Players', count: players.length },
    { id: 'npcs', label: 'NPCs', count: npcs.length },
    { id: 'audio', label: 'Audio' },
  ] as const;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link
          to={isEditing ? `/app/campaigns/${id}` : '/app'}
          className="inline-flex items-center text-dungeon-400 hover:text-parchment-200 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {isEditing ? 'Back to Campaign' : 'Back to Dashboard'}
        </Link>
        <h1 className="font-display text-3xl font-bold">
          {isEditing ? 'Edit Campaign' : 'New Campaign'}
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 border-b border-dungeon-700/50">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 font-display text-sm transition-colors relative
              ${activeTab === tab.id
                ? 'text-mystic-400'
                : 'text-dungeon-400 hover:text-parchment-200'
              }
            `}
          >
            {tab.label}
            {'count' in tab && tab.count > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-dungeon-700 rounded-full text-xs">
                {tab.count}
              </span>
            )}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-mystic-500" />
            )}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        {/* Campaign Info Tab */}
        {activeTab === 'info' && (
          <div className="space-y-6">
            <div>
              <label className="input-label">Campaign Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Curse of Strahd"
                className="input"
                required
              />
            </div>

            <div>
              <label className="input-label">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A brief description of your campaign..."
                className="input min-h-[100px] resize-y"
                rows={3}
              />
            </div>

            <div>
              <label className="input-label">World Context</label>
              <p className="text-sm text-dungeon-400 mb-2">
                Provide details about your world, setting, and lore. This helps the AI
                understand context for speaker identification and scene detection.
              </p>
              <textarea
                value={worldContext}
                onChange={(e) => setWorldContext(e.target.value)}
                placeholder="The campaign takes place in the realm of..."
                className="input min-h-[200px] resize-y font-mono text-sm"
                rows={8}
              />
            </div>
          </div>
        )}

        {/* Players Tab */}
        {activeTab === 'players' && (
          <div className="space-y-6">
            <p className="text-dungeon-300">
              Add your players and their characters. This information helps the AI
              identify who is speaking during sessions.
            </p>

            {players.map((player, index) => (
              <div key={index} className="card">
                <div className="card-header flex items-center justify-between">
                  <h3 className="font-display font-semibold">
                    Player {index + 1}
                  </h3>
                  <button
                    type="button"
                    onClick={() => removePlayer(index)}
                    className="text-dragon-400 hover:text-dragon-300"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="card-body grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="input-label">Player Name</label>
                    <input
                      type="text"
                      value={player.playerName}
                      onChange={(e) => updatePlayer(index, 'playerName', e.target.value)}
                      placeholder="John"
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="input-label">Character Name</label>
                    <input
                      type="text"
                      value={player.characterName}
                      onChange={(e) => updatePlayer(index, 'characterName', e.target.value)}
                      placeholder="Thorin Ironforge"
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="input-label">Race</label>
                    <input
                      type="text"
                      value={player.characterRace}
                      onChange={(e) => updatePlayer(index, 'characterRace', e.target.value)}
                      placeholder="Dwarf"
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="input-label">Class</label>
                    <input
                      type="text"
                      value={player.characterClass}
                      onChange={(e) => updatePlayer(index, 'characterClass', e.target.value)}
                      placeholder="Fighter"
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="input-label">Max HP</label>
                    <input
                      type="number"
                      value={player.maxHp}
                      onChange={(e) => updatePlayer(index, 'maxHp', parseInt(e.target.value) || 10)}
                      min={1}
                      className="input"
                    />
                  </div>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addPlayer}
              className="btn-secondary w-full flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Player
            </button>
          </div>
        )}

        {/* NPCs Tab */}
        {activeTab === 'npcs' && (
          <div className="space-y-6">
            <p className="text-dungeon-300">
              Add important NPCs that appear in your campaign. Include their speech
              patterns to help the AI recognize when you're roleplaying as them.
            </p>

            {npcs.map((npc, index) => (
              <div key={index} className="card">
                <div className="card-header flex items-center justify-between">
                  <h3 className="font-display font-semibold">
                    {npc.name || `NPC ${index + 1}`}
                  </h3>
                  <button
                    type="button"
                    onClick={() => removeNPC(index)}
                    className="text-dragon-400 hover:text-dragon-300"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="card-body space-y-4">
                  <div>
                    <label className="input-label">Name</label>
                    <input
                      type="text"
                      value={npc.name}
                      onChange={(e) => updateNPC(index, 'name', e.target.value)}
                      placeholder="Gandalf the Grey"
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="input-label">Description</label>
                    <textarea
                      value={npc.description}
                      onChange={(e) => updateNPC(index, 'description', e.target.value)}
                      placeholder="An ancient wizard who guides the party..."
                      className="input min-h-[80px] resize-y"
                      rows={2}
                    />
                  </div>
                  <div>
                    <label className="input-label">Speech Patterns</label>
                    <p className="text-xs text-dungeon-400 mb-2">
                      Describe how this character speaks (accent, vocabulary, mannerisms)
                    </p>
                    <textarea
                      value={npc.speechPatterns}
                      onChange={(e) => updateNPC(index, 'speechPatterns', e.target.value)}
                      placeholder="Speaks in riddles, often says 'A wizard is never late'"
                      className="input min-h-[60px] resize-y"
                      rows={2}
                    />
                  </div>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addNPC}
              className="btn-secondary w-full flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add NPC
            </button>
          </div>
        )}

        {/* Audio Tab */}
        {activeTab === 'audio' && (
          <div className="space-y-6">
            <p className="text-dungeon-300">
              Configure sound triggers for your campaign. Set up keywords that
              automatically play music or sound effects.
            </p>

            <div className="card">
              <div className="card-body text-center py-12">
                <Music className="w-12 h-12 text-dungeon-500 mx-auto mb-4" />
                <h3 className="font-display text-xl mb-2">Audio Configuration</h3>
                <p className="text-dungeon-400 mb-4">
                  Audio trigger setup will be available after creating the campaign.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Submit */}
        <div className="flex justify-end gap-4 mt-8 pt-8 border-t border-dungeon-700/50">
          <Link
            to={isEditing ? `/app/campaigns/${id}` : '/app'}
            className="btn-secondary"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSaving || !name}
            className="btn-primary flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Campaign'}
          </button>
        </div>
      </form>
    </div>
  );
}

