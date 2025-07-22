# Deployment Instructions for Fixed nginx Configuration

# Deployment Instructions for Fixed nginx Configuration

## Issue Identified ⚠️
**FRONTEND IMAGE**: Still using old image with wrong backend service name!
**ROOT CAUSE**: Deployment hasn't pulled the updated Docker image yet.

**Current Problem**: Frontend pod is still using **old image** that points to wrong service name.

**Frontend Status**: ❌ **Using old image**
- Logs show: `blake-bibliography-backend.blake-bibliography.svc.cluster.local` 
- Should show: `backend.grantg.svc.cluster.local:8000`
- nginx config: ❌ Still using old backend service name

**Next Step**: ✅ **Force frontend to use updated image**

## Changes Made

### 1. Updated Docker Image ✅ **FIXED** 
- **Frontend Image**: `grantglass/blake-pdf-frontend:latest`
- **Backend Service**: Fixed to point to `backend.grantg.svc.cluster.local:8000`
- **Docker Hub**: Successfully pushed latest version with namespace fix
- **Build**: sha256:0a24f7d2047fe68900eff9c4af1bc8adda38485
- **Architecture**: Multi-platform (AMD64 + ARM64) - resolves "exec format error"

### 2. nginx Configuration Updates (`nginx-server.conf`) ✅ **FIXED**
```nginx
server {
    listen 8080;
    server_name _;
    
    # Document root for React build files
    root /usr/share/nginx/html;
    index index.html;
    
    # OpenShift DNS resolver for backend service discovery
    resolver 172.30.0.1 valid=10s;
    
    # Backend service variable - use correct service name from deployment
    set $backend "backend.grantg.svc.cluster.local:8000";

    # Security headers
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;

    # API proxy to backend service (must come before catch-all location)
    location /api/ {
        proxy_pass http://$backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts for large PDF responses
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
        proxy_send_timeout 300s;
        
        # Buffer sizes for large responses
        proxy_buffer_size 128k;
        proxy_buffers 4 256k;
        proxy_busy_buffers_size 256k;
    }

    # Static assets with caching  
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }
    
    # Handle React Router - serve index.html for all other routes
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### 3. Deployment Configuration Updates (`deployment.yaml`)
- **Removed**: `runAsUser: 1001` from frontend security context
- **Reason**: Conflicts with nginx-unprivileged image defaults
- **Current**: Uses nginx-unprivileged's built-in user configuration

## 🎯 **CREATE NEW DEPLOYMENTS FROM GIT REPOSITORY**

### **You're Right! Use "Import from Git" Instead**

Since "Container Image" only shows base images like Node.js/Python, we need to use **"Import from Git"** which will build your Docker images from the repository.

### **STEP 1: Create Frontend Deployment**

1. **Go to OpenShift Web Console**
2. **Navigate to `grantg` namespace**
3. **Click "+ Add" or "Add to Project"**
4. **Choose "Import from Git"**
5. **Enter Git Repository Details:**
   - **Git Repo URL**: `https://github.com/blakearchive/william-blake-bibliography-viewer.git`
   - **Git Reference**: `main` (or your current branch)
6. **Build Configuration:**
   - **Context Dir**: `frontend` 
   - **Dockerfile Path**: `Dockerfile`
7. **General Settings:**
   - **Application Name**: `blake-bibliography-viewer`
   - **Name**: `frontend`
8. **Advanced Options:**
   - **Target Port**: `8080`
   - **Create Route**: Yes
9. **Click "Create"**

### **STEP 2: Create Backend Deployment**

1. **Click "+ Add" again**
2. **Choose "Import from Git"**
3. **Enter Git Repository Details:**
   - **Git Repo URL**: `https://github.com/blakearchive/william-blake-bibliography-viewer.git`
   - **Git Reference**: `main`
6. **Build Configuration:**
   - **Context Dir**: `backend`
   - **Dockerfile Path**: `Dockerfile`
7. **General Settings:**
   - **Application Name**: `blake-bibliography-viewer`
   - **Name**: `backend`
8. **Advanced Options:**
   - **Target Port**: `8000`
   - **Create Route**: No
9. **Click "Create"**

### **STEP 3: Wait for Builds to Complete**

1. **Go to Builds → Builds**
2. **Watch both frontend and backend builds complete**
3. **Builds will use your Dockerfiles to create images with the fixed nginx config**

### **STEP 4: Fix Image Reference (CRITICAL)**

🚨 **IMPORTANT**: Even after "Import from Git", OpenShift may still reference the wrong image!

1. **Go to Workloads → Deployments**
2. **Find your `blake-frontend` deployment**
3. **Click on the deployment name**
4. **Go to "YAML" tab**
5. **Look for the `image:` field in the container spec**
6. **If you see**: `image-registry.openshift-image-registry.svc:5000/grantg/blake-frontend:latest`
7. **Replace with**: The actual built image from your Git build

