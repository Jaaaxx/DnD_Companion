FROM node:20-alpine

WORKDIR /app

# Install openssl for Prisma
RUN apk add --no-cache openssl

# Copy server package files
COPY server/package*.json ./

# Install dependencies
RUN npm ci

# Copy prisma schema and generate client
COPY server/prisma ./prisma/
RUN npx prisma generate

# Copy server source code
COPY server/ ./

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 3001

# Run migrations and start server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
