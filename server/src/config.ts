import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  
  // Database
  databaseUrl: process.env.DATABASE_URL || '',
  
  // Clerk Auth
  clerkPublishableKey: process.env.CLERK_PUBLISHABLE_KEY || '',
  clerkSecretKey: process.env.CLERK_SECRET_KEY || '',
  
  // Deepgram
  deepgramApiKey: process.env.DEEPGRAM_API_KEY || '',
  
  // OpenAI
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  
  // Audio Library APIs
  freesoundApiKey: process.env.FREESOUND_API_KEY || '',
  jamendoClientId: process.env.JAMENDO_CLIENT_ID || '',
} as const;

// Validate required config in production
if (config.nodeEnv === 'production') {
  const required = [
    'databaseUrl',
    'clerkSecretKey',
    'deepgramApiKey',
    'openaiApiKey',
  ] as const;
  
  for (const key of required) {
    if (!config[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }
}


