# Build stage
FROM node:20-alpine AS builder
 
WORKDIR /app
 
# Install pnpm
RUN npm install -g pnpm
 
# Copy package files
COPY package.json pnpm-lock.yaml ./
 
# Install all dependencies (including devDependencies)
RUN pnpm install --frozen-lockfile
 
# proto 파일 복사
COPY proto ./proto
 
# Copy source code
COPY . .
 
# Build the application
RUN pnpm run build
 
# Production stage
FROM node:20-alpine AS production
 
WORKDIR /app
 
# Install pnpm
RUN npm install -g pnpm
 
# Copy package files
COPY package.json pnpm-lock.yaml ./
 
# Install only production dependencies
RUN pnpm install --frozen-lockfile --prod
 
# Copy built application from builder stage
COPY --from=builder /app/dist ./dist
 
# Expose port
EXPOSE 3000
 
# Start the application
CMD ["node", "dist/main.js"]
 
COPY --from=builder /app/proto ./proto