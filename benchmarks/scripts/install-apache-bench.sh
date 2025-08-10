#!/bin/bash

# 🚀 Apache Bench Installation Script for NextRush v2 Benchmarks
#
# Installs Apache Bench and other benchmarking tools across different platforms

set -e

echo "🚀 Installing Apache Bench and Benchmarking Tools"
echo "=================================================="

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

# Function to install Apache Bench
install_apache_bench() {
    echo -e "${BLUE}📦 Installing Apache Bench...${NC}"

    if command_exists apt-get; then
        echo -e "${YELLOW}📦 Installing via apt-get (Debian/Ubuntu)...${NC}"
        sudo apt-get update
        sudo apt-get install -y apache2-utils
    elif command_exists yum; then
        echo -e "${YELLOW}📦 Installing via yum (CentOS/RHEL)...${NC}"
        sudo yum install -y httpd-tools
    elif command_exists dnf; then
        echo -e "${YELLOW}📦 Installing via dnf (Fedora)...${NC}"
        sudo dnf install -y httpd-tools
    elif command_exists brew; then
        echo -e "${YELLOW}📦 Installing via Homebrew (macOS)...${NC}"
        brew install httpd
    elif command_exists pacman; then
        echo -e "${YELLOW}📦 Installing via pacman (Arch Linux)...${NC}"
        sudo pacman -S apache
    else
        echo -e "${RED}❌ Could not install Apache Bench automatically${NC}"
        echo -e "${YELLOW}💡 Please install manually:${NC}"
        echo "   Ubuntu/Debian: sudo apt-get install apache2-utils"
        echo "   CentOS/RHEL: sudo yum install httpd-tools"
        echo "   macOS: brew install httpd"
        echo "   Arch: sudo pacman -S apache"
        return 1
    fi
}

# Function to install Artillery
install_artillery() {
    echo -e "${BLUE}📦 Installing Artillery...${NC}"

    if command_exists npm; then
        echo -e "${YELLOW}📦 Installing Artillery via npm...${NC}"
        npm install -g artillery
    else
        echo -e "${RED}❌ npm not found. Please install Node.js first.${NC}"
        return 1
    fi
}

# Function to install K6
install_k6() {
    echo -e "${BLUE}📦 Installing K6...${NC}"

    if command_exists apt-get; then
        echo -e "${YELLOW}📦 Installing K6 via apt (Debian/Ubuntu)...${NC}"
        sudo gpg -k
        sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
        echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
        sudo apt-get update
        sudo apt-get install -y k6
    elif command_exists yum; then
        echo -e "${YELLOW}📦 Installing K6 via yum (CentOS/RHEL)...${NC}"
        sudo dnf install https://dl.k6.io/rpm/repo.rpm
        sudo dnf install k6
    elif command_exists brew; then
        echo -e "${YELLOW}📦 Installing K6 via Homebrew (macOS)...${NC}"
        brew install k6
    else
        echo -e "${RED}❌ Could not install K6 automatically${NC}"
        echo -e "${YELLOW}💡 Please install manually from: https://k6.io/docs/getting-started/installation/${NC}"
        return 1
    fi
}

# Function to install wrk (alternative to Apache Bench)
install_wrk() {
    echo -e "${BLUE}📦 Installing wrk...${NC}"

    if command_exists apt-get; then
        echo -e "${YELLOW}📦 Installing wrk via apt-get...${NC}"
        sudo apt-get update && sudo apt-get install -y wrk
    elif command_exists yum; then
        echo -e "${YELLOW}📦 Installing wrk via yum...${NC}"
        sudo yum install -y wrk
    elif command_exists brew; then
        echo -e "${YELLOW}📦 Installing wrk via Homebrew...${NC}"
        brew install wrk
    else
        echo -e "${YELLOW}⚠️ wrk not available via package manager${NC}"
        echo -e "${YELLOW}💡 You can build from source: https://github.com/wg/wrk${NC}"
    fi
}

