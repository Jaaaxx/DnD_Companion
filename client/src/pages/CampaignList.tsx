import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Plus, 
  Scroll, 
  Users, 
  Calendar,
  ChevronRight,
  Sparkles,
  BookOpen
} from 'lucide-react';
import { useCampaignStore } from '@/stores/campaignStore';

export function CampaignList() {
  const { campaigns, isLoading, fetchCampaigns } = useCampaignStore();

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold mb-2">
            Your Campaigns
          </h1>
          <p className="text-dungeon-300">
            Manage and explore your adventures
          </p>
        </div>
        <Link to="/app/campaigns/new" className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New Campaign
        </Link>
      </div>

      {/* Campaigns Grid */}
      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
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
        <div className="card max-w-lg mx-auto">
          <div className="card-body text-center py-16">
            <div className="w-20 h-20 rounded-full bg-mystic-600/20 flex items-center justify-center mx-auto mb-6">
              <BookOpen className="w-10 h-10 text-mystic-400" />
            </div>
            <h3 className="font-display text-2xl font-semibold mb-3">
              No Campaigns Yet
            </h3>
            <p className="text-dungeon-400 mb-8 max-w-sm mx-auto">
              Every great adventure starts somewhere. Create your first campaign to begin tracking your D&D sessions.
            </p>
            <Link to="/app/campaigns/new" className="btn-primary inline-flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Create Your First Campaign
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map((campaign) => (
            <Link
              key={campaign.id}
              to={`/app/campaigns/${campaign.id}`}
              className="card group hover:border-mystic-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-mystic-900/20"
            >
              <div className="card-header flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-display text-lg font-semibold group-hover:text-mystic-300 transition-colors truncate">
                    {campaign.name}
                  </h3>
                </div>
                <ChevronRight className="w-5 h-5 text-dungeon-500 group-hover:text-mystic-400 transition-colors flex-shrink-0 ml-2" />
              </div>
              <div className="card-body pt-0">
                {campaign.description ? (
                  <p className="text-dungeon-300 text-sm mb-4 line-clamp-2">
                    {campaign.description}
                  </p>
                ) : (
                  <p className="text-dungeon-500 text-sm mb-4 italic">
                    No description
                  </p>
                )}
                
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1.5 text-dungeon-400">
                    <Scroll className="w-4 h-4 text-mystic-500" />
                    <span className="font-medium">{campaign._count?.sessions || 0}</span>
                    <span className="text-dungeon-500">sessions</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-dungeon-400">
                    <Users className="w-4 h-4 text-mystic-500" />
                    <span className="font-medium">{campaign._count?.players || 0}</span>
                    <span className="text-dungeon-500">players</span>
                  </span>
                </div>
                
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-dungeon-700/50 text-xs text-dungeon-500">
                  <Calendar className="w-3.5 h-3.5" />
                  Last updated {new Date(campaign.updatedAt).toLocaleDateString()}
                </div>
              </div>
            </Link>
          ))}
          
          {/* Add Campaign Card */}
          <Link
            to="/app/campaigns/new"
            className="card border-dashed border-2 border-dungeon-600 hover:border-mystic-500/50 transition-all duration-300 group"
          >
            <div className="card-body flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 rounded-full bg-dungeon-800 group-hover:bg-mystic-600/20 flex items-center justify-center mb-4 transition-colors">
                <Plus className="w-6 h-6 text-dungeon-400 group-hover:text-mystic-400 transition-colors" />
              </div>
              <h4 className="font-display font-semibold text-dungeon-300 group-hover:text-mystic-300 transition-colors">
                New Campaign
              </h4>
              <p className="text-sm text-dungeon-500 mt-1">
                Start a new adventure
              </p>
            </div>
          </Link>
        </div>
      )}
    </div>
  );
}

