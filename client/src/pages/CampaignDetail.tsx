import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Play,
  Settings,
  Users,
  Scroll,
  Trash2,
  Plus,
  Edit2,
  UserPlus,
  X,
} from 'lucide-react';
import { useCampaignStore } from '@/stores/campaignStore';
import { api } from '@/services/api';

interface Player {
  id: string;
  playerName: string;
  characterName: string;
  characterClass: string | null;
  characterRace: string | null;
  maxHp: number;
  currentHp: number;
  notes?: string | null;
}

interface Session {
  id: string;
  sessionNumber: number;
  title: string | null;
  date: string;
  status: 'draft' | 'in_progress' | 'completed';
}

interface NPC {
  id: string;
  name: string;
  description: string | null;
  speechPatterns?: string | null;
}

export function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentCampaign, fetchCampaign, deleteCampaign, isLoading } = useCampaignStore();
  
  const [players, setPlayers] = useState<Player[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [npcs, setNpcs] = useState<NPC[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Modal states
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [showNpcModal, setShowNpcModal] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [editingNpc, setEditingNpc] = useState<NPC | null>(null);
  
  // Form states
  const [playerForm, setPlayerForm] = useState({
    playerName: '',
    characterName: '',
    characterClass: '',
    characterRace: '',
    maxHp: 10,
    currentHp: 10,
    notes: '',
  });
  const [npcForm, setNpcForm] = useState({
    name: '',
    description: '',
    speechPatterns: '',
  });

  useEffect(() => {
    if (id) {
      fetchCampaign(id);
      loadRelatedData(id);
    }
  }, [id, fetchCampaign]);

  const loadRelatedData = async (campaignId: string) => {
    try {
      const [playersRes, sessionsRes, npcsRes] = await Promise.all([
        api.get<Player[]>(`/players?campaignId=${campaignId}`),
        api.get<Session[]>(`/sessions?campaignId=${campaignId}`),
        api.get<NPC[]>(`/npcs?campaignId=${campaignId}`),
      ]);
      
      setPlayers(playersRes.data || []);
      setSessions(sessionsRes.data || []);
      setNpcs(npcsRes.data || []);
    } catch (error) {
      console.error('Failed to load related data:', error);
    }
  };

  const handleDelete = async () => {
    if (id) {
      await deleteCampaign(id);
      navigate('/app');
    }
  };

  const handleStartSession = async () => {
    if (!id) return;
    
    try {
      const response = await api.post<Session>('/sessions', { campaignId: id });
      if (response.data) {
        navigate(`/app/campaigns/${id}/live/${response.data.id}`);
      }
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  };

  const getHealthPercentage = (current: number, max: number) => {
    return Math.round((current / max) * 100);
  };

  const getHealthStatus = (current: number, max: number) => {
    const percentage = getHealthPercentage(current, max);
    if (percentage > 50) return 'healthy';
    if (percentage > 25) return 'injured';
    return 'critical';
  };

  // Player CRUD
  const openAddPlayer = () => {
    setEditingPlayer(null);
    setPlayerForm({
      playerName: '',
      characterName: '',
      characterClass: '',
      characterRace: '',
      maxHp: 10,
      currentHp: 10,
      notes: '',
    });
    setShowPlayerModal(true);
  };

  const openEditPlayer = (player: Player) => {
    setEditingPlayer(player);
    setPlayerForm({
      playerName: player.playerName,
      characterName: player.characterName,
      characterClass: player.characterClass || '',
      characterRace: player.characterRace || '',
      maxHp: player.maxHp,
      currentHp: player.currentHp,
      notes: player.notes || '',
    });
    setShowPlayerModal(true);
  };

  const handleSavePlayer = async () => {
    if (!id) return;
    
    try {
      if (editingPlayer) {
        // Update existing player
        await api.put(`/players/${editingPlayer.id}`, playerForm);
      } else {
        // Create new player
        await api.post('/players', { ...playerForm, campaignId: id });
      }
      await loadRelatedData(id);
      setShowPlayerModal(false);
    } catch (error) {
      console.error('Failed to save player:', error);
    }
  };

  const handleDeletePlayer = async (playerId: string) => {
    if (!id) return;
    
    try {
      await api.delete(`/players/${playerId}`);
      await loadRelatedData(id);
    } catch (error) {
      console.error('Failed to delete player:', error);
    }
  };

  // NPC CRUD
  const openAddNpc = () => {
    setEditingNpc(null);
    setNpcForm({
      name: '',
      description: '',
      speechPatterns: '',
    });
    setShowNpcModal(true);
  };

  const openEditNpc = (npc: NPC) => {
    setEditingNpc(npc);
    setNpcForm({
      name: npc.name,
      description: npc.description || '',
      speechPatterns: npc.speechPatterns || '',
    });
    setShowNpcModal(true);
  };

  const handleSaveNpc = async () => {
    if (!id) return;
    
    try {
      if (editingNpc) {
        // Update existing NPC
        await api.put(`/npcs/${editingNpc.id}`, npcForm);
      } else {
        // Create new NPC
        await api.post('/npcs', { ...npcForm, campaignId: id });
      }
      await loadRelatedData(id);
      setShowNpcModal(false);
    } catch (error) {
      console.error('Failed to save NPC:', error);
    }
  };

  const handleDeleteNpc = async (npcId: string) => {
    if (!id) return;
    
    try {
      await api.delete(`/npcs/${npcId}`);
      await loadRelatedData(id);
    } catch (error) {
      console.error('Failed to delete NPC:', error);
    }
  };

  if (isLoading || !currentCampaign) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-dungeon-700 rounded w-1/3 mb-4" />
          <div className="h-4 bg-dungeon-700 rounded w-1/2" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <Link
            to="/app"
            className="inline-flex items-center text-dungeon-400 hover:text-parchment-200 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Link>
          <h1 className="font-display text-3xl font-bold mb-2">
            {currentCampaign.name}
          </h1>
          {currentCampaign.description && (
            <p className="text-dungeon-300 max-w-2xl">
              {currentCampaign.description}
            </p>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          <Link
            to={`/app/campaigns/${id}/edit`}
            className="btn-secondary flex items-center gap-2"
          >
            <Settings className="w-4 h-4" />
            Edit
          </Link>
          <button
            onClick={handleStartSession}
            className="btn-primary flex items-center gap-2"
          >
            <Play className="w-4 h-4" />
            Start Session
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Sessions */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl font-semibold flex items-center gap-2">
                <Scroll className="w-5 h-5 text-mystic-400" />
                Sessions
              </h2>
              <button 
                onClick={handleStartSession}
                className="btn-ghost text-sm flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                New Session
              </button>
            </div>

            {sessions.length === 0 ? (
              <div className="card">
                <div className="card-body text-center py-8">
                  <p className="text-dungeon-400 mb-4">No sessions yet</p>
                  <button onClick={handleStartSession} className="btn-primary">
                    Start First Session
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {sessions.map((session) => (
                  <Link
                    key={session.id}
                    to={
                      session.status === 'in_progress'
                        ? `/app/campaigns/${id}/live/${session.id}`
                        : `/app/campaigns/${id}/sessions/${session.id}`
                    }
                    className="card hover:border-mystic-500/30 transition-colors block"
                  >
                    <div className="card-body flex items-center justify-between">
                      <div>
                        <h3 className="font-display font-semibold">
                          Session {session.sessionNumber}
                          {session.title && `: ${session.title}`}
                        </h3>
                        <p className="text-sm text-dungeon-400">
                          {new Date(session.date).toLocaleDateString()}
                        </p>
                      </div>
                      <span
                        className={`badge ${
                          session.status === 'completed'
                            ? 'badge-success'
                            : session.status === 'in_progress'
                            ? 'badge-dragon'
                            : 'badge-mystic'
                        }`}
                      >
                        {session.status.replace('_', ' ')}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* World Context */}
          {currentCampaign.worldContext && (
            <section>
              <h2 className="font-display text-xl font-semibold mb-4">
                World Context
              </h2>
              <div className="card">
                <div className="card-body">
                  <p className="text-dungeon-300 whitespace-pre-wrap">
                    {currentCampaign.worldContext}
                  </p>
                </div>
              </div>
            </section>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-8">
          {/* Players */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-semibold flex items-center gap-2">
                <Users className="w-5 h-5 text-mystic-400" />
                Players ({players.length})
              </h2>
              <button onClick={openAddPlayer} className="btn-ghost text-sm p-1" title="Add Player">
                <UserPlus className="w-4 h-4" />
              </button>
            </div>

            <div className="card">
              <div className="divide-y divide-dungeon-700/50">
                {players.length === 0 ? (
                  <div className="p-4 text-center text-dungeon-400">
                    No players added
                  </div>
                ) : (
                  players.map((player) => (
                    <div key={player.id} className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-semibold">{player.characterName}</h4>
                          <p className="text-sm text-dungeon-400">
                            {player.playerName} • {player.characterRace}{' '}
                            {player.characterClass}
                          </p>
                        </div>
                        <button 
                          onClick={() => openEditPlayer(player)}
                          className="text-dungeon-500 hover:text-parchment-200"
                          title="Edit Player"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="health-bar">
                        <div
                          className={`health-bar-fill ${getHealthStatus(
                            player.currentHp,
                            player.maxHp
                          )}`}
                          style={{
                            width: `${getHealthPercentage(
                              player.currentHp,
                              player.maxHp
                            )}%`,
                          }}
                        />
                      </div>
                      <p className="text-xs text-dungeon-400 mt-1">
                        HP: {player.currentHp} / {player.maxHp}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          {/* NPCs */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-semibold flex items-center gap-2">
                <Users className="w-5 h-5 text-parchment-400" />
                NPCs ({npcs.length})
              </h2>
              <button onClick={openAddNpc} className="btn-ghost text-sm p-1" title="Add NPC">
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="card">
              <div className="divide-y divide-dungeon-700/50">
                {npcs.length === 0 ? (
                  <div className="p-4 text-center text-dungeon-400">
                    No NPCs added
                  </div>
                ) : (
                  npcs.map((npc) => (
                    <div key={npc.id} className="p-4 group">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold">{npc.name}</h4>
                          {npc.description && (
                            <p className="text-sm text-dungeon-400 line-clamp-2">
                              {npc.description}
                            </p>
                          )}
                        </div>
                        <button 
                          onClick={() => openEditNpc(npc)}
                          className="text-dungeon-500 hover:text-parchment-200 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Edit NPC"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          {/* Danger Zone */}
          <section>
            <h2 className="font-display text-lg font-semibold text-dragon-400 mb-4">
              Danger Zone
            </h2>
            <div className="card border-dragon-900/50">
              <div className="card-body">
                <p className="text-sm text-dungeon-400 mb-4">
                  Permanently delete this campaign and all its data.
                </p>
                {showDeleteConfirm ? (
                  <div className="space-y-2">
                    <p className="text-sm text-dragon-400">Are you sure?</p>
                    <div className="flex gap-2">
                      <button onClick={handleDelete} className="btn-danger flex-1">
                        Delete
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className="btn-secondary flex-1"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="btn-danger w-full flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Campaign
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Player Modal */}
      {showPlayerModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-dungeon-900 border border-dungeon-700 rounded-lg w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-dungeon-700">
              <h3 className="font-display text-lg font-semibold">
                {editingPlayer ? 'Edit Player' : 'Add Player'}
              </h3>
              <button 
                onClick={() => setShowPlayerModal(false)}
                className="text-dungeon-400 hover:text-parchment-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-dungeon-400 mb-1">Player Name</label>
                  <input
                    type="text"
                    value={playerForm.playerName}
                    onChange={(e) => setPlayerForm({ ...playerForm, playerName: e.target.value })}
                    className="input w-full"
                    placeholder="John"
                  />
                </div>
                <div>
                  <label className="block text-sm text-dungeon-400 mb-1">Character Name</label>
                  <input
                    type="text"
                    value={playerForm.characterName}
                    onChange={(e) => setPlayerForm({ ...playerForm, characterName: e.target.value })}
                    className="input w-full"
                    placeholder="Gandalf"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-dungeon-400 mb-1">Race</label>
                  <input
                    type="text"
                    value={playerForm.characterRace}
                    onChange={(e) => setPlayerForm({ ...playerForm, characterRace: e.target.value })}
                    className="input w-full"
                    placeholder="Human"
                  />
                </div>
                <div>
                  <label className="block text-sm text-dungeon-400 mb-1">Class</label>
                  <input
                    type="text"
                    value={playerForm.characterClass}
                    onChange={(e) => setPlayerForm({ ...playerForm, characterClass: e.target.value })}
                    className="input w-full"
                    placeholder="Wizard"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-dungeon-400 mb-1">Max HP</label>
                  <input
                    type="number"
                    value={playerForm.maxHp}
                    onChange={(e) => setPlayerForm({ ...playerForm, maxHp: parseInt(e.target.value) || 0 })}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm text-dungeon-400 mb-1">Current HP</label>
                  <input
                    type="number"
                    value={playerForm.currentHp}
                    onChange={(e) => setPlayerForm({ ...playerForm, currentHp: parseInt(e.target.value) || 0 })}
                    className="input w-full"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-dungeon-400 mb-1">Notes</label>
                <textarea
                  value={playerForm.notes}
                  onChange={(e) => setPlayerForm({ ...playerForm, notes: e.target.value })}
                  className="input w-full h-20 resize-none"
                  placeholder="Character background, special items, etc."
                />
              </div>
            </div>
            <div className="flex items-center justify-between p-4 border-t border-dungeon-700">
              {editingPlayer && (
                <button 
                  onClick={() => {
                    handleDeletePlayer(editingPlayer.id);
                    setShowPlayerModal(false);
                  }}
                  className="btn-danger"
                >
                  Delete
                </button>
              )}
              <div className={`flex gap-2 ${!editingPlayer ? 'ml-auto' : ''}`}>
                <button onClick={() => setShowPlayerModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button onClick={handleSavePlayer} className="btn-primary">
                  {editingPlayer ? 'Save Changes' : 'Add Player'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NPC Modal */}
      {showNpcModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-dungeon-900 border border-dungeon-700 rounded-lg w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-dungeon-700">
              <h3 className="font-display text-lg font-semibold">
                {editingNpc ? 'Edit NPC' : 'Add NPC'}
              </h3>
              <button 
                onClick={() => setShowNpcModal(false)}
                className="text-dungeon-400 hover:text-parchment-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm text-dungeon-400 mb-1">Name</label>
                <input
                  type="text"
                  value={npcForm.name}
                  onChange={(e) => setNpcForm({ ...npcForm, name: e.target.value })}
                  className="input w-full"
                  placeholder="Lord Blackthorn"
                />
              </div>
              <div>
                <label className="block text-sm text-dungeon-400 mb-1">Description</label>
                <textarea
                  value={npcForm.description}
                  onChange={(e) => setNpcForm({ ...npcForm, description: e.target.value })}
                  className="input w-full h-24 resize-none"
                  placeholder="A mysterious noble with a dark past..."
                />
              </div>
              <div>
                <label className="block text-sm text-dungeon-400 mb-1">Speech Patterns</label>
                <textarea
                  value={npcForm.speechPatterns}
                  onChange={(e) => setNpcForm({ ...npcForm, speechPatterns: e.target.value })}
                  className="input w-full h-20 resize-none"
                  placeholder="Speaks formally, often uses 'indeed' and 'quite so'..."
                />
              </div>
            </div>
            <div className="flex items-center justify-between p-4 border-t border-dungeon-700">
              {editingNpc && (
                <button 
                  onClick={() => {
                    handleDeleteNpc(editingNpc.id);
                    setShowNpcModal(false);
                  }}
                  className="btn-danger"
                >
                  Delete
                </button>
              )}
              <div className={`flex gap-2 ${!editingNpc ? 'ml-auto' : ''}`}>
                <button onClick={() => setShowNpcModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button onClick={handleSaveNpc} className="btn-primary">
                  {editingNpc ? 'Save Changes' : 'Add NPC'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

