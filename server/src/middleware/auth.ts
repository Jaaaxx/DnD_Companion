import { Request, Response, NextFunction } from 'express';
import { verifyToken, createClerkClient } from '@clerk/backend';
import { prisma } from '../lib/prisma.js';

// Extended request type with user
export interface AuthenticatedRequest extends Request {
  userId?: string;
  clerkId?: string;
}

// Initialize Clerk client for user API calls
const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

/**
 * Auth middleware - validates Clerk session and attaches user to request
 * Auto-creates users if they don't exist in our database
 */
export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    console.log(`[Auth] ${req.method} ${req.path}`);
    
    // Validate Clerk JWT from Authorization header
    const authHeader = req.headers.authorization;
    
    console.log(`[Auth] Authorization header: ${authHeader ? 'present' : 'missing'}`);
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[Auth] ❌ Missing or invalid authorization header');
      return res.status(401).json({
        success: false,
        error: 'Missing or invalid authorization header',
      });
    }
    
    const token = authHeader.substring(7);
    console.log(`[Auth] Token length: ${token.length}`);
    
    try {
      // Verify the JWT with Clerk
      console.log('[Auth] Verifying token with Clerk...');
      const payload = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY,
      });
      const clerkId = payload.sub;
      console.log(`[Auth] Token verified, clerkId: ${clerkId}`);
      
      if (!clerkId) {
        console.log('[Auth] ❌ No clerkId in token');
        return res.status(401).json({
          success: false,
          error: 'Invalid token',
        });
      }
      
      // Find or create user
      let user = await prisma.user.findUnique({
        where: { clerkId },
      });
      
      if (!user) {
        console.log(`[Auth] User not found, creating new user for clerkId: ${clerkId}`);
        // Fetch user info from Clerk to create our database record
        const clerkUser = await clerk.users.getUser(clerkId);
        
        user = await prisma.user.create({
          data: {
            clerkId,
            email: clerkUser.emailAddresses[0]?.emailAddress || `${clerkId}@unknown.local`,
            name: clerkUser.firstName 
              ? `${clerkUser.firstName}${clerkUser.lastName ? ' ' + clerkUser.lastName : ''}`
              : 'Dungeon Master',
          },
        });
        
        console.log(`[Auth] ✓ Created new user: ${user.email} (${user.id})`);
      } else {
        console.log(`[Auth] ✓ Found existing user: ${user.email} (${user.id})`);
      }
      
      req.userId = user.id;
      req.clerkId = user.clerkId;
      
      next();
    } catch (verifyError) {
      console.error('[Auth] ❌ Token verification failed:', verifyError);
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
      });
    }
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