**How to find the correct image:**
1. **Go to Builds → Builds**
2. **Click on your `blake-frontend` build**
3. **Go to "Output" tab** 
4. **Copy the full image reference** (should look like: `image-registry.openshift-image-registry.svc:5000/grantg/blake-frontend@sha256:...`)
5. **Go back to Workloads → Deployments → blake-frontend → YAML**
6. **Replace the `image:` field with the correct reference from the build output**

### **STEP 5: Check Deployments**

1. **Go to Workloads → Deployments**
2. **Verify both `frontend` and `backend` are listed and running**
3. **Go to Networking → Services**
4. **Confirm services exist:**
   - `frontend` service (port 8080)
   - `backend` service (port 8000)

### **STEP 6: Check Logs**

1. **Go to Workloads → Pods**
2. **Click on the frontend pod**
3. **Go to "Logs" tab**
4. **Expected Result:** Should show `backend.grantg.svc.cluster.local could not be resolved`
   - This confirms it built from your fixed Dockerfile with correct nginx config!

## 🔧 **TROUBLESHOOTING: Backend ImagePullBackOff Error**

If you see logs like:
```
Back-off pulling image "image-registry.openshift-image-registry.svc:5000/grantg/blake-backend:latest"
Pulling image "image-registry.openshift-image-registry.svc:5000/grantg/blake-backend:latest"
```

**This means the backend deployment is referencing the wrong image source!**

### **Root Cause:**
- The backend deployment is trying to pull from OpenShift's internal registry
- But you created it using "Import from Git" which should build from your repository
- The deployment got misconfigured to reference the wrong image

### **Fix Steps:**

**Step 1: Check Backend Build Status**
1. **Go to Builds → Builds** in OpenShift console
2. **Look for a build named `backend` or `blake-backend`**
3. **Check if the build completed successfully (green checkmark)**
4. **If no build exists or it failed, you need to create the backend from Git**

**Step 2: Create Backend from Git (if missing)**
1. **Click "+ Add"**
2. **Choose "Import from Git"**
3. **Git Repository Details:**
   - **Git Repo URL**: `https://github.com/blakearchive/william-blake-bibliography-viewer.git`
   - **Git Reference**: `main`
4. **Build Configuration:**
   - **Context Dir**: `backend` 
   - **Dockerfile Path**: `Dockerfile`
5. **General Settings:**
   - **Application Name**: `blake-bibliography-viewer`
   - **Name**: `backend`
6. **Advanced Options:**
   - **Target Port**: `8000`
   - **Create Route**: No
7. **Click "Create"**

**Step 3: Fix Existing Backend Deployment Image**
1. **Go to Workloads → Deployments**
2. **Find your backend deployment**
3. **Click on the deployment name**
4. **Go to "YAML" tab**
5. **Find the `image:` field in the container spec**
6. **If you see**: `image-registry.openshift-image-registry.svc:5000/grantg/blake-backend:latest`
7. **Replace with the correct built image:**
   - Go to **Builds → Builds**
   - Click on your `backend` build
   - Go to **"Output"** tab
   - Copy the full image reference (includes SHA)
   - Update the deployment YAML with this reference

### **IMMEDIATE ACTION FOR YOUR BACKEND:**

**Your Current Issue**: Backend deployment is trying to pull `image-registry.openshift-image-registry.svc:5000/grantg/blake-backend:latest` but this image doesn't exist.

**Quick Fix Options:**

**Option A: Fix the Existing Deployment (if you have a working build)**
1. **Go to Builds → Builds**
2. **Look for a `backend` build that completed successfully**
3. **If it exists:**
   - Click on the build → "Output" tab
   - Copy the full image reference (with SHA)
   - Go to **Workloads → Deployments → backend → YAML**
   - Replace the `image:` field with the correct reference
   - Save

**Option B: Delete and Recreate Backend (recommended)**
1. **Delete the broken backend deployment:**
   - Go to **Workloads → Deployments**
   - Find the backend deployment
   - Click **Actions → Delete**
2. **Create new backend from Git:**
   - Click **"+ Add"**
   - Choose **"Import from Git"**
   - **Git URL**: `https://github.com/blakearchive/william-blake-bibliography-viewer.git`
   - **Context Dir**: `backend`
   - **Application**: `blake-bibliography-viewer`
   - **Name**: `backend`
   - **Target Port**: `8000`
   - **Create Route**: No

**Expected Timeline:**
- Build will take 2-3 minutes
- Backend pod should start showing: `INFO: Uvicorn running on http://0.0.0.0:8000`
- Frontend should then connect successfully

**Step 4: Wait for Backend to Start**
After fixing the image reference, the backend should start properly and you'll see:
```
✅ INFO: Uvicorn running on http://0.0.0.0:8000
```

