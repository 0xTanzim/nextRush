# NextRush Enhancement Ideas

## Todo list for NextRush

- [x] Implement a middleware system to allow for reusable logic across routes.
- [x] Create a router implementation to organize routes better.
- [ ] Introduce a decorator-based routing system for cleaner route definitions.
- [ ] Enhance request validation with a schema-based approach.
- [ ] Add static file serving capabilities.
- [ ] Support for templating engines to render dynamic HTML.
- [ ] Implement a global error handling mechanism.
- [ ] Develop a plugin system for extensibility.
- [ ] Provide configuration management for environment-specific settings.
- [ ] Enable auto-documentation generation for APIs.

Here are some features to make NextRush more user-friendly by adding abstraction layers and hiding complexity:

## 1. Middleware System

```typescript
// Register middleware for all routes
app.use(logger);
// Register middleware for specific path
app.use('/api', authMiddleware);
```

## 2. Router Implementation

```typescript
const userRouter = new NextRush.Router();
userRouter.get('/:id', getUser);
userRouter.post('/', createUser);

// Mount on main app
app.use('/users', userRouter);
```

## 3. Decorator-based Routing

```typescript
@Controller('/users')
class UserController {
  @Get('/:id')
  getUser(req: Request, res: Response) {
    // Handler logic
  }

  @Post('/')
  createUser(@Body() userData: any, res: Response) {
    // Create user
  }
}
```

## 4. Enhanced Request Validation

```typescript
app.post(
  '/users',
  validate({
    body: {
      name: { type: 'string', required: true },
      email: { type: 'email', required: true },
      age: { type: 'number', min: 18 },
    },
  }),
  createUserHandler
);
```

## 5. Static File Serving

```typescript
// Simple static file middleware
app.static('/public', './public-files');
```

## 6. Templating Engine Support

```typescript
// Configure template engine
app.setViewEngine('ejs');
app.setViewsDirectory('./views');

// Use in routes
app.get('/profile', (req, res) => {
  res.render('profile', { user: req.user });
});
```

## 7. Error Handling

```typescript
// Global error handler
app.setErrorHandler((err, req, res) => {
  res.status(err.status || 500).json({
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
});
```

## 8. Plugin System

```typescript
// Register plugins
app.use(corsPlugin());
app.use(compressionPlugin());
app.use(sessionPlugin({ secret: 'your-secret' }));
```

## 9. Configuration Management

```typescript
const app = new NextRush({
  port: process.env.PORT || 3000,
  environment: process.env.NODE_ENV || 'development',
  trustProxy: true,
  bodyLimit: '1mb',
});
```

## 10. Auto-Documentation

```typescript
// Generate OpenAPI docs from your routes
app.enableSwagger('/api-docs');
```
