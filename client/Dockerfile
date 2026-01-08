FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the app
RUN npm run build

# Production stage - serve static files
FROM node:20-alpine

WORKDIR /app

# Install serve to host static files
RUN npm install -g serve

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Expose port (Railway uses PORT env var)
EXPOSE 3000

# Serve the static files on Railway's PORT (defaults to 3000)
CMD ["sh", "-c", "serve -s dist -l ${PORT:-3000}"]

