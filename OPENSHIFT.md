# OpenShift Deployment Guide

This guide covers deploying the William Blake Bibliography PDF Viewer to Red Hat OpenShift.

## Prerequisites

1. **OpenShift CLI (oc)**: Download from [OpenShift CLI](https://docs.openshift.com/container-platform/latest/cli_reference/openshift_cli/getting-started-cli.html)
2. **Access to an OpenShift cluster**: Either OpenShift Local, OpenShift Online, or enterprise cluster
3. **Cluster permissions**: Ability to create projects/namespaces and deploy applications

## Quick Deployment

### Option 1: Automated Deployment (Recommended)

```bash
# 1. Login to your OpenShift cluster
oc login <your-openshift-cluster-url>

# 2. Run the deployment script
./deploy-openshift.sh
```

### Option 2: Manual Deployment

```bash
# 1. Login to OpenShift
oc login <your-openshift-cluster-url>

# 2. Create a new project
oc new-project blake-bibliography

# 3. Apply the manifests
oc apply -f openshift/

# 4. Start the builds
oc start-build blake-bibliography-backend --follow
oc start-build blake-bibliography-frontend --follow

# 5. Wait for deployments
oc rollout status deployment/blake-bibliography-backend
oc rollout status deployment/blake-bibliography-frontend

# 6. Get the application URL
oc get route blake-bibliography
```

## Architecture

The OpenShift deployment consists of:

### Backend Service
- **Image**: Built from `backend/Dockerfile`
- **Port**: 8000
- **Resources**: 512Mi RAM, 250m CPU (requests), 1Gi RAM, 500m CPU (limits)
- **Health Checks**: `/api/info` endpoint
- **Security**: Non-root user (1001), no privilege escalation

### Frontend Service
- **Image**: Built from `frontend/Dockerfile` (React + Nginx)
- **Port**: 8080
- **Resources**: 256Mi RAM, 100m CPU (requests), 512Mi RAM, 200m CPU (limits)
- **Replicas**: 2 for high availability
- **Security**: Non-root user (1001), no privilege escalation

### Networking
- **Route**: HTTPS-enabled public route with edge TLS termination
- **Internal**: Frontend proxies API calls to backend service
- **Security**: All traffic redirected to HTTPS

## File Structure

```
openshift/
├── deployment.yaml     # Main deployment configuration
├── buildconfig.yaml    # Source-to-Image build configuration
backend/
├── Dockerfile         # Backend container image
├── .dockerignore      # Docker build exclusions
frontend/
├── Dockerfile         # Frontend container image
├── nginx.conf         # Nginx configuration
├── .dockerignore      # Docker build exclusions
deploy-openshift.sh    # Automated deployment script
```

## Configuration

### Environment Variables
The backend accepts these environment variables:
- `PORT`: Server port (default: 8000)

### Resource Limits
Current resource allocations:
- **Backend**: 512Mi-1Gi RAM, 250m-500m CPU
- **Frontend**: 256Mi-512Mi RAM, 100m-200m CPU

Adjust in `openshift/deployment.yaml` as needed for your workload.

### Persistent Storage
The PDF file is bundled in the container image. For large files or dynamic content, consider:
- OpenShift Persistent Volumes
- External storage (S3, Azure Blob, etc.)
- ConfigMaps for smaller files

## Monitoring & Management

### Check Application Status
```bash
# View all resources
oc get all -l app=blake-bibliography-backend,app=blake-bibliography-frontend

# Check pod status
oc get pods

# View application logs
oc logs -l app=blake-bibliography-backend  # Backend logs
oc logs -l app=blake-bibliography-frontend # Frontend logs
```

### Scaling
```bash
# Scale frontend replicas
oc scale deployment blake-bibliography-frontend --replicas=3

# Scale backend replicas
oc scale deployment blake-bibliography-backend --replicas=2
```

### Updates
```bash
# Trigger new builds after code changes
oc start-build blake-bibliography-backend
oc start-build blake-bibliography-frontend

# Monitor rollout
oc rollout status deployment/blake-bibliography-backend
oc rollout status deployment/blake-bibliography-frontend
```

## Security Features

- **Non-root containers**: All containers run as user 1001
- **Security context**: No privilege escalation, all capabilities dropped
- **HTTPS**: TLS termination at the route level
- **Network policies**: Can be added for additional network security

## Troubleshooting

### Build Issues
```bash
# Check build logs
oc logs -f bc/blake-bibliography-backend
oc logs -f bc/blake-bibliography-frontend

# Restart failed builds
oc start-build blake-bibliography-backend
```

### Runtime Issues
```bash
# Check pod logs
oc logs deployment/blake-bibliography-backend
oc logs deployment/blake-bibliography-frontend

# Debug pod issues
oc describe pod <pod-name>

# Access pod shell for debugging
oc rsh deployment/blake-bibliography-backend
```

### Route Issues
```bash
# Check route configuration
oc describe route blake-bibliography

# Test internal connectivity
oc port-forward svc/blake-bibliography-frontend 8080:8080
```

## Advanced Configuration

### Custom Domain
```bash
# Edit the route to use your domain
oc edit route blake-bibliography
# Add spec.host: your-domain.com
```

### Environment-specific Configs
- Use ConfigMaps for environment variables
- Use Secrets for sensitive data
- Use different namespaces for dev/staging/prod

### Monitoring
- OpenShift includes built-in monitoring
- Add custom metrics endpoints if needed
- Configure alerts for application health

## Performance Optimization

1. **Resource Tuning**: Adjust CPU/memory based on usage patterns
2. **Replica Scaling**: Increase replicas during high traffic
3. **Caching**: Consider Redis for caching PDF pages
4. **CDN**: Use OpenShift routes with external CDN for static assets

## Support

For OpenShift-specific issues:
- [OpenShift Documentation](https://docs.openshift.com/)
- [OpenShift Community](https://www.openshift.com/community/)

For application issues:
- Check the main README.md
- Review application logs
- Open an issue in the GitHub repository
