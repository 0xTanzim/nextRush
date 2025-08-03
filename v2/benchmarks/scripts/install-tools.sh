#!/bin/bash

# Install system-level benchmarking tools
# This script installs k6 and other tools that are not npm packages

set -e

echo "🚀 Installing system-level benchmarking tools..."

# Check if we're on Linux
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "📦 Installing k6 for Linux..."

    # Install k6 using the official installation script
    if ! command -v k6 &> /dev/null; then
        echo "Installing k6..."
        sudo gpg -k
        sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C483D74AA063
        echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
        sudo apt-get update
        sudo apt-get install k6
    else
        echo "✅ k6 is already installed"
    fi

    # Install other system tools if needed
    if ! command -v siege &> /dev/null; then
        echo "Installing siege..."
        sudo apt-get install siege
    fi

    if ! command -v ab &> /dev/null; then
        echo "Installing Apache Bench..."
        sudo apt-get install apache2-utils
    fi

elif [[ "$OSTYPE" == "darwin"* ]]; then
    echo "📦 Installing k6 for macOS..."

    if ! command -v k6 &> /dev/null; then
        echo "Installing k6 using Homebrew..."
        brew install k6
    else
        echo "✅ k6 is already installed"
    fi

    # Install other tools
    if ! command -v siege &> /dev/null; then
        echo "Installing siege..."
        brew install siege
    fi

    if ! command -v ab &> /dev/null; then
        echo "Installing Apache Bench..."
        brew install httpd
    fi

else
    echo "⚠️  Unsupported OS: $OSTYPE"
    echo "Please install k6 manually from https://k6.io/docs/getting-started/installation/"
fi

echo "✅ System-level benchmarking tools installation complete!"
echo ""
echo "📋 Installed tools:"
echo "  - k6: Modern load testing tool"
echo "  - siege: HTTP load testing and benchmarking utility"
echo "  - ab (Apache Bench): HTTP server benchmarking tool"
echo ""
echo "🔧 To verify installation, run:"
echo "  k6 version"
echo "  siege --version"
echo "  ab -V"
