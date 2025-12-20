FROM node:20-alpine

WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies including devDependencies
RUN npm install

# Copy source code
COPY ./src ./src

# Expose port
EXPOSE 3000

# Default command: use nodemon in dev, node in prod
CMD ["npm", "run", "dev"]
