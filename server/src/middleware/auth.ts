import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';

// Extended request type with user
export interface AuthenticatedRequest extends Request {
  userId?: string;
  clerkId?: string;
}

/**
 * Auth middleware - validates Clerk session and attaches user to request
 * In development mode, allows a mock user for testing
 */
export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    // Development mode: allow mock authentication
    if (process.env.NODE_ENV === 'development') {
      const mockClerkId = req.headers['x-mock-user-id'] as string;
      
      if (mockClerkId) {
        // Find or create mock user
        let user = await prisma.user.findUnique({
          where: { clerkId: mockClerkId },
        });
        
        if (!user) {
          user = await prisma.user.create({
            data: {
              clerkId: mockClerkId,
              email: `${mockClerkId}@dev.local`,
              name: 'Dev User',
            },
          });
        }
        
        req.userId = user.id;
        req.clerkId = user.clerkId;
        return next();
      }
    }
    
    // Production: validate Clerk JWT from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Missing or invalid authorization header',
      });
    }
    
    const token = authHeader.substring(7);
    
    // TODO: Implement proper Clerk JWT verification
    // For now, we'll extract the clerk ID from a simplified token format
    // In production, use @clerk/backend to verify the JWT
    
    // Placeholder: In real implementation, verify JWT and extract clerkId
    // const { sub: clerkId } = await verifyClerkToken(token);
    
    // For development/testing, we'll accept the token as the clerk ID directly
    const clerkId = token;
    
    if (!clerkId) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token',
      });
    }
    
    // Find user by Clerk ID
    const user = await prisma.user.findUnique({
      where: { clerkId },
    });
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not found',
      });
    }
    
    req.userId = user.id;
    req.clerkId = user.clerkId;
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication failed',
    });
  }
}

/**
 * Optional auth - doesn't fail if no auth provided, but attaches user if present
 */
export async function optionalAuthMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authMiddleware(req, res, next);
    }
    
    next();
  } catch {
    next();
  }
}


