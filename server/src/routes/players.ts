import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

export const playerRouter = Router();

// Validation schemas
const createPlayerSchema = z.object({
  campaignId: z.string().min(1),
  playerName: z.string().min(1).max(100),
  characterName: z.string().min(1).max(100),
  characterClass: z.string().max(50).optional(),
  characterRace: z.string().max(50).optional(),
  maxHp: z.number().int().positive().optional(),
  currentHp: z.number().int().min(0).optional(),
});

const updatePlayerSchema = z.object({
  playerName: z.string().min(1).max(100).optional(),
  characterName: z.string().min(1).max(100).optional(),
  characterClass: z.string().max(50).optional(),
  characterRace: z.string().max(50).optional(),
  maxHp: z.number().int().positive().optional(),
  currentHp: z.number().int().min(0).optional(),
  notes: z.string().max(10000).optional(),
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

// GET /api/players?campaignId=xxx - List players for a campaign
playerRouter.get('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { campaignId } = req.query;
    
    if (!campaignId || typeof campaignId !== 'string') {
      throw new AppError(400, 'campaignId query parameter is required');
    }

    await verifyCampaignOwnership(campaignId, req.userId!);

    const players = await prisma.player.findMany({
      where: { campaignId },
      orderBy: { characterName: 'asc' },
    });

    res.json({
      success: true,
      data: players,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/players/:id - Get single player
playerRouter.get('/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const player = await prisma.player.findUnique({
      where: { id: req.params.id },
      include: {
        campaign: { select: { userId: true } },
        healthEvents: {
          orderBy: { timestamp: 'desc' },
          take: 20,
        },
      },
    });

    if (!player || player.campaign.userId !== req.userId) {
      throw new AppError(404, 'Player not found');
    }

    res.json({
      success: true,
      data: player,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/players - Create new player
playerRouter.post('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const data = createPlayerSchema.parse(req.body);

    await verifyCampaignOwnership(data.campaignId, req.userId!);

    const player = await prisma.player.create({
      data: {
        campaignId: data.campaignId,
        playerName: data.playerName,
        characterName: data.characterName,
        characterClass: data.characterClass,
        characterRace: data.characterRace,
        maxHp: data.maxHp ?? 10,
        currentHp: data.currentHp ?? data.maxHp ?? 10,
      },
    });

    res.status(201).json({
      success: true,
      data: player,
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/players/:id - Update player
playerRouter.patch('/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const data = updatePlayerSchema.parse(req.body);

    // Verify ownership
    const existing = await prisma.player.findUnique({
      where: { id: req.params.id },
      include: { campaign: { select: { userId: true } } },
    });

    if (!existing || existing.campaign.userId !== req.userId) {
      throw new AppError(404, 'Player not found');
    }

    const player = await prisma.player.update({
      where: { id: req.params.id },
      data,
    });

    res.json({
      success: true,
      data: player,
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/players/:id/hp - Update player HP (convenience endpoint)
playerRouter.patch('/:id/hp', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { delta, absolute } = req.body;
    
    if (delta === undefined && absolute === undefined) {
      throw new AppError(400, 'Either delta or absolute HP value is required');
    }

    // Verify ownership
    const existing = await prisma.player.findUnique({
      where: { id: req.params.id },
      include: { campaign: { select: { userId: true } } },
    });

    if (!existing || existing.campaign.userId !== req.userId) {
      throw new AppError(404, 'Player not found');
    }

    let newHp: number;
    if (absolute !== undefined) {
      newHp = Math.max(0, Math.min(absolute, existing.maxHp));
    } else {
      newHp = Math.max(0, Math.min(existing.currentHp + delta, existing.maxHp));
    }

    const player = await prisma.player.update({
      where: { id: req.params.id },
      data: { currentHp: newHp },
    });

    res.json({
      success: true,
      data: player,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/players/:id - Delete player
playerRouter.delete('/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    // Verify ownership
    const existing = await prisma.player.findUnique({
      where: { id: req.params.id },
      include: { campaign: { select: { userId: true } } },
    });

    if (!existing || existing.campaign.userId !== req.userId) {
      throw new AppError(404, 'Player not found');
    }

    await prisma.player.delete({
      where: { id: req.params.id },
    });

    res.json({
      success: true,
      data: { message: 'Player deleted' },
    });
  } catch (error) {
    next(error);
  }
});

