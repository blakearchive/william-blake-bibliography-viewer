# Multi-stage build for React frontend
FROM node:18-alpine as build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application source
COPY . .

# Build the React app
RUN npm run build

# Production stage with nginx-unprivileged (designed for restricted environments)
FROM nginxinc/nginx-unprivileged:alpine

# Remove default nginx configurations to avoid conflicts
RUN rm -rf /etc/nginx/conf.d/*

# Copy custom server configuration (not full nginx.conf)
COPY nginx-server.conf /etc/nginx/conf.d/default.conf

# Copy built React app
COPY --from=build /app/build /usr/share/nginx/html

# Expose port (nginx-unprivileged uses 8080 by default)
EXPOSE 8080

# Use default nginx-unprivileged entrypoint
CMD ["nginx", "-g", "daemon off;"]
