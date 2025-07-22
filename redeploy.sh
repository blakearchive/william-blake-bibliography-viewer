#!/bin/bash

# Script to redeploy Blake PDF Viewer to OpenShift
# This script should be run from a machine with oc CLI access to the OpenShift cluster

echo "Redeploying Blake PDF Viewer with updated frontend configuration..."

# Apply the updated deployment configuration
oc apply -f openshift/deployment.yaml

# Force a rollout restart to pull the latest images
echo "Restarting frontend deployment to pull latest image..."
oc rollout restart deployment blake-bibliography-frontend -n blake-bibliography

echo "Restarting backend deployment to pull latest image..."
oc rollout restart deployment blake-bibliography-backend -n blake-bibliography

# Wait for rollout to complete
echo "Waiting for deployments to complete..."
oc rollout status deployment blake-bibliography-frontend -n blake-bibliography
oc rollout status deployment blake-bibliography-backend -n blake-bibliography

# Get the route URL
echo "Getting application URL..."
oc get route blake-bibliography -n blake-bibliography -o jsonpath='{.spec.host}'
echo

echo "Deployment completed! Check the application URL above."
echo
echo "To check pod status:"
echo "oc get pods -n blake-bibliography"
echo
echo "To check logs:"
echo "oc logs -f deployment/blake-bibliography-frontend -n blake-bibliography"
echo "oc logs -f deployment/blake-bibliography-backend -n blake-bibliography"
