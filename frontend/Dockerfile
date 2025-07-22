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
RUN rm -rf /etc/nginx/conf.d/* && \
    rm -f /etc/nginx/nginx.conf

# Copy custom nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Copy custom startup script
COPY start-nginx.sh /usr/local/bin/start-nginx.sh
RUN chmod +x /usr/local/bin/start-nginx.sh

# Copy built React app
COPY --from=build /app/build /usr/share/nginx/html

# nginx-unprivileged already runs as non-root user with proper permissions
# Switch to non-root user
USER 101

# Expose port (nginx-unprivileged uses 8080 by default)
EXPOSE 8080

# Start nginx using custom script
CMD ["/usr/local/bin/start-nginx.sh"]
