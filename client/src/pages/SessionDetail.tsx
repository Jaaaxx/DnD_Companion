import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Play,
  Calendar,
  MessageSquare,
  BookOpen,
  Download,
  Edit2,
  Save,
} from 'lucide-react';
import { api } from '@/services/api';

interface TranscriptSegment {
  id: string;
  timestamp: number;
  speakerLabel: string;
  speakerName: string | null;
  text: string;
}

interface Session {
  id: string;
  sessionNumber: number;
  title: string | null;
  date: string;
  status: 'draft' | 'in_progress' | 'completed';
  transcript: TranscriptSegment[];
  notes: string | null;
  recap: string | null;
  campaign: {
    id: string;
    name: string;
  };
}

export function SessionDetail() {
  const { campaignId, sessionId } = useParams<{ campaignId: string; sessionId: string }>();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'transcript' | 'recap' | 'notes'>('transcript');
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (sessionId) {
      loadSession();
    }
  }, [sessionId]);

  const loadSession = async () => {
    try {
      const response = await api.get<Session>(`/sessions/${sessionId}`);
      setSession(response.data || null);
      setNotes(response.data?.notes || '');
    } catch (error) {
      console.error('Failed to load session:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveNotes = async () => {
    if (!sessionId) return;
    setIsSaving(true);
    try {
      await api.patch(`/sessions/${sessionId}`, { notes });
      setIsEditingNotes(false);
    } catch (error) {
      console.error('Failed to save notes:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const formatTimestamp = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const downloadTranscript = () => {
    if (!session) return;

    const text = session.transcript
      .map((s) => `[${formatTimestamp(s.timestamp)}] ${s.speakerName || s.speakerLabel}: ${s.text}`)
      .join('\n\n');

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session-${session.sessionNumber}-transcript.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-dungeon-700 rounded w-1/3 mb-4" />
          <div className="h-4 bg-dungeon-700 rounded w-1/2" />
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="p-8">
        <p className="text-dungeon-400">Session not found</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link
          to={`/app/campaigns/${campaignId}`}
          className="inline-flex items-center text-dungeon-400 hover:text-parchment-200 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to {session.campaign.name}
        </Link>
        
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold mb-2">
              Session {session.sessionNumber}
              {session.title && `: ${session.title}`}
            </h1>
            <div className="flex items-center gap-4 text-dungeon-400">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {new Date(session.date).toLocaleDateString()}
              </span>
              <span className="flex items-center gap-1">
                <MessageSquare className="w-4 h-4" />
                {session.transcript.length} segments
              </span>
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
          </div>

          {session.status === 'in_progress' && (
            <Link
              to={`/app/campaigns/${campaignId}/live/${sessionId}`}
              className="btn-primary flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              Resume Session
            </Link>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-dungeon-700/50">
        <button
          onClick={() => setActiveTab('transcript')}
          className={`px-4 py-3 font-display text-sm transition-colors relative
            ${activeTab === 'transcript' ? 'text-mystic-400' : 'text-dungeon-400 hover:text-parchment-200'}
          `}
        >
          <MessageSquare className="w-4 h-4 inline mr-2" />
          Transcript
          {activeTab === 'transcript' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-mystic-500" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('recap')}
          className={`px-4 py-3 font-display text-sm transition-colors relative
            ${activeTab === 'recap' ? 'text-mystic-400' : 'text-dungeon-400 hover:text-parchment-200'}
          `}
        >
          <BookOpen className="w-4 h-4 inline mr-2" />
          Recap
          {activeTab === 'recap' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-mystic-500" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('notes')}
          className={`px-4 py-3 font-display text-sm transition-colors relative
            ${activeTab === 'notes' ? 'text-mystic-400' : 'text-dungeon-400 hover:text-parchment-200'}
          `}
        >
          <Edit2 className="w-4 h-4 inline mr-2" />
          Notes
          {activeTab === 'notes' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-mystic-500" />
          )}
        </button>
      </div>

      {/* Transcript Tab */}
      {activeTab === 'transcript' && (
        <div>
          <div className="flex justify-end mb-4">
            <button
              onClick={downloadTranscript}
              className="btn-secondary text-sm flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
          </div>

          {session.transcript.length === 0 ? (
            <div className="card">
              <div className="card-body text-center py-12">
                <MessageSquare className="w-12 h-12 text-dungeon-500 mx-auto mb-4" />
                <p className="text-dungeon-400">No transcript available for this session.</p>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-body space-y-4 max-h-[600px] overflow-y-auto scrollbar-thin">
                {session.transcript.map((segment, index) => (
                  <div
                    key={segment.id || index}
                    className={`transcript-segment ${
                      segment.speakerName?.includes('DM')
                        ? 'transcript-segment-dm'
                        : 'transcript-segment-player'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <span className="text-xs text-dungeon-500 font-mono whitespace-nowrap mt-1">
                        {formatTimestamp(segment.timestamp)}
                      </span>
                      <div className="flex-1">
                        <span className="font-semibold text-mystic-400">
                          {segment.speakerName || segment.speakerLabel}
                        </span>
                        <p className="text-parchment-200 mt-1">{segment.text}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recap Tab */}
      {activeTab === 'recap' && (
        <div className="card">
          <div className="card-header">
            <h3 className="font-display text-lg font-semibold">
              Previously on {session.campaign.name}...
            </h3>
          </div>
          <div className="card-body">
            {session.recap ? (
              <div className="prose prose-invert max-w-none">
                <p className="text-parchment-200 whitespace-pre-wrap leading-relaxed italic">
                  {session.recap}
                </p>
              </div>
            ) : (
              <div className="text-center py-8">
                <BookOpen className="w-12 h-12 text-dungeon-500 mx-auto mb-4" />
                <p className="text-dungeon-400">
                  No recap available. Recaps are generated when a session ends.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notes Tab */}
      {activeTab === 'notes' && (
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold">Session Notes</h3>
            {isEditingNotes ? (
              <button
                onClick={saveNotes}
                disabled={isSaving}
                className="btn-primary text-sm flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            ) : (
              <button
                onClick={() => setIsEditingNotes(true)}
                className="btn-secondary text-sm flex items-center gap-2"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </button>
            )}
          </div>
          <div className="card-body">
            {isEditingNotes ? (
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="input min-h-[300px] resize-y font-body"
                placeholder="Add your session notes here..."
              />
            ) : notes ? (
              <p className="text-parchment-200 whitespace-pre-wrap">{notes}</p>
            ) : (
              <div className="text-center py-8">
                <Edit2 className="w-12 h-12 text-dungeon-500 mx-auto mb-4" />
                <p className="text-dungeon-400 mb-4">No notes yet.</p>
                <button
                  onClick={() => setIsEditingNotes(true)}
                  className="btn-primary"
                >
                  Add Notes
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

