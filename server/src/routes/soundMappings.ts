import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

export const soundMappingRouter = Router();

// Validation schemas
const createSoundMappingSchema = z.object({
  campaignId: z.string().min(1),
  name: z.string().min(1).max(100),
  triggerType: z.enum(['keyword', 'scene', 'manual']),
  triggerValue: z.string().min(1).max(500),
  audioFile: z.string().min(1).max(500),
  audioSource: z.enum(['local', 'freesound', 'jamendo', 'tabletop']).optional(),
  externalId: z.string().max(100).optional(),
  previewUrl: z.string().max(1000).optional(),
  attribution: z.string().max(500).optional(),
  volume: z.number().int().min(0).max(100).optional(),
  loop: z.boolean().optional(),
  crossfadeDuration: z.number().int().min(0).max(10000).optional(),
});

const updateSoundMappingSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  triggerType: z.enum(['keyword', 'scene', 'manual']).optional(),
  triggerValue: z.string().min(1).max(500).optional(),
  audioFile: z.string().min(1).max(500).optional(),
  audioSource: z.enum(['local', 'freesound', 'jamendo', 'tabletop']).optional(),
  externalId: z.string().max(100).optional(),
  previewUrl: z.string().max(1000).optional(),
  attribution: z.string().max(500).optional(),
  volume: z.number().int().min(0).max(100).optional(),
  loop: z.boolean().optional(),
  crossfadeDuration: z.number().int().min(0).max(10000).optional(),
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

// GET /api/sound-mappings?campaignId=xxx - List sound mappings for a campaign
soundMappingRouter.get('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { campaignId } = req.query;
    
    if (!campaignId || typeof campaignId !== 'string') {
      throw new AppError(400, 'campaignId query parameter is required');
    }

    await verifyCampaignOwnership(campaignId, req.userId!);

    const soundMappings = await prisma.soundMapping.findMany({
      where: { campaignId },
      orderBy: [
        { triggerType: 'asc' },
        { name: 'asc' },
      ],
    });

    res.json({
      success: true,
      data: soundMappings,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/sound-mappings/:id - Get single sound mapping
soundMappingRouter.get('/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const soundMapping = await prisma.soundMapping.findUnique({
      where: { id: req.params.id },
      include: {
        campaign: { select: { userId: true } },
      },
    });

    if (!soundMapping || soundMapping.campaign.userId !== req.userId) {
      throw new AppError(404, 'Sound mapping not found');
    }

    res.json({
      success: true,
      data: soundMapping,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/sound-mappings - Create new sound mapping
soundMappingRouter.post('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const data = createSoundMappingSchema.parse(req.body);

    await verifyCampaignOwnership(data.campaignId, req.userId!);

    const soundMapping = await prisma.soundMapping.create({
      data: {
        campaignId: data.campaignId,
        name: data.name,
        triggerType: data.triggerType,
        triggerValue: data.triggerValue,
        audioFile: data.audioFile,
        audioSource: data.audioSource ?? 'local',
        externalId: data.externalId,
        previewUrl: data.previewUrl,
        attribution: data.attribution,
        volume: data.volume ?? 80,
        loop: data.loop ?? false,
        crossfadeDuration: data.crossfadeDuration ?? 2000,
      },
    });

    res.status(201).json({
      success: true,
      data: soundMapping,
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/sound-mappings/:id - Update sound mapping
soundMappingRouter.patch('/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const data = updateSoundMappingSchema.parse(req.body);

    // Verify ownership
    const existing = await prisma.soundMapping.findUnique({
      where: { id: req.params.id },
      include: { campaign: { select: { userId: true } } },
    });

    if (!existing || existing.campaign.userId !== req.userId) {
      throw new AppError(404, 'Sound mapping not found');
    }

    const soundMapping = await prisma.soundMapping.update({
      where: { id: req.params.id },
      data,
    });

    res.json({
      success: true,
      data: soundMapping,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/sound-mappings/:id - Delete sound mapping
soundMappingRouter.delete('/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    // Verify ownership
    const existing = await prisma.soundMapping.findUnique({
      where: { id: req.params.id },
      include: { campaign: { select: { userId: true } } },
    });

    if (!existing || existing.campaign.userId !== req.userId) {
      throw new AppError(404, 'Sound mapping not found');
    }

    await prisma.soundMapping.delete({
      where: { id: req.params.id },
    });

    res.json({
      success: true,
      data: { message: 'Sound mapping deleted' },
    });
  } catch (error) {
    next(error);
  }
});

