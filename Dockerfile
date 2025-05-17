# Use Node.js 20 as base image
FROM node:20-alpine

# Create app directory
WORKDIR /usr/src/app

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Install app dependencies by copying
# package.json and package-lock.json
COPY package*.json ./

# Install dependencies including production ones
RUN npm ci --only=production

# Bundle app source
COPY . .

# Expose the port the app runs on
EXPOSE 3000

# Command to run the application
CMD ["node", "server.js"]