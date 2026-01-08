import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

export const npcRouter = Router();

// Validation schemas
const createNPCSchema = z.object({
  campaignId: z.string().min(1),
  name: z.string().min(1).max(100),
  description: z.string().max(5000).optional(),
  speechPatterns: z.string().max(2000).optional(),
});

const updateNPCSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(5000).optional(),
  speechPatterns: z.string().max(2000).optional(),
});

// Helper to verify campaign ownership
async function verifyCampaignOwnership(campaignId: string, userId: string) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, userId },
  });
  if (!campaign) {
    throw new AppError(404, 'Campaign not found');
  }
  return campaign;
}

// GET /api/npcs?campaignId=xxx - List NPCs for a campaign
npcRouter.get('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { campaignId } = req.query;
    
    if (!campaignId || typeof campaignId !== 'string') {
      throw new AppError(400, 'campaignId query parameter is required');
    }

    await verifyCampaignOwnership(campaignId, req.userId!);

    const npcs = await prisma.nPC.findMany({
      where: { campaignId },
      orderBy: { name: 'asc' },
    });

    res.json({
      success: true,
      data: npcs,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/npcs/:id - Get single NPC
npcRouter.get('/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const npc = await prisma.nPC.findUnique({
      where: { id: req.params.id },
      include: {
        campaign: { select: { userId: true } },
      },
    });

    if (!npc || npc.campaign.userId !== req.userId) {
      throw new AppError(404, 'NPC not found');
    }

    res.json({
      success: true,
      data: npc,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/npcs - Create new NPC
npcRouter.post('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const data = createNPCSchema.parse(req.body);

    await verifyCampaignOwnership(data.campaignId, req.userId!);

    const npc = await prisma.nPC.create({
      data: {
        campaignId: data.campaignId,
        name: data.name,
        description: data.description,
        speechPatterns: data.speechPatterns,
      },
    });

    res.status(201).json({
      success: true,
      data: npc,
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/npcs/:id - Update NPC
npcRouter.patch('/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const data = updateNPCSchema.parse(req.body);

    // Verify ownership
    const existing = await prisma.nPC.findUnique({
      where: { id: req.params.id },
      include: { campaign: { select: { userId: true } } },
    });

    if (!existing || existing.campaign.userId !== req.userId) {
      throw new AppError(404, 'NPC not found');
    }

    const npc = await prisma.nPC.update({
      where: { id: req.params.id },
      data,
    });

    res.json({
      success: true,
      data: npc,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/npcs/:id - Delete NPC
npcRouter.delete('/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    // Verify ownership
    const existing = await prisma.nPC.findUnique({
      where: { id: req.params.id },
      include: { campaign: { select: { userId: true } } },
    });

    if (!existing || existing.campaign.userId !== req.userId) {
      throw new AppError(404, 'NPC not found');
    }

    await prisma.nPC.delete({
      where: { id: req.params.id },
    });

    res.json({
      success: true,
      data: { message: 'NPC deleted' },
    });
  } catch (error) {
    next(error);
  }
});