## 🎯 **CURRENT STATUS - IMMEDIATE ACTION NEEDED**

✅ **FRONTEND FIXED!** Your logs show:
```
backend.grantg.svc.cluster.local could not be resolved (110: Operation timed out)
```

This means the frontend nginx configuration is now correct and trying to connect to the right service name!

❌ **BACKEND SERVICE MISSING** - The `backend` service doesn't exist or isn't configured properly.

## 🎯 **CURRENT STATUS - SERVICE ISSUE CONFIRMED**

✅ **FRONTEND FIXED!** Your logs show:
```
backend.grantg.svc.cluster.local could not be resolved (110: Operation timed out)
```

✅ **BACKEND RUNNING!** Your logs show:
```
INFO: Uvicorn running on http://0.0.0.0:8000
```

❌ **BACKEND SERVICE MISSING!** - The backend pod is running but the Kubernetes service doesn't exist or is misconfigured.

### **ROOT CAUSE IDENTIFIED:**
- Backend pod: ✅ Running on port 8000
- Frontend nginx: ✅ Correctly configured to connect to `backend.grantg.svc.cluster.local:8000`
- **MISSING**: Kubernetes service to route traffic from frontend to backend pod

### **IMMEDIATE FIX - CREATE BACKEND SERVICE:**

**Step 1: Check Current Services**
1. **Go to Networking → Services** in OpenShift console
2. **Look for a service named exactly `backend`**
3. **You probably won't see it - that's the problem!**

## 🎯 **PROBLEM IDENTIFIED - MISMATCHED SERVICE SELECTORS!**

You now have **TWO services** but they have **different selectors**:

1. **Service**: `backend` with selector `app=backend, deployment=backend` 
2. **Service**: `blake-backend` with selector `app=blake-backend, deployment=blake-backend`

Your backend pod likely has labels `app=blake-backend` but your frontend is trying to connect to the `backend` service!

### **IMMEDIATE FIX - Update Service Selector:**

**Option A: Fix the `backend` Service (Recommended)**
1. **Go to Networking → Services**
2. **Click on the `backend` service**
3. **Go to YAML tab**
4. **Find the `selector:` section and change it to:**
```yaml
selector:
  app: blake-backend
  deployment: blake-backend
```
5. **Save the changes**

**Option B: Delete the Wrong Service**
1. **Go to Networking → Services**
2. **Delete the `backend` service** (it has wrong selectors)
3. **Keep only the `blake-backend` service**
4. **BUT** then you need to update your frontend nginx config to use `blake-backend.grantg.svc.cluster.local:8000`

## ❌ **STILL NOT WORKING - DNS RESOLUTION TIMEOUT**

Your latest logs show:
```
backend.grantg.svc.cluster.local could not be resolved (110: Operation timed out)
```

This means:
- ✅ **Frontend nginx config is correct** - it's trying to connect to the right service name
- ❌ **Backend service doesn't exist or has wrong configuration**

### **IMMEDIATE DEBUG STEPS:**

**Step 1: Check if Backend Service Exists**
1. **Go to OpenShift Console → Networking → Services**
2. **Look for a service named exactly `backend` in the `grantg` namespace**
3. **If you don't see it, the service doesn't exist!**

**Step 2: Check Backend Pod Status**
1. **Go to Workloads → Pods**
2. **Look for a backend pod (should show Uvicorn logs)**
3. **Note the pod labels** (likely `app=blake-backend`)

**Step 3: Create or Fix Backend Service**

**Option A: If No Backend Service Exists**
1. **Go to Networking → Services → Create Service**
2. **Use this YAML:**
```yaml
apiVersion: v1
kind: Service
metadata:
  name: backend
  namespace: grantg
spec:
  ports:
  - port: 8000
    targetPort: 8000
    protocol: TCP
  selector:
    app: blake-backend
    deployment: blake-backend
```

**Option B: If Backend Service Exists But Wrong Selector**
1. **Click on the existing backend service**
2. **Go to YAML tab**
3. **Update the selector to match your pod labels:**
```yaml
selector:
  app: blake-backend
  deployment: blake-backend
```

### **CORRECT ANALYSIS - YOU'RE RIGHT!**

You're absolutely correct! Let me clarify the services:

1. **`blake-backend` service** - This IS your actual backend server ✅ (KEEP THIS!)
2. **`backend` service** - This is the duplicate service I mistakenly had you create ❌ (DELETE THIS!)

**The Real Problem**: Your frontend nginx config points to `backend.grantg.svc.cluster.local:8000` but your actual backend service is named `blake-backend`.

### **CORRECT FIX OPTIONS:**

**Option 1: Delete the Duplicate Service (Recommended)**
1. **Go to Networking → Services**
2. **Delete the `backend` service** (the duplicate one I had you create)
3. **Keep the `blake-backend` service** (your real backend)
4. **But then we need to update your frontend nginx config**

