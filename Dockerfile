# Stage 1: Base image with development dependencies
FROM node:20-alpine AS development
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
COPY .npmrc ./

# Install all dependencies (including devDependencies)
RUN npm install

# Copy all files
COPY . .

# Environment variables for development
ENV NODE_ENV=development
ENV PORT=8000


# Expose port and run dev server
EXPOSE 8000
CMD ["npm", "run", "dev"]