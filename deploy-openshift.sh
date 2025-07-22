#!/bin/bash

# OpenShift Deployment Script for William Blake Bibliography Viewer
set -e

echo "🚀 Deploying William Blake Bibliography Viewer to OpenShift..."

# Configuration
PROJECT_NAME="blake-bibliography"
APP_NAME="blake-bibliography"
GITHUB_REPO="https://github.com/blakearchive/william-blake-bibliography-viewer.git"

# Check if oc CLI is installed
if ! command -v oc &> /dev/null; then
    echo "❌ OpenShift CLI (oc) is not installed. Please install it first:"
    echo "   https://docs.openshift.com/container-platform/latest/cli_reference/openshift_cli/getting-started-cli.html"
    exit 1
fi

# Check if logged into OpenShift
if ! oc whoami &> /dev/null; then
    echo "❌ Not logged into OpenShift. Please login first:"
    echo "   oc login <your-openshift-cluster-url>"
    exit 1
fi

echo "✅ OpenShift CLI ready"
echo "👤 Logged in as: $(oc whoami)"
echo "🌐 Cluster: $(oc cluster-info --short | head -1)"

# Create or switch to project
echo "📁 Creating/switching to project: $PROJECT_NAME"
oc new-project $PROJECT_NAME 2>/dev/null || oc project $PROJECT_NAME

# Apply the manifests
echo "🔧 Applying OpenShift manifests..."
oc apply -f openshift/

# Start builds
echo "🏗️  Starting builds..."
oc start-build blake-bibliography-backend --follow
oc start-build blake-bibliography-frontend --follow

# Wait for deployments
echo "⏳ Waiting for deployments to be ready..."
oc rollout status deployment/blake-bibliography-backend --timeout=300s
oc rollout status deployment/blake-bibliography-frontend --timeout=300s

# Get the route URL
echo "🌍 Getting application URL..."
ROUTE_URL=$(oc get route $APP_NAME -o jsonpath='{.spec.host}' 2>/dev/null || echo "Route not found")

if [[ "$ROUTE_URL" != "Route not found" ]]; then
    echo "✅ Deployment successful!"
    echo "🔗 Application URL: https://$ROUTE_URL"
    echo ""
    echo "📊 Application status:"
    oc get pods -l app=blake-bibliography-backend,app=blake-bibliography-frontend
    echo ""
    echo "🔍 To check logs:"
    echo "   Backend:  oc logs -l app=blake-bibliography-backend"
    echo "   Frontend: oc logs -l app=blake-bibliography-frontend"
    echo ""
    echo "🛠️  To manage the application:"
    echo "   oc get all -l app=blake-bibliography-backend,app=blake-bibliography-frontend"
else
    echo "⚠️  Deployment completed but route not found. Check manually:"
    echo "   oc get routes"
fi

echo "🎉 OpenShift deployment complete!"
