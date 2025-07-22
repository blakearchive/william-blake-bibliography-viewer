#!/bin/bash

echo "🔧 FIXING FRONTEND AND BACKEND DEPLOYMENTS"
echo "=========================================="

echo ""
echo "STEP 1: Force Frontend Pod Recreation"
echo "-------------------------------------"
echo "The deployment shows correct image but pod is running old one"
echo "Deleting frontend pod to force recreation..."

oc delete pods -l app=frontend -n grantg

echo "Waiting for new pod to start..."
sleep 10

echo ""
echo "STEP 2: Remove Backend ImageStream Trigger"
echo "------------------------------------------"
echo "Backend has ImageStream trigger overriding Docker Hub image"
echo "Removing trigger annotation..."

oc patch deployment backend -n grantg -p '{"metadata":{"annotations":{"image.openshift.io/triggers":"[]"}}}'

echo "Forcing backend to use Docker Hub image..."
oc patch deployment backend -n grantg -p '{"spec":{"template":{"spec":{"containers":[{"name":"backend","image":"grantglass/blake-pdf-backend:latest","imagePullPolicy":"Always"}]}}}}'

echo "Restarting backend deployment..."
oc rollout restart deployment/backend -n grantg

echo ""
echo "STEP 3: Monitoring Progress"
echo "---------------------------"
echo "Checking frontend rollout status..."
oc rollout status deployment/frontend -n grantg --timeout=120s

echo "Checking backend rollout status..."
oc rollout status deployment/backend -n grantg --timeout=120s

echo ""
echo "STEP 4: Verification"
echo "--------------------"
echo "Frontend logs (should show 'backend.grantg.svc.cluster.local'):"
echo "================================================================"
oc logs deployment/frontend -n grantg --tail=10

echo ""
echo "Backend logs:"
echo "============="
oc logs deployment/backend -n grantg --tail=10

echo ""
echo "Pod status:"
echo "==========="
oc get pods -n grantg

echo ""
echo "🎯 EXPECTED RESULT:"
echo "Frontend logs should now show: 'backend.grantg.svc.cluster.local could not be resolved'"
echo "This confirms the frontend is using the updated image with correct backend service name."
echo ""
echo "Test the application: https://frontend-grantg.apps.cloudapps.unc.edu"
