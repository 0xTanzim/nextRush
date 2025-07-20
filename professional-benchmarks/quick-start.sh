#!/bin/bash

# 🚀 Professional Benchmarks Quick Start
# Complete setup and first benchmark run

set -e

echo "🚀 NextRush Professional Benchmarks Setup"
echo "=========================================="

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}📦 Installing dependencies...${NC}"
npm install

echo -e "${BLUE}🛠️ Installing benchmarking tools...${NC}"
chmod +x scripts/install-tools.sh
./scripts/install-tools.sh

echo -e "${BLUE}🔧 Building NextRush framework...${NC}"
cd ../
pnpm run build
cd professional-benchmarks

echo -e "${BLUE}📊 Running initial benchmark...${NC}"
node src/orchestrator.js --framework=nextrush --tools=autocannon

echo ""
echo -e "${GREEN}🎉 Setup complete!${NC}"
echo ""
echo -e "${YELLOW}Available commands:${NC}"
echo -e "${YELLOW}  npm run benchmark                  # Full benchmark suite${NC}"
echo -e "${YELLOW}  npm run benchmark:nextrush         # Test only NextRush${NC}"
echo -e "${YELLOW}  npm run benchmark:compare          # Compare frameworks${NC}"
echo -e "${YELLOW}  npm run profile                    # Performance profiling${NC}"
echo ""
echo -e "${BLUE}📖 See README.md for full documentation${NC}"
