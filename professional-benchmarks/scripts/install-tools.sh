#!/bin/bash

# 🚀 Professional Benchmarking Tools Installation Script
# This script installs all the industry-standard performance tools

set -e

echo "🚀 Installing Professional Benchmarking Tools..."
echo "=============================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to install with error handling
install_tool() {
    local tool=$1
    local install_cmd=$2

    echo -e "${YELLOW}📦 Installing $tool...${NC}"

    if command_exists $tool; then
        echo -e "${GREEN}✅ $tool already installed${NC}"
        return 0
    fi

    if eval $install_cmd; then
        echo -e "${GREEN}✅ $tool installed successfully${NC}"
    else
        echo -e "${RED}❌ Failed to install $tool${NC}"
        return 1
    fi
}

echo -e "${BLUE}🔧 Checking Node.js environment...${NC}"
if ! command_exists node; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js first.${NC}"
    exit 1
fi

if ! command_exists npm; then
    echo -e "${RED}❌ npm not found. Please install npm first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Node.js $(node --version) found${NC}"
echo -e "${GREEN}✅ npm $(npm --version) found${NC}"
echo ""

# Install global npm tools
echo -e "${BLUE}📦 Installing npm-based tools globally...${NC}"

install_tool "autocannon" "npm install -g autocannon"
install_tool "clinic" "npm install -g clinic"
install_tool "0x" "npm install -g 0x"

# Install Artillery
echo -e "${YELLOW}📦 Installing Artillery...${NC}"
if command_exists artillery; then
    echo -e "${GREEN}✅ Artillery already installed${NC}"
else
    if npm install -g artillery; then
        echo -e "${GREEN}✅ Artillery installed successfully${NC}"
    else
        echo -e "${RED}❌ Failed to install Artillery${NC}"
    fi
fi

# Install K6
echo -e "${YELLOW}📦 Installing K6...${NC}"
if command_exists k6; then
    echo -e "${GREEN}✅ K6 already installed${NC}"
else
    echo -e "${YELLOW}Installing K6 based on OS...${NC}"

    # Detect OS and install K6
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        echo -e "${YELLOW}Detected Linux, installing K6...${NC}"
        if command_exists apt; then
            # Ubuntu/Debian
            sudo gpg -k
            sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
            echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
            sudo apt-get update
            sudo apt-get install k6
        elif command_exists yum; then
            # CentOS/RHEL
            sudo dnf install https://dl.k6.io/rpm/repo.rpm
            sudo dnf install k6
        else
            echo -e "${YELLOW}Installing K6 via npm (alternative method)...${NC}"
            npm install -g k6
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        echo -e "${YELLOW}Detected macOS, installing K6 via Homebrew...${NC}"
        if command_exists brew; then
            brew install k6
        else
            echo -e "${YELLOW}Homebrew not found, installing K6 via npm...${NC}"
            npm install -g k6
        fi
    else
        echo -e "${YELLOW}Unknown OS, installing K6 via npm...${NC}"
        npm install -g k6
    fi

    if command_exists k6; then
        echo -e "${GREEN}✅ K6 installed successfully${NC}"
    else
        echo -e "${RED}❌ Failed to install K6${NC}"
    fi
fi

# Install additional useful tools
echo ""
echo -e "${BLUE}📦 Installing additional performance tools...${NC}"

# Install wrk if possible (C-based HTTP benchmarking tool)
echo -e "${YELLOW}📦 Installing wrk (if available)...${NC}"
if command_exists wrk; then
    echo -e "${GREEN}✅ wrk already installed${NC}"
else
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if command_exists apt; then
            sudo apt-get update && sudo apt-get install -y wrk || echo -e "${YELLOW}⚠️ wrk not available via apt${NC}"
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        if command_exists brew; then
            brew install wrk || echo -e "${YELLOW}⚠️ wrk not available via brew${NC}"
        fi
    fi
fi

# Install hey (modern HTTP load testing tool)
echo -e "${YELLOW}📦 Installing hey...${NC}"
if command_exists hey; then
    echo -e "${GREEN}✅ hey already installed${NC}"
else
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        wget -O hey https://hey-release.s3.us-east-2.amazonaws.com/hey_linux_amd64
        chmod +x hey
        sudo mv hey /usr/local/bin/
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        if command_exists brew; then
            brew install hey
        fi
    fi

    if command_exists hey; then
        echo -e "${GREEN}✅ hey installed successfully${NC}"
    else
        echo -e "${YELLOW}⚠️ hey installation skipped${NC}"
    fi
fi

# Verify installations
echo ""
echo -e "${BLUE}🔍 Verifying installations...${NC}"
echo "================================"

tools=("node" "npm" "autocannon" "clinic" "0x" "artillery" "k6")
optional_tools=("wrk" "hey")

for tool in "${tools[@]}"; do
    if command_exists $tool; then
        version=$(${tool} --version 2>/dev/null || echo "installed")
        echo -e "${GREEN}✅ $tool: $version${NC}"
    else
        echo -e "${RED}❌ $tool: not found${NC}"
    fi
done

echo ""
echo -e "${YELLOW}Optional tools:${NC}"
for tool in "${optional_tools[@]}"; do
    if command_exists $tool; then
        version=$(${tool} --version 2>/dev/null || echo "installed")
        echo -e "${GREEN}✅ $tool: $version${NC}"
    else
        echo -e "${YELLOW}⚠️ $tool: not installed${NC}"
    fi
done

echo ""
echo -e "${GREEN}🎉 Professional benchmarking tools installation complete!${NC}"
echo ""
echo -e "${BLUE}📚 Quick usage examples:${NC}"
echo -e "${YELLOW}  autocannon -c 100 -d 30 http://localhost:3000${NC}"
echo -e "${YELLOW}  clinic doctor -- node server.js${NC}"
echo -e "${YELLOW}  artillery run scenario.yml${NC}"
echo -e "${YELLOW}  k6 run script.js${NC}"
echo ""
echo -e "${BLUE}📖 Full documentation: ./README.md${NC}"
