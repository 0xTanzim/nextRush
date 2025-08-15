# 🚀 GitHub Actions Local Development Guide

This guide explains how to run GitHub Actions locally using **Act** for the NextRush project.

## 📋 Prerequisites

- ✅ **Docker** installed and running
- ✅ **Act** installed (automatic setup included)
- ✅ **Ubuntu** system (you have this!)

## 🛠️ Setup (Already Done!)

The project is already configured with:

- ✅ GitHub Actions workflows in `.github/workflows/`
- ✅ Act configuration in `.actrc`
- ✅ Local secrets template in `.secrets`
- ✅ NPM scripts for easy execution

## 🚀 Quick Start

### **List Available Actions**

```bash
pnpm act:list
# or directly
act -l
```

### **Run Development Checks**

```bash
pnpm act:dev
# Runs: build, quick tests, lint, performance check
```

### **Run Full Test Suite**

```bash
pnpm act:test
# Runs: all tests, coverage, build validation
```

### **Run Quality Checks**

```bash
pnpm act:quality
# Runs: prettier, eslint, type checking
```

### **Run Security Scan**

```bash
pnpm act:security
# Runs: npm audit, vulnerability checks
```

### **Simulate Pull Request**

```bash
pnpm act:pull-request
# Runs: all PR checks (test, build, quality)
```

### **Simulate Push to Main**

```bash
pnpm act:push
# Runs: full CI/CD pipeline
```

## 🎯 Individual Jobs

Run specific jobs:

```bash
# Development workflow
act -j dev-check

# Test matrix (Node 18, 20, 22)
act -j test

# Build and package
act -j build

# Quality checks
act -j quality

# Security scan
act -j security
```

## 🔧 Advanced Usage

### **Custom Docker Images**

```bash
# Use specific Ubuntu version
act -P ubuntu-latest=catthehacker/ubuntu:act-22.04

# Use Node.js optimized image
act -P ubuntu-latest=node:20-slim
```

### **With Secrets**

```bash
# Edit .secrets file first with your tokens
act --secret-file .secrets
```

### **Specific Event Simulation**

```bash
# Simulate push to specific branch
act push -e .github/workflows/dev.yml

# Simulate pull request
act pull_request
```

### **Dry Run (Show what would run)**

```bash
act -n
```

### **Verbose Output**

```bash
act -v
```

## 📁 Workflow Files

- **`ci.yml`** - Main CI/CD pipeline (test, build, release)
- **`dev.yml`** - Development workflow (quick checks)

## 🔒 Secrets Configuration

Edit `.secrets` file for tokens:

```bash
NPM_TOKEN=your_actual_npm_token
GITHUB_TOKEN=your_github_personal_access_token
```

⚠️ **Never commit the `.secrets` file!** (It's in `.gitignore`)

## 🎯 Common Use Cases

### **Before Committing Code**

```bash
pnpm act:dev        # Quick development checks
pnpm act:quality    # Code quality validation
```

### **Before Creating PR**

```bash
pnpm act:test       # Full test suite
pnpm act:build      # Build validation
pnpm act:security   # Security checks
```

### **Testing Release Process**

```bash
pnpm act:push       # Full CI/CD simulation
```

## 🐛 Troubleshooting

### **Docker Permission Issues**

```bash
sudo usermod -aG docker $USER
newgrp docker
```

### **Act Not Found**

```bash
# Reinstall act
curl -s https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash
```

### **Memory Issues**

```bash
# Use smaller Docker images
act -P ubuntu-latest=node:18-alpine
```

### **Network Issues in Docker**

```bash
# Use host network
act --use-gitignore=false --container-daemon-socket -
```

## 🚀 Performance Tips

1. **Use cached images** - Act will reuse Docker images
2. **Run specific jobs** - Don't run full pipeline if not needed
3. **Use smaller base images** - Alpine variants when possible
4. **Parallel execution** - Act runs jobs in parallel by default

## 📊 Expected Output

When running locally, you'll see:

- ✅ **Build success** - TypeScript compilation
- ✅ **All 1032 tests pass** - Complete test suite
- ✅ **Lint success** - Code quality checks
- ✅ **Performance benchmarks** - Speed validation

## 🎉 Ready to Use!

Your NextRush project now has:

- 🚀 **Local GitHub Actions execution**
- 🧪 **Complete test automation**
- 🔍 **Quality gate validation**
- 📦 **Build and package verification**
- 🔒 **Security scanning**

Run `pnpm act:list` to see all available actions! 🚀
