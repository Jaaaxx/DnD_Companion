import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { 
  Plus, 
  Scroll, 
  Users, 
  Calendar,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { useCampaignStore } from '@/stores/campaignStore';

export function Dashboard() {
  const { user } = useUser();
  const { campaigns, isLoading, fetchCampaigns } = useCampaignStore();

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  return (
    <div className="p-8">
      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold mb-2">
          Welcome back, {user?.firstName || 'Dungeon Master'}!
        </h1>
        <p className="text-dungeon-300">
          Ready to continue your adventures?
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-3 gap-6 mb-12">
        <Link
          to="/app/campaigns/new"
          className="card group hover:border-mystic-500/50 transition-all duration-300"
        >
          <div className="card-body flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-mystic-600/20 flex items-center justify-center group-hover:bg-mystic-600/30 transition-colors">
              <Plus className="w-6 h-6 text-mystic-400" />
            </div>
            <div>
              <h3 className="font-display font-semibold">New Campaign</h3>
              <p className="text-sm text-dungeon-400">Start a new adventure</p>
            </div>
            <ArrowRight className="w-5 h-5 text-dungeon-500 ml-auto group-hover:text-mystic-400 transition-colors" />
          </div>
        </Link>

        {campaigns.length > 0 && (
          <Link
            to={`/app/campaigns/${campaigns[0].id}/live`}
            className="card group hover:border-dragon-500/50 transition-all duration-300"
          >
            <div className="card-body flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-dragon-600/20 flex items-center justify-center group-hover:bg-dragon-600/30 transition-colors">
                <Sparkles className="w-6 h-6 text-dragon-400" />
              </div>
              <div>
                <h3 className="font-display font-semibold">Quick Start</h3>
                <p className="text-sm text-dungeon-400">Resume {campaigns[0].name}</p>
              </div>
              <ArrowRight className="w-5 h-5 text-dungeon-500 ml-auto group-hover:text-dragon-400 transition-colors" />
            </div>
          </Link>
        )}
      </div>

      {/* Campaigns List */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-2xl font-semibold">Your Campaigns</h2>
          <Link to="/app/campaigns/new" className="btn-secondary text-sm">
            <Plus className="w-4 h-4 mr-2" />
            New Campaign
          </Link>
        </div>

        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card animate-pulse">
                <div className="card-body">
                  <div className="h-6 bg-dungeon-700 rounded w-3/4 mb-4" />
                  <div className="h-4 bg-dungeon-700 rounded w-1/2 mb-2" />
                  <div className="h-4 bg-dungeon-700 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <div className="card">
            <div className="card-body text-center py-12">
              <Scroll className="w-12 h-12 text-dungeon-500 mx-auto mb-4" />
              <h3 className="font-display text-xl font-semibold mb-2">
                No Campaigns Yet
              </h3>
              <p className="text-dungeon-400 mb-6">
                Create your first campaign to start tracking your adventures.
              </p>
              <Link to="/app/campaigns/new" className="btn-primary inline-flex items-center">
                <Plus className="w-4 h-4 mr-2" />
                Create Campaign
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {campaigns.map((campaign) => (
              <Link
                key={campaign.id}
                to={`/app/campaigns/${campaign.id}`}
                className="card group hover:border-mystic-500/30 transition-all duration-300"
              >
                <div className="card-header">
                  <h3 className="font-display text-lg font-semibold group-hover:text-mystic-300 transition-colors">
                    {campaign.name}
                  </h3>
                </div>
                <div className="card-body">
                  {campaign.description && (
                    <p className="text-dungeon-300 text-sm mb-4 line-clamp-2">
                      {campaign.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-dungeon-400">
                    <span className="flex items-center gap-1">
                      <Scroll className="w-4 h-4" />
                      {campaign._count?.sessions || 0} sessions
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {campaign._count?.players || 0} players
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-4 text-xs text-dungeon-500">
                    <Calendar className="w-3 h-3" />
                    Updated {new Date(campaign.updatedAt).toLocaleDateString()}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


