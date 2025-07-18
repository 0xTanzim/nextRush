# NextRush VS Code Development Environment

This directory contains optimized VS Code configurations for NextRush framework development, designed to provide an industry-leading development experience.

## 🚀 Features

### Enhanced TypeScript Support
- **Full Type Inference**: Automatic type inference for `NextRushRequest`, `NextRushResponse`, and `RequestContext`
- **IntelliSense**: Enhanced autocomplete for plugins and framework APIs
- **Error Detection**: Real-time TypeScript error highlighting and validation
- **Parameter Hints**: Inline type information for better development experience

### Plugin Development Tools
- **Custom Snippets**: Pre-built code snippets for common NextRush patterns
- **Architecture Validation**: Automated checks for plugin structure compliance
- **Performance Monitoring**: Built-in benchmarking tools for optimization

### Advanced Debugging
- **Multi-Target Debugging**: Separate debug configurations for framework, plugins, and WebSocket
- **Source Maps**: Full source map support for TypeScript debugging
- **Background Process**: Debugging support for long-running processes

## 📁 Configuration Files

### `.vscode/settings.json`
Enhanced workspace settings with:
- TypeScript language service optimizations
- NextRush-specific file associations
- Performance optimizations for large codebases
- Plugin development enhancements

### `.vscode/tasks.json`
Comprehensive task definitions:
- **Build Tasks**: Framework compilation and type checking
- **Development Tasks**: Hot reload and plugin development
- **Validation Tasks**: Architecture and code quality checks
- **Documentation Tasks**: Automated API documentation generation

### `.vscode/launch.json`
Debugging configurations for:
- Framework core debugging
- Individual plugin debugging
- WebSocket connection debugging
- Template engine debugging
- Middleware stack debugging

### `.vscode/extensions.json`
Curated extension recommendations:
- **Core Development**: TypeScript, ESLint, Prettier
- **Testing**: Jest, Test Explorer
- **Documentation**: Markdown support
- **Performance**: Bundle analyzer, profiling tools

### `.vscode/nextrush.code-snippets`
Custom code snippets including:
- Plugin boilerplate generation
- Route handler templates
- Middleware patterns
- WebSocket implementations
- Error handling patterns

## 🛠️ Available Commands

### Build & Development
```bash
# Build the framework
npm run build

# Start development server with hot reload
npm run start:dev

# Type check without compilation
npm run validate:architecture
```

### Testing & Validation
```bash
# Validate plugin architecture
npm run validate:architecture

# Run performance benchmarks
npm run benchmark

# Generate API documentation
npm run docs:generate
```

### VS Code Tasks
- **NextRush: Build Framework** - Complete framework build
- **NextRush: Type Check** - TypeScript validation
- **NextRush: Plugin Development** - Plugin-specific development mode
- **NextRush: Performance Benchmark** - Run performance tests

## 🔧 Development Workflow

### 1. Plugin Development
1. Use `nextrush-plugin` snippet to create new plugin boilerplate
2. Implement required methods (`install`, `start`, `stop`)
3. Run architecture validation: `Ctrl+Shift+P` → "Tasks: Run Task" → "NextRush: Validate Plugin Architecture"
4. Debug with `F5` and select "NextRush: Debug Plugin"

### 2. Framework Development
1. Make changes to core framework
2. Use `Ctrl+Shift+B` to build
3. Run tests with `Ctrl+Shift+P` → "Tasks: Run Task" → "NextRush: Run Tests"
4. Debug with `F5` and select "NextRush: Debug Framework"

### 3. Performance Optimization
1. Run benchmarks: `npm run benchmark`
2. Use "NextRush: Analyze Bundle" task for bundle analysis
3. Profile with VS Code's built-in profiler
4. Validate improvements with performance tests

## 🎯 Code Snippets Usage

### Quick Plugin Creation
Type `nextrush-plugin` and press `Tab`:
```typescript
export class MyPlugin extends BasePlugin {
  name = 'MyPlugin';
  
  install(app: Application): void {
    // Plugin installation logic
  }
  
  start(): void {
    this.emit('myplugin:started');
  }
  
  stop(): void {
    this.emit('myplugin:stopped');
  }
}
```

### Route Handler
Type `nextrush-route` and press `Tab`:
```typescript
app.get('/path', (req: NextRushRequest, res: NextRushResponse) => {
  // Route handler logic
  res.json({ data: 'response' });
});
```

### Middleware
Type `nextrush-middleware` and press `Tab`:
```typescript
app.use((req: NextRushRequest, res: NextRushResponse, next: () => void) => {
  // Middleware logic
  next();
});
```

## 🔍 Debugging Guide

### Framework Debugging
1. Set breakpoints in TypeScript source files
2. Press `F5` or use "NextRush: Debug Framework"
3. VS Code will build and attach debugger automatically

### Plugin Debugging
1. Select the plugin to debug from the input prompt
2. Use "NextRush: Debug Plugin" configuration
3. Step through plugin lifecycle methods

### WebSocket Debugging
1. Use "NextRush: Debug WebSocket" for WebSocket-specific issues
2. Monitor connection events and message flow
3. Debug room management and authentication

## 📊 Performance Monitoring

The development environment includes built-in performance monitoring:

### Benchmarking
- Automated performance tests for core operations
- Comparison with industry standards
- Latency and throughput analysis

### Bundle Analysis
- Webpack bundle analyzer integration
- Dependency size tracking
- Tree-shaking effectiveness monitoring

## 🏗️ Architecture Validation

Automated checks ensure code quality:

### Plugin Architecture
- BasePlugin inheritance validation
- Required method implementation checks
- Naming convention compliance
- Documentation completeness

### Code Quality
- TypeScript strict mode compliance
- ESLint rule enforcement
- Import organization
- Consistent formatting

## 🔗 Integration with Framework Best Practices

This configuration integrates patterns from industry-leading frameworks:

### From Fastify
- High-performance development server
- Schema-based validation patterns
- Plugin discovery automation

### From Hapi
- Security-first development warnings
- Comprehensive error reporting
- Predictable development workflow

### From NestJS
- Dependency injection visualization
- Module architecture support
- Advanced TypeScript integration

### From Koa
- Context-aware development tools
- Minimal configuration overhead
- Clean development patterns

## 🚀 Getting Started

1. **Install recommended extensions** when prompted by VS Code
2. **Run initial build**: `Ctrl+Shift+B` → "NextRush: Build Framework"
3. **Start development server**: `Ctrl+Shift+P` → "Tasks: Run Task" → "NextRush: Plugin Development"
4. **Open a plugin file** and start coding with full IntelliSense support

## 📚 Additional Resources

- [NextRush Documentation](../docs/README.md)
- [Plugin Development Guide](../docs/PLUGIN-DEVELOPMENT.md)
- [API Reference](../docs/API-REFERENCE.md)
- [Performance Guide](../docs/PERFORMANCE.md)

---

This VS Code configuration provides a comprehensive development environment optimized for NextRush framework development, ensuring maximum productivity and code quality.