**Option 2: Rename Your Real Backend Service**
1. **Go to Networking → Services**
2. **Click on `blake-backend` service**
3. **Go to YAML tab**
4. **Change the metadata name from `blake-backend` to `backend`:**
```yaml
metadata:
  name: backend  # Change from blake-backend to backend
```
5. **Also fix the port from 8080 to 8000**

### **KUBERNETES ERROR: Cannot Rename Services!**

You got this error:
```
Cannot change resource name (original: "blake-backend", updated: "backend").
```

**This is normal!** Kubernetes doesn't allow renaming services directly. Here's the correct approach:

### **FINAL FIX - Two Simple Options:**

**Option 1: Update Frontend to Use Existing Service (Easiest)**
Since your real backend service is `blake-backend` on port 8080, we need to update your frontend nginx config to match:

1. **The frontend needs to connect to**: `blake-backend.grantg.svc.cluster.local:8080`
2. **But your frontend is currently configured for**: `backend.grantg.svc.cluster.local:8000`

**Quick Fix**: Update your backend service port from 8080 to 8000:
1. **Go to Networking → Services**
2. **Click on `blake-backend` service**
3. **Go to YAML tab**
4. **Change the port:**
```yaml
spec:
  ports:
  - port: 8000  # Change from 8080 to 8000
    targetPort: 8000  # Make sure this matches your backend pod port
```

**Option 2: Create New Service and Delete Old One**
1. **Create a new service named `backend`** (using the YAML I provided earlier)
2. **Delete the old `blake-backend` service**
3. **This way your frontend config works without changes**

### **STILL NOT WORKING - NEED TO FIX SERVICE NAME MISMATCH**

The error shows your frontend is still trying to connect to:
```
backend.grantg.svc.cluster.local could not be resolved
```

But your actual service is named `blake-backend`, not `backend`!

### **FINAL FIX - Two Options:**

**Option A: Create a New Service Named `backend` (Easiest)**
1. **Go to Networking → Services → Create Service**
2. **Use this YAML:**
```yaml
apiVersion: v1
kind: Service
metadata:
  name: backend
  namespace: grantg
spec:
  ports:
  - port: 8000
    targetPort: 8000
    protocol: TCP
  selector:
    app: blake-backend
    deployment: blake-backend
```
3. **This creates a second service named `backend` that points to your same backend pod**
4. **Keep your existing `blake-backend` service too - both will work**

**Option B: Update Frontend nginx Config to Use `blake-backend`**
1. **Edit your frontend code to change the backend URL**
2. **In your nginx config, change:**
   ```nginx
   set $backend "blake-backend.grantg.svc.cluster.local:8000";
   ```
3. **Rebuild and redeploy the frontend**

### **YOU'RE RIGHT - WE ALREADY TRIED THAT!**

We already tried creating a service named `backend` and it didn't work. The real issue is likely that:

1. **Either the `backend` service exists but has wrong selectors**
2. **Or there's still a duplicate/conflicting service**

### **FINAL DEBUG - Let's Check What Actually Exists:**

**Step 1: List ALL Services**
In OpenShift console, go to **Networking → Services** and tell me:
- How many services do you see?
- What are their exact names?
- What ports do they have?

**Step 2: Check the `backend` Service (if it exists)**
If you see a service named `backend`:
1. **Click on it**
2. **Go to YAML tab**
3. **Check the `selector:` section**
4. **Does it say `app: backend` or `app: blake-backend`?**

**Step 3: Check Backend Pod Labels**
1. **Go to Workloads → Pods**
2. **Click on your backend pod** (the one with Uvicorn logs)
3. **Go to Details tab**
4. **What labels does it show?** (e.g., `app=blake-backend`)

### **Most Likely Fix:**
The `backend` service probably exists but has the wrong selector. It needs to match your pod labels exactly.

**Tell me what you find and I'll give you the exact fix!**

## 🚨 **CURRENT STATUS - STILL NOT CONNECTING**

Your logs still show:
```
backend.grantg.svc.cluster.local could not be resolved (110: Operation timed out)
```

This means the `backend` service selector fix didn't work. Let's debug this step by step:

### **IMMEDIATE DEBUG STEPS:**

**Step 1: Check What Labels Your Backend Pod Actually Has**
1. **Go to Workloads → Pods**
2. **Find your backend pod** (the one with Uvicorn logs)
3. **Click on the pod name**
4. **Go to "Details" tab**
5. **Look at the "Labels" section**
6. **Write down ALL the labels** (e.g., `app=blake-backend`, `deployment=blake-backend`, etc.)

**Step 2: Check Your Service Selector**
1. **Go to Networking → Services**
2. **Click on the `backend` service**
3. **Go to "YAML" tab**
4. **Look at the `selector:` section**
5. **Make sure it EXACTLY matches the pod labels from Step 1**

