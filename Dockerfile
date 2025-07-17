FROM node:20-alpine AS development
WORKDIR /app

# Copy only package files first for better caching
COPY package*.json ./

# Install dependencies (remove .npmrc copy)
RUN npm install

# Copy the rest of the application
COPY . .

# Environment variables
ENV NODE_ENV=production
ENV PORT=8000

EXPOSE 8000
CMD ["npm", "run", "dev"]