#!/bin/bash

# Production deployment script for webhook-to-telegram
# Usage: ./deploy.sh [options]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="webhook-to-telegram"
COMPOSE_FILE="docker-compose.prod.yml"

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_requirements() {
    log_info "Checking requirements..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed or not in PATH"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed or not in PATH"
        exit 1
    fi
    
    if [ ! -f "$COMPOSE_FILE" ]; then
        log_error "Docker Compose file $COMPOSE_FILE not found"
        exit 1
    fi
    
    log_info "Requirements check passed"
}

setup_environment() {
    log_info "Setting up environment..."
    
    # Create .env file if it doesn't exist
    if [ ! -f ".env" ]; then
        log_warn ".env file not found, creating from template..."
        if [ -f ".env.example" ]; then
            cp .env.example .env
            log_warn "Please edit .env file with your configuration before running again"
            exit 1
        else
            log_error ".env.example file not found"
            exit 1
        fi
    fi
    
    # Create required directories
    mkdir -p data logs logs/nginx nginx/ssl
    
    # Set proper permissions
    chmod 755 data logs
    
    log_info "Environment setup completed"
}

build_and_deploy() {
    log_info "Building and deploying $PROJECT_NAME..."
    
    # Pull latest images
    log_info "Pulling latest base images..."
    docker-compose -f $COMPOSE_FILE pull
    
    # Build the application
    log_info "Building application..."
    docker-compose -f $COMPOSE_FILE build --no-cache
    
    # Stop existing containers
    log_info "Stopping existing containers..."
    docker-compose -f $COMPOSE_FILE down
    
    # Start new containers
    log_info "Starting new containers..."
    docker-compose -f $COMPOSE_FILE up -d
    
    log_info "Deployment completed successfully"
}

deploy_with_nginx() {
    log_info "Deploying with nginx reverse proxy..."
    
    # Build and deploy main app
    build_and_deploy
    
    # Start nginx
    log_info "Starting nginx reverse proxy..."
    docker-compose -f $COMPOSE_FILE --profile nginx up -d
    
    log_info "Deployment with nginx completed"
}

show_status() {
    log_info "Checking deployment status..."
    
    docker-compose -f $COMPOSE_FILE ps
    
    echo ""
    log_info "Logs (last 20 lines):"
    docker-compose -f $COMPOSE_FILE logs --tail=20
    
    echo ""
    log_info "Health check:"
    if docker-compose -f $COMPOSE_FILE exec webhook-to-telegram curl -f http://localhost:3000/ &>/dev/null; then
        log_info "✅ Application is healthy"
    else
        log_error "❌ Application health check failed"
    fi
}

cleanup() {
    log_info "Cleaning up Docker resources..."
    
    # Remove stopped containers
    docker container prune -f
    
    # Remove unused images
    docker image prune -f
    
    # Remove unused volumes (be careful with this)
    # docker volume prune -f
    
    log_info "Cleanup completed"
}

show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -h, --help     Show this help message"
    echo "  -c, --check    Check requirements only"
    echo "  -b, --build    Build and deploy without nginx"
    echo "  -n, --nginx    Deploy with nginx reverse proxy"
    echo "  -s, --status   Show deployment status"
    echo "  -l, --logs     Show container logs"
    echo "  --cleanup      Clean up Docker resources"
    echo "  --stop         Stop all containers"
    echo "  --restart      Restart all containers"
}

# Main script
case "$1" in
    -h|--help)
        show_help
        ;;
    -c|--check)
        check_requirements
        ;;
    -b|--build)
        check_requirements
        setup_environment
        build_and_deploy
        ;;
    -n|--nginx)
        check_requirements
        setup_environment
        deploy_with_nginx
        ;;
    -s|--status)
        show_status
        ;;
    -l|--logs)
        docker-compose -f $COMPOSE_FILE logs -f
        ;;
    --cleanup)
        cleanup
        ;;
    --stop)
        log_info "Stopping all containers..."
        docker-compose -f $COMPOSE_FILE down
        ;;
    --restart)
        log_info "Restarting all containers..."
        docker-compose -f $COMPOSE_FILE restart
        ;;
    *)
        log_info "Starting default deployment..."
        check_requirements
        setup_environment
        build_and_deploy
        show_status
        ;;
esac