**Step 3: Most Likely Fix**
Your backend pod probably has these labels:
```
app: blake-backend
deployment: blake-backend
```

But your `backend` service selector probably still has:
```
selector:
  app: backend
  deployment: backend
```

**Fix this by updating the service YAML to:**
```yaml
selector:
  app: blake-backend
  deployment: blake-backend
```

### **Alternative Quick Fix:**
If the service selector is still wrong, try this:

1. **Delete the `backend` service entirely**
2. **Go to Workloads → Pods → Click on your backend pod → Actions**
3. **Look for "Expose" or any service creation option**
4. **Create a new service with name `backend` and port `8000`**

### **After Fixing:**
The frontend should immediately start working! Your application will be fully functional.

### **RECOMMENDED: Use Option A**
Fix the `backend` service selector to match your pod labels (`app=blake-backend`). This way you don't have to change the frontend configuration.

## � **PROGRESS! FRONTEND NOW CONNECTING TO CORRECT SERVICE**

✅ **SUCCESS**: Your logs now show:
```
blake-backend.grantg.svc.cluster.local could not be resolved (110: Operation timed out)
```

**This confirms:**
- ✅ Frontend nginx config is correct
- ✅ Frontend rebuild worked  
- ✅ Frontend is trying to connect to `blake-backend` service

## 🎯 **FINAL ISSUE: SERVICE NAMESPACE MISMATCH**

The DNS resolution timeout suggests your `blake-backend` service is not in the `grantg` namespace.

### **IMMEDIATE DEBUG STEPS:**

**Step 1: Check Service Namespace**
1. **Go to OpenShift Console → Networking → Services**
2. **Make sure you're in the `grantg` namespace (top of page)**
3. **Look for `blake-backend` service**
4. **If you don't see it, the service is in a different namespace!**

**Step 2: Find Your Backend Service**
1. **Switch to "All Projects" or check other namespaces**
2. **Look for `blake-backend` service**
3. **Note which namespace it's in**

**Step 3: Fix the Namespace Issue**

**Option A: Move Service to grantg Namespace (Recommended)**
If your service is in a different namespace (e.g., `blake-bibliography`):
1. **Go to the namespace where `blake-backend` exists**
2. **Export the service YAML**
3. **Change the namespace to `grantg`**
4. **Create the service in `grantg` namespace**

**Option B: Update Frontend Config**
If your service is in namespace `blake-bibliography`:
1. **Update nginx config to**: `blake-backend.blake-bibliography.svc.cluster.local:8000`
2. **Rebuild frontend**

### **QUICK CHECK:**
Can you please check:
1. **What namespace is your `blake-backend` service in?**
2. **What namespace is your frontend pod in?**

Once we align the namespaces, your application will work immediately!

```yaml
apiVersion: v1
kind: Service
metadata:
  name: backend
  namespace: grantg
spec:
  ports:
  - port: 8000
    targetPort: 8000
    protocol: TCP
  selector:
    app: blake-backend
    deployment: blake-backend
```

### **Immediate Steps:**

**Step 1: Create the Additional Service (Quick Fix)**
1. **Go to Networking → Services → Create Service**
2. **Use YAML view and paste the above configuration**
3. **This creates a `backend` service that points to your existing `blake-backend` pods**

**Step 2: Verify the Fix**
1. **Check that you now have TWO services**:
   - `blake-backend` (your original working service)
   - `backend` (the new service for frontend compatibility)
2. **Both services will point to the same pods**
3. **Frontend should immediately start connecting successfully**

**Expected Result:**
- Frontend logs change from: `backend.grantg.svc.cluster.local could not be resolved`
- To: Successful HTTP 200 responses and working application

### **Long-term Fix (Update Repository):**
After verifying the quick fix works, update your repository:
1. **Edit `frontend/nginx.conf`** to use `blake-backend.grantg.svc.cluster.local:8000`
2. **Delete the temporary `backend` service**
3. **Rebuild frontend from updated repository**

### **IMMEDIATE NEXT STEPS:**

**Step 1: Check if Backend Service Exists**
1. **Go to Networking → Services** in OpenShift console
2. **Look for a service named exactly `backend`**
3. **If you don't see it, continue to Step 2**

**Step 2: Check if Backend Pod Exists**
1. **Go to Workloads → Pods**
2. **Look for a pod with name starting with `backend-`**
3. **If you see it, check the logs to confirm it's running**
4. **If you don't see it, you need to create the backend deployment**

**Step 3: Create Backend Service (if missing)**
If the backend pod exists but no service:
1. **Go to Workloads → Pods**
2. **Click on the backend pod**
3. **Go to Actions → Create Service**
4. **Configure:**
   - **Service Name**: `backend`
   - **Port**: `8000`
   - **Target Port**: `8000`

**Step 4: Create Backend Deployment (if missing)**
If no backend pod exists:
1. **Follow the "Create Backend from Git" instructions below**

