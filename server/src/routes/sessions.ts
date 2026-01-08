import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

export const sessionRouter = Router();

// Validation schemas
const createSessionSchema = z.object({
  campaignId: z.string().min(1),
  title: z.string().max(200).optional(),
  date: z.string().datetime().optional(),
});

const updateSessionSchema = z.object({
  title: z.string().max(200).optional(),
  notes: z.string().max(50000).optional(),
  recap: z.string().max(10000).optional(),
  status: z.enum(['draft', 'in_progress', 'completed']).optional(),
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

// GET /api/sessions?campaignId=xxx - List sessions for a campaign
sessionRouter.get('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { campaignId } = req.query;
    
    if (!campaignId || typeof campaignId !== 'string') {
      throw new AppError(400, 'campaignId query parameter is required');
    }

    await verifyCampaignOwnership(campaignId, req.userId!);

    const sessions = await prisma.session.findMany({
      where: { campaignId },
      orderBy: { sessionNumber: 'desc' },
      select: {
        id: true,
        sessionNumber: true,
        title: true,
        date: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({
      success: true,
      data: sessions,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/sessions/:id - Get single session with full details
sessionRouter.get('/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const session = await prisma.session.findUnique({
      where: { id: req.params.id },
      include: {
        campaign: {
          select: { id: true, userId: true, name: true },
        },
        healthEvents: {
          include: { player: true },
          orderBy: { timestamp: 'asc' },
        },
      },
    });

    if (!session) {
      throw new AppError(404, 'Session not found');
    }

    // Verify ownership
    if (session.campaign.userId !== req.userId) {
      throw new AppError(404, 'Session not found');
    }

    res.json({
      success: true,
      data: session,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/sessions - Create new session
sessionRouter.post('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const data = createSessionSchema.parse(req.body);

    await verifyCampaignOwnership(data.campaignId, req.userId!);

    // Get next session number
    const lastSession = await prisma.session.findFirst({
      where: { campaignId: data.campaignId },
      orderBy: { sessionNumber: 'desc' },
    });

    const sessionNumber = (lastSession?.sessionNumber ?? 0) + 1;

    const session = await prisma.session.create({
      data: {
        campaignId: data.campaignId,
        sessionNumber,
        title: data.title || `Session ${sessionNumber}`,
        date: data.date ? new Date(data.date) : new Date(),
      },
    });

    res.status(201).json({
      success: true,
      data: session,
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/sessions/:id - Update session
sessionRouter.patch('/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const data = updateSessionSchema.parse(req.body);

    // Verify ownership
    const existing = await prisma.session.findUnique({
      where: { id: req.params.id },
      include: { campaign: { select: { userId: true } } },
    });

    if (!existing || existing.campaign.userId !== req.userId) {
      throw new AppError(404, 'Session not found');
    }

    const session = await prisma.session.update({
      where: { id: req.params.id },
      data,
    });

    res.json({
      success: true,
      data: session,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/sessions/:id - Delete session
sessionRouter.delete('/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    // Verify ownership
    const existing = await prisma.session.findUnique({
      where: { id: req.params.id },
      include: { campaign: { select: { userId: true } } },
    });

    if (!existing || existing.campaign.userId !== req.userId) {
      throw new AppError(404, 'Session not found');
    }

    await prisma.session.delete({
      where: { id: req.params.id },
    });

    res.json({
      success: true,
      data: { message: 'Session deleted' },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/sessions/:id/transcript - Update transcript (append segments)
sessionRouter.post('/:id/transcript', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { segments } = req.body;
    
    if (!Array.isArray(segments)) {
      throw new AppError(400, 'segments array is required');
    }

    // Verify ownership
    const existing = await prisma.session.findUnique({
      where: { id: req.params.id },
      include: { campaign: { select: { userId: true } } },
    });

    if (!existing || existing.campaign.userId !== req.userId) {
      throw new AppError(404, 'Session not found');
    }

    const currentTranscript = existing.transcript as unknown[];
    const updatedTranscript = [...currentTranscript, ...segments];

    const session = await prisma.session.update({
      where: { id: req.params.id },
      data: { transcript: updatedTranscript },
    });

    res.json({
      success: true,
      data: session,
    });
  } catch (error) {
    next(error);
  }
});

