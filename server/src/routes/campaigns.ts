import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

export const campaignRouter = Router();

// Validation schemas
const createCampaignSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  worldContext: z.string().max(10000).optional(),
});

const updateCampaignSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional(),
  worldContext: z.string().max(10000).optional(),
});

// GET /api/campaigns - List all campaigns for user
campaignRouter.get('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const campaigns = await prisma.campaign.findMany({
      where: { userId: req.userId! },
      include: {
        _count: {
          select: {
            sessions: true,
            players: true,
            npcs: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    res.json({
      success: true,
      data: campaigns,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/campaigns/:id - Get single campaign with details
campaignRouter.get('/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId!,
      },
      include: {
        sessions: {
          orderBy: { sessionNumber: 'desc' },
          take: 10,
        },
        players: true,
        npcs: true,
        soundMappings: true,
      },
    });

    if (!campaign) {
      throw new AppError(404, 'Campaign not found');
    }

    res.json({
      success: true,
      data: campaign,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/campaigns - Create new campaign
campaignRouter.post('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const data = createCampaignSchema.parse(req.body);

    const campaign = await prisma.campaign.create({
      data: {
        ...data,
        userId: req.userId!,
      },
    });

    res.status(201).json({
      success: true,
      data: campaign,
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/campaigns/:id - Update campaign
campaignRouter.patch('/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const data = updateCampaignSchema.parse(req.body);

    // Verify ownership
    const existing = await prisma.campaign.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId!,
      },
    });

    if (!existing) {
      throw new AppError(404, 'Campaign not found');
    }

    const campaign = await prisma.campaign.update({
      where: { id: req.params.id },
      data,
    });

    res.json({
      success: true,
      data: campaign,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/campaigns/:id - Delete campaign
campaignRouter.delete('/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    // Verify ownership
    const existing = await prisma.campaign.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId!,
      },
    });

    if (!existing) {
      throw new AppError(404, 'Campaign not found');
    }

    await prisma.campaign.delete({
      where: { id: req.params.id },
    });

    res.json({
      success: true,
      data: { message: 'Campaign deleted' },
    });
  } catch (error) {
    next(error);
  }
});


