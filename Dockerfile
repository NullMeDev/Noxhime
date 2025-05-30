FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files first to leverage Docker layer caching
COPY package*.json ./
RUN npm ci

# Copy the rest of the application
COPY . .

# Build the application
RUN npm run build

# Create production image
FROM node:18-alpine

WORKDIR /app

# Copy package files and install production dependencies only
COPY package*.json ./
RUN npm ci --only=production

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/web/public ./web/public

# Create data directory for SQLite database
RUN mkdir -p ./data

# Add a non-root user and change ownership
RUN addgroup -S noxhime && \
    adduser -S -G noxhime noxhime && \
    chown -R noxhime:noxhime /app

USER noxhime

# Set environment variables
ENV NODE_ENV=production

# Expose API port
EXPOSE 3000

# Start the application
CMD ["node", "dist/index.js"]