## 🔧 **TROUBLESHOOTING: Backend Running But Frontend Can't Connect**

If you see:
- ✅ **Backend logs**: `INFO: Uvicorn running on http://0.0.0.0:8000`
- ❌ **Frontend logs**: `backend.grantg.svc.cluster.local could not be resolved`

**This means the backend pod is running but the SERVICE is not properly configured!**

### **Check Backend Service Creation:**

1. **Go to Networking → Services** in OpenShift console
2. **Look for a service named `backend`**
3. **If you don't see it, or if it exists but has wrong configuration:**

### **Fix Steps:**

**Option 1: Check Service Configuration**
1. **Go to Networking → Services**
2. **Click on the `backend` service (if it exists)**
3. **Verify:**
   - **Name**: Should be `backend` (not `blake-backend`)  
   - **Port**: Should be `8000`
   - **Target Port**: Should be `8000`
   - **Selector**: Should match the backend pod labels

**Option 2: Manual Service Creation (if missing)**
1. **Go to Workloads → Pods**
2. **Find your backend pod** 
3. **Click on the pod name**
4. **Go to "Actions" → "Create Service"**
5. **Configure:**
   - **Service Name**: `backend`
   - **Port**: `8000`
   - **Target Port**: `8000`

**Option 3: Check Service Labels/Selectors**
The service must have selectors that match the backend pod labels exactly.

### **Expected Service Configuration:**
```yaml
apiVersion: v1
kind: Service
metadata:
  name: backend
  namespace: grantg
spec:
  ports:
  - port: 8000
    targetPort: 8000
    protocol: TCP
  selector:
    app: backend  # Must match backend pod labels
```

### **Verification:**
After fixing the service, the frontend logs should change from:
```
❌ backend.grantg.svc.cluster.local could not be resolved
```
To:
```
✅ HTTP 200 responses or successful API calls
```

## 🔧 **TROUBLESHOOTING: Container Restart/Failure Issues**

If you see errors like:
```
Back-off restarting failed container blake-frontend in pod blake-frontend-6cb47d655c-j8lvz_grantg
Started container blake-frontend
Successfully pulled image "image-registry.openshift-image-registry.svc:5000/grantg/blake-frontend@sha256:877d3be6e04fc2f48ffe36b7446b2d3a735da5abfac04c7897c32528bc1251d3"
```

**This means the image pulls successfully but the container fails to start properly!**

### **CRITICAL FIX: Duplicate PID Directive Issue** ✅ **RESOLVED**

**Problem**: nginx fails to start with `"pid" directive is duplicate in /etc/nginx/nginx.conf:3`
**Root Cause**: Both `nginx.conf` and `start-nginx.sh` were trying to set the `pid` directive
**Fix Applied**: Removed `pid` directive from startup script, use the one in `nginx.conf`

**OLD (Broken)**:
```bash
exec nginx -g "daemon off; pid /dev/null;"
```

**NEW (Fixed)**:
```bash
exec nginx -g "daemon off;"
```

**Status**: ✅ Fixed and pushed to repository (commit: 6f37354)

### **CRITICAL FIX: Main nginx.conf Backend Service Name** ✅ **RESOLVED**

**Problem**: Logs show `blake-bibliography-backend could not be resolved` instead of `backend.grantg.svc.cluster.local`
**Root Cause**: The main `nginx.conf` file had the old backend service name, overriding the correct `nginx-server.conf`
**Fix Applied**: Updated `nginx.conf` to use the correct backend service name

**OLD (Broken)**:
```nginx
set $backend "blake-bibliography-backend:8000";
```

**NEW (Fixed)**:
```nginx
set $backend "backend.grantg.svc.cluster.local:8000";
```

**Status**: ✅ Fixed and pushed to repository (commit: 5f2848c)

### **IMMEDIATE ACTION REQUIRED:**

1. **Trigger New Build**: In OpenShift console:
   - Go to **Builds → BuildConfigs**
   - Click on `blake-frontend`
   - Click **"Start Build"** to build with the nginx config fix

2. **Wait for Build**: The new build will pull the latest Git commit with the correct backend service name

3. **Update Deployment**: Once the new build completes, update the deployment to use the new image

4. **Expected Result**: Logs should change from:
   ```
   ❌ blake-bibliography-backend could not be resolved
   ```
   To:
   ```
   ✅ backend.grantg.svc.cluster.local could not be resolved
   ```

### **CRITICAL FIX: nginx Startup Script Issue** ✅ **RESOLVED**

**Problem**: Container shows "Starting nginx with OpenShift-compatible configuration..." then crashes
**Root Cause**: The `start-nginx.sh` script had conflicting nginx `-g` flags
**Fix Applied**: Combined the daemon and pid directives into a single `-g` flag

**OLD (Broken)**:
```bash
exec nginx -g "daemon off;" -g "pid /dev/null;"
```