# Function to verify installation
verify_installation() {
    echo -e "${BLUE}🔍 Verifying installations...${NC}"

    local all_good=true

    # Check Apache Bench
    if command_exists ab; then
        echo -e "${GREEN}✅ Apache Bench (ab) installed${NC}"
        ab -V
    else
        echo -e "${RED}❌ Apache Bench not found${NC}"
        all_good=false
    fi

    # Check Artillery
    if command_exists artillery; then
        echo -e "${GREEN}✅ Artillery installed${NC}"
        artillery --version
    else
        echo -e "${YELLOW}⚠️ Artillery not found (optional)${NC}"
    fi

    # Check K6
    if command_exists k6; then
        echo -e "${GREEN}✅ K6 installed${NC}"
        k6 version
    else
        echo -e "${YELLOW}⚠️ K6 not found (optional)${NC}"
    fi

    # Check wrk
    if command_exists wrk; then
        echo -e "${GREEN}✅ wrk installed${NC}"
        wrk --version
    else
        echo -e "${YELLOW}⚠️ wrk not found (optional)${NC}"
    fi

    if [ "$all_good" = true ]; then
        echo -e "${GREEN}🎉 All required tools installed successfully!${NC}"
    else
        echo -e "${RED}❌ Some tools failed to install${NC}"
        return 1
    fi
}

# Function to create test script
create_test_script() {
    echo -e "${BLUE}📝 Creating Apache Bench test script...${NC}"

    cat > test-apache-bench.sh << 'EOF'
#!/bin/bash

# 🚀 Quick Apache Bench Test Script
# Tests NextRush v2 performance with Apache Bench

set -e

echo "🚀 Quick Apache Bench Test"
echo "=========================="

# Check if Apache Bench is available
if ! command -v ab >/dev/null 2>&1; then
    echo "❌ Apache Bench not found. Run install-apache-bench.sh first."
    exit 1
fi

# Check if server is running
if ! curl -s http://localhost:3000 >/dev/null 2>&1; then
    echo "❌ NextRush server not running on port 3000"
    echo "💡 Start the server first: cd ../.. && pnpm start"
    exit 1
fi

echo "✅ Server is running, starting Apache Bench test..."

# Run basic test
echo ""
echo "📊 Basic Load Test (1000 requests, 10 concurrent)"
echo "================================================"
ab -n 1000 -c 10 http://localhost:3000/

echo ""
echo "📊 JSON Endpoint Test (500 requests, 5 concurrent)"
echo "=================================================="
ab -n 500 -c 5 http://localhost:3000/json

echo ""
echo "📊 Health Check Test (2000 requests, 20 concurrent)"
echo "=================================================="
ab -n 2000 -c 20 http://localhost:3000/health

echo ""
echo "🎉 Apache Bench test completed!"
echo "💡 For comprehensive testing, run: pnpm benchmark comprehensive"
EOF

    chmod +x test-apache-bench.sh
    echo -e "${GREEN}✅ Test script created: test-apache-bench.sh${NC}"
}

# Main installation process
main() {
    echo -e "${BLUE}🔧 Starting installation process...${NC}"

    # Install Apache Bench
    if install_apache_bench; then
        echo -e "${GREEN}✅ Apache Bench installation successful${NC}"
    else
        echo -e "${RED}❌ Apache Bench installation failed${NC}"
    fi

    # Install Artillery (optional)
    if install_artillery; then
        echo -e "${GREEN}✅ Artillery installation successful${NC}"
    else
        echo -e "${YELLOW}⚠️ Artillery installation failed (optional tool)${NC}"
    fi

    # Install K6 (optional)
    if install_k6; then
        echo -e "${GREEN}✅ K6 installation successful${NC}"
    else
        echo -e "${YELLOW}⚠️ K6 installation failed (optional tool)${NC}"
    fi

    # Install wrk (optional)
    install_wrk

    # Verify installations
    verify_installation

    # Create test script
    create_test_script

    echo ""
    echo -e "${GREEN}🎉 Installation completed!${NC}"
    echo ""
    echo -e "${BLUE}📋 Available commands:${NC}"
    echo "   ./test-apache-bench.sh          # Quick Apache Bench test"
    echo "   pnpm benchmark comprehensive     # Full benchmark suite"
    echo "   pnpm benchmark apache-bench      # Apache Bench only"
    echo ""
    echo -e "${BLUE}📚 Documentation:${NC}"
    echo "   Apache Bench: https://httpd.apache.org/docs/2.4/programs/ab.html"
    echo "   Artillery: https://www.artillery.io/docs"
    echo "   K6: https://k6.io/docs"
    echo ""
}

# Run main function
main "$@"
