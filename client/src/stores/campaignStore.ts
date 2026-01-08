import { create } from 'zustand';
import { api } from '@/services/api';

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  worldContext: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    sessions: number;
    players: number;
    npcs: number;
  };
}

interface CampaignStore {
  campaigns: Campaign[];
  currentCampaign: Campaign | null;
  isLoading: boolean;
  error: string | null;
  
  fetchCampaigns: () => Promise<void>;
  fetchCampaign: (id: string) => Promise<void>;
  createCampaign: (data: { name: string; description?: string; worldContext?: string }) => Promise<Campaign>;
  updateCampaign: (id: string, data: Partial<Campaign>) => Promise<void>;
  deleteCampaign: (id: string) => Promise<void>;
  clearError: () => void;
}

export const useCampaignStore = create<CampaignStore>((set) => ({
  campaigns: [],
  currentCampaign: null,
  isLoading: false,
  error: null,

  fetchCampaigns: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get<Campaign[]>('/campaigns');
      set({ campaigns: response.data ?? [], isLoading: false });
    } catch {
      set({ error: 'Failed to fetch campaigns', isLoading: false });
    }
  },

  fetchCampaign: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get<Campaign>(`/campaigns/${id}`);
      set({ currentCampaign: response.data ?? null, isLoading: false });
    } catch {
      set({ error: 'Failed to fetch campaign', isLoading: false });
    }
  },

  createCampaign: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post<Campaign>('/campaigns', data);
      const newCampaign = response.data as Campaign;
      set((state) => ({
        campaigns: [newCampaign, ...state.campaigns],
        isLoading: false,
      }));
      return newCampaign;
    } catch (error) {
      set({ error: 'Failed to create campaign', isLoading: false });
      throw error;
    }
  },

  updateCampaign: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.patch<Campaign>(`/campaigns/${id}`, data);
      const updatedCampaign = response.data as Campaign;
      set((state) => ({
        campaigns: state.campaigns.map((c) =>
          c.id === id ? updatedCampaign : c
        ),
        currentCampaign:
          state.currentCampaign?.id === id
            ? updatedCampaign
            : state.currentCampaign,
        isLoading: false,
      }));
    } catch {
      set({ error: 'Failed to update campaign', isLoading: false });
      throw new Error('Failed to update campaign');
    }
  },

  deleteCampaign: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await api.delete(`/campaigns/${id}`);
      set((state) => ({
        campaigns: state.campaigns.filter((c) => c.id !== id),
        currentCampaign:
          state.currentCampaign?.id === id ? null : state.currentCampaign,
        isLoading: false,
      }));
    } catch {
      set({ error: 'Failed to delete campaign', isLoading: false });
      throw new Error('Failed to delete campaign');
    }
  },

  clearError: () => set({ error: null }),
}));