**NEW (Fixed)**:
```bash
exec nginx -g "daemon off; pid /dev/null;"
```

**Status**: ✅ Fixed and pushed to repository (commit: 3a2e79f)

### **Next Steps:**

1. **Trigger New Build**: In OpenShift console:
   - Go to **Builds → BuildConfigs**
   - Click on `blake-frontend`
   - Click **"Start Build"** to build with the fix

2. **Wait for Build**: The new build will pull the latest Git commit with the nginx fix

3. **Update Deployment**: Once the new build completes, update the deployment to use the new image (follow same process as before)

### **Immediate Debug Steps:**

1. **Check Container Logs:**
   - Go to **Workloads → Pods**
   - Click on the failing pod (e.g., `blake-frontend-6cb47d655c-j8lvz`)
   - Go to **"Logs"** tab
   - Look for startup errors, nginx errors, or permission issues

2. **Check Container Events:**
   - In the same pod view, go to **"Events"** tab
   - Look for specific error messages about why the container is failing

3. **Common Issues to Look For:**
   - **Permission errors**: nginx can't start due to file permissions
   - **Port binding issues**: nginx can't bind to port 8080
   - **Configuration errors**: nginx config syntax errors
   - **Missing files**: nginx can't find required files
   - **Script execution errors**: start-nginx.sh script issues

### **Likely Fix Needed:**

Based on the build output showing `USER 101` in the Dockerfile, this might be a permission conflict. Check if the logs show something like:
- `nginx: [emerg] bind() to 0.0.0.0:8080 failed (13: Permission denied)`
- Permission denied errors
- File not found errors

### **Quick Fix Options:**

**Option 1: Check if nginx config is correct**
```bash
# Check what files are in the container
oc exec -it <pod-name> -- ls -la /etc/nginx/
oc exec -it <pod-name> -- ls -la /usr/share/nginx/html/
```

**Option 2: Test nginx config syntax**
```bash
# Test nginx configuration
oc exec -it <pod-name> -- nginx -t
```

**Option 3: Check startup script**
```bash
# Check if start script exists and is executable
oc exec -it <pod-name> -- ls -la /usr/local/bin/start-nginx.sh
```

## 🔧 **TROUBLESHOOTING: ImagePullBackOff Error**

If you see errors like:
```
Back-off pulling image "image-registry.openshift-image-registry.svc:5000/grantg/blake-frontend:latest"
Error: ImagePullBackOff
```

**This means the deployment is referencing the wrong image!**

### **Fix Steps:**

1. **Check Build Status:**
   - Go to **Builds → Builds**
   - Find your `blake-frontend` build
   - Ensure it completed successfully (green checkmark)

2. **Get Correct Image Reference:**
   - Click on the successful build
   - Go to **"Output"** tab
   - Copy the full image reference (includes SHA)
   - Example: `image-registry.openshift-image-registry.svc:5000/grantg/blake-frontend@sha256:abc123...`

3. **Update Deployment:**
   - Go to **Workloads → Deployments**
   - Click on `blake-frontend` deployment
   - Click **"YAML"** tab
   - Find the `image:` field in containers section
   - Replace with the correct image reference from step 2
   - Click **"Save"**

4. **Alternative: Use CLI:**
   ```bash
   # Get the correct image from build
   oc get build blake-frontend-1 -o jsonpath='{.status.outputDockerImageReference}'
   
   # Update deployment with correct image
   oc patch deployment blake-frontend -p '{"spec":{"template":{"spec":{"containers":[{"name":"blake-frontend","image":"<IMAGE_FROM_ABOVE>"}]}}}}'
   ```

### **🚨 IMPORTANT: Use "Import from Git" with Dockerfile Path**

When creating deployments:

✅ **USE:**
- **"Import from Git"** option
- **Context Dir**: `frontend` and **Dockerfile Path**: `Dockerfile` (for frontend)
- **Context Dir**: `backend` and **Dockerfile Path**: `Dockerfile` (for backend)
- **Git URL**: `https://github.com/blakearchive/william-blake-bibliography-viewer.git`

❌ **DON'T USE:**
- **"Container Image"** (only has base images)
- **"Builder Image"** (only has base images like Node.js/Python)

**Why:** This builds from your repository using your fixed Dockerfiles, creating images with the correct nginx configuration.

### **Verification Steps**

After making the changes:

1. **Check Pod Status**: Go to Workloads → Pods
   - New pods should be in "Running" status
   - Look for recent creation timestamps

2. **Check Logs**: Click on frontend pod → "Logs" tab
   - **SUCCESS**: Should show `backend.grantg.svc.cluster.local could not be resolved`
   - **STILL BROKEN**: Shows `blake-bibliography-backend.blake-bibliography.svc.cluster.local`

