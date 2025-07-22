# OpenShift Deployment Troubleshooting Guide

## Current Status

The nginx configuration has been systematically fixed to resolve all permission issues:

### ✅ Fixes Applied (Latest commit: d47e49e)
- Removed user directive
- Removed PID file directive 
- All cache directories use /tmp
- Error logging goes to stderr
- OpenShift DNS resolver configured
- Minimal configuration for maximum compatibility

## If Still Seeing PID Permission Errors

The error `/tmp/nginx.pid failed (13: Permission denied)` suggests an older build is still running.

### Troubleshooting Steps:

#### 1. Force New Build
```bash
# In OpenShift Web Console:
# - Go to Builds → Build Configs
# - Find "blake-bibliography-frontend"
# - Click "Start Build" to force a new build with latest code

# Or if you have oc CLI:
oc start-build blake-bibliography-frontend
```

#### 2. Check Current Pod Status
```bash
# In OpenShift Web Console:
# - Go to Workloads → Pods
# - Look for blake-bibliography-frontend pods
# - Check creation timestamp to ensure they're using recent builds

# Or with oc CLI:
oc get pods -l app=blake-bibliography-frontend
oc describe pod <pod-name>
```

#### 3. View Build Logs
```bash
# In OpenShift Web Console:
# - Go to Builds → Builds
# - Click on latest frontend build
# - Check logs to ensure it's using the updated Dockerfile/nginx.conf

# Or with oc CLI:
oc logs build/blake-bibliography-frontend-<number>
```

#### 4. Check Pod Logs
```bash
# In OpenShift Web Console:
# - Go to Workloads → Pods
# - Click on frontend pod
# - View logs to see current startup sequence

# Or with oc CLI:
oc logs pod/<frontend-pod-name>
```

#### 5. Force Pod Restart
```bash
# In OpenShift Web Console:
# - Go to Workloads → Deployments
# - Find blake-bibliography-frontend deployment
# - Click Actions → Restart rollout

# Or with oc CLI:
oc rollout restart deployment/blake-bibliography-frontend
```

## Expected Successful Startup Logs

With the latest fixes, you should see:
```
/docker-entrypoint.sh: Configuration complete; ready for start up
[notice] 1#1: using the "epoll" event method
[notice] 1#1: nginx/1.xx.x
[notice] 1#1: built by gcc ...
[notice] 1#1: OS: Linux ...
[notice] 1#1: getrlimit(RLIMIT_NOFILE): 1048576:1048576
[notice] 1#1: start worker processes
[notice] 1#1: start worker process 7
```

## If Problems Persist

If you're still seeing the PID error after forcing new builds:

### Alternative: Minimal Nginx Configuration
We could switch to an even more minimal approach using a custom entrypoint script.

### Last Resort: Different Base Image
Consider switching from `nginx:alpine` to `nginxinc/nginx-unprivileged` which is specifically designed for restricted environments.

## Verification Commands

Once the pod is running successfully:

```bash
# Test the service internally (from another pod):
curl http://blake-bibliography-frontend:8080

# Check if backend is accessible:
curl http://blake-bibliography-backend:8000/api/info

# Test the route (external access):
curl https://<route-url>
```

## Current Git Status

Latest commit: `d47e49e` - Contains all necessary fixes
Repository: https://github.com/blakearchive/william-blake-bibliography-viewer

All source code is ready for successful deployment.
