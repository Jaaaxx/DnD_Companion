FROM node:20-alpine

WORKDIR /app

# Install openssl for Prisma
RUN apk add --no-cache openssl

# Copy all server files first
COPY server/ ./

# Install dependencies
RUN npm install --production=false

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 3001

# Start server (schema already synced via db push)
CMD ["node", "dist/index.js"]
