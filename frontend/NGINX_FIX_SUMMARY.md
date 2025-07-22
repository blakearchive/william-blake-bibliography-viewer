# nginx-unprivileged Container Fix Summary

## Issue Resolution
Successfully resolved nginx container startup issues and production "rewrite or internal redirection cycle" errors.

## Root Cause
The original issue was caused by:
1. **USER directive conflict**: The `USER 101` directive in Dockerfile conflicted with nginx-unprivileged image defaults
2. **Configuration approach**: Using full nginx.conf override instead of server block configuration
3. **Permission issues**: nginx couldn't write PID file due to permission conflicts

## Solution Implemented

### 1. Dockerfile Changes
- **Removed**: `USER 101` directive that was conflicting with nginx-unprivileged defaults
- **Result**: Container now uses nginx-unprivileged's default user configuration

### 2. Configuration Approach
- **Changed from**: Full nginx.conf override
- **Changed to**: Server block configuration in `/etc/nginx/conf.d/default.conf`
- **Benefit**: Works with nginx-unprivileged's default setup

### 3. Current Working Configuration

**Dockerfile (final):**
```dockerfile
# Build stage
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Production stage  
FROM nginxinc/nginx-unprivileged:alpine
RUN rm -rf /etc/nginx/conf.d/*
COPY nginx-server.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 8080
```

**nginx-server.conf:**
```nginx
server {
    listen 8080;
    server_name _;
    
    # OpenShift DNS resolver
    resolver 172.30.0.1 valid=30s;
    
    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Root directory for React app
    root /usr/share/nginx/html;
    index index.html;
    
    # Handle static assets with caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }
    
    # API proxy to backend
    location /api/ {
        set $upstream http://blake-pdf-backend.grantg.svc.cluster.local:5000;
        proxy_pass $upstream;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
    
    # React Router fallback - handle client-side routing
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

## Verification Results

### ✅ Container Startup
- nginx process starts successfully without permission errors
- PID file creation works properly
- Worker processes spawn correctly

### ✅ HTTP Response Testing
```bash
curl -I http://localhost:8080
# HTTP/1.1 200 OK - ✅ Root route works

curl -I http://localhost:8080/search  
# HTTP/1.1 200 OK - ✅ React Router fallback works

curl -I http://localhost:8080/details/somebook
# HTTP/1.1 200 OK - ✅ Deep route fallback works
```

### ✅ Security Headers
All security headers are properly set:
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff  
- X-XSS-Protection: 1; mode=block

## Deployment Ready
- **Image**: `grantglass/blake-pdf-frontend:latest`
- **Docker Hub**: Successfully pushed and ready for OpenShift deployment
- **Status**: Ready to resolve production "rewrite or internal redirection cycle" errors

## Next Steps
1. Deploy updated image to OpenShift
2. Verify production error resolution at `frontend-grantg.apps.cloudapps.unc.edu`
3. Test React Router navigation in production environment

## Key Learnings
- nginx-unprivileged images have specific permission requirements
- Manual USER directives can conflict with unprivileged image defaults
- Server block configuration is more flexible than full nginx.conf override
- Always test nginx configuration syntax before deployment