3. **Test Application**: Visit https://frontend-grantg.apps.cloudapps.unc.edu
   - Should load the React app
   - API calls should work once backend is running

## Manual Deployment Steps

### Option 1: Using OpenShift Web Console ⭐ **RECOMMENDED**
1. Login to OpenShift Web Console
2. Navigate to the `grantg` namespace (based on your error logs)
3. Go to Workloads → Deployments  
4. Find the frontend deployment (likely named `frontend` based on error)
5. Edit the deployment YAML or use the form editor
6. **CRITICAL**: Update the container image from:
   - **OLD**: `image-registry.openshift-image-registry.svc:5000/grantg/frontend:latest`
   - **NEW**: `grantglass/blake-pdf-frontend:latest`
7. In the container spec, update the security context to remove `runAsUser: 1001`
8. Save changes
9. OpenShift will automatically trigger a new deployment with correct image

### Option 2: Using kubectl/oc CLI
```bash
# Update the deployment to use the correct image
oc patch deployment frontend -n grantg -p '{"spec":{"template":{"spec":{"containers":[{"name":"frontend","image":"grantglass/blake-pdf-frontend:latest"}]}}}}'

# Remove the runAsUser security context if present
oc patch deployment frontend -n grantg -p '{"spec":{"template":{"spec":{"containers":[{"name":"frontend","securityContext":{"runAsUser":null}}]}}}}'

# Check rollout status
oc rollout status deployment/frontend -n grantg
```

### Option 3: Force Pod Recreation
If you have access to the OpenShift console or CLI:
```bash
# Delete existing pods to force recreation with new image (after updating deployment)
oc delete pods -l app=frontend -n grantg
```

## Verification Steps

### 1. Verify Frontend Image Update
```bash
# Check if frontend is using new image
oc describe deployment frontend -n grantg | grep Image

# Should show: grantglass/blake-pdf-frontend:latest
```

### 2. Check Frontend Logs After Update
```bash
# Watch logs for new error message
oc logs -f deployment/frontend -n grantg

# OLD (wrong): blake-bibliography-backend.blake-bibliography.svc.cluster.local
# NEW (correct): backend.grantg.svc.cluster.local could not be resolved
```

### 3. Check Services in Namespace
```bash
# List all services in grantg namespace
oc get services -n grantg

# Should see:
# frontend service (✅ exists)
# backend service (❌ deploy after frontend image update)
```

### 4. After Full Deployment
```bash
# Check both services are running
oc get pods -n grantg
oc get services -n grantg

# Test the application
# Visit: https://frontend-grantg.apps.cloudapps.unc.edu
```

## Expected Results

### ❌ Current Status (Wrong Image Running)
- ❌ Frontend using old image with wrong backend service name
- ❌ Logs show: `blake-bibliography-backend.blake-bibliography.svc.cluster.local`
- ❌ API calls return HTTP 502 "Bad Gateway"

### ✅ After Frontend Image Update (Intermediate)
- ✅ Frontend using new image with correct backend service name  
- ✅ Logs show: `backend.grantg.svc.cluster.local could not be resolved`
- ❌ API calls still return HTTP 502 (backend doesn't exist yet)

### ✅ After Backend Deployment (Final Success)
- ✅ Frontend connects to backend successfully
- ✅ API calls return HTTP 200 responses
- ✅ PDF content loads and displays
- ✅ Search functionality works
- ✅ Full application functionality restored

## Troubleshooting

### If Issues Persist:
1. **Check Image Pull**: Ensure `grantglass/blake-pdf-frontend:latest` is pulling correctly
2. **Verify Namespace**: Confirm deployment is in `grantg` namespace (based on your logs)
3. **Check Image Name**: Make sure you're NOT using the internal registry path:
   - ❌ **WRONG**: `image-registry.openshift-image-registry.svc:5000/grantg/frontend:latest`
   - ✅ **CORRECT**: `grantglass/blake-pdf-frontend:latest`
4. **Check Security Context**: Ensure `runAsUser: 1001` is removed from frontend deployment
5. **Review Logs**: Look for nginx configuration errors or startup issues

### Common Issues:
- **Image not updating**: Try `oc rollout restart` or delete pods to force recreation
- **Permission errors**: Verify security context changes are applied
- **Config not found**: Confirm nginx-server.conf is properly copied in Docker image

## Technical Notes
- **nginx-unprivileged**: Handles user permissions automatically, no manual USER directive needed
- **Server Block Config**: Uses conf.d/default.conf instead of overriding entire nginx.conf
- **React Router**: Configured with `try_files $uri $uri/ /index.html` pattern
- **Backend Service**: Uses fully qualified service name for proper DNS resolution

## Success Indicators
- No "rewrite or internal redirection cycle" messages in nginx logs
- HTTP 200 responses for `/`, `/search`, and other React routes
- Proper fallback to index.html for client-side routing
- API proxy working correctly to backend service
