---
'@nextrush/di': minor
---

DI: support request scope via tsyringe `ContainerScoped`

`container.register(token, { useClass }, { scope: 'request' })` now maps to
tsyringe's `Lifecycle.ContainerScoped`: the instance is cached per container, so
resolving from a per-request child (`container.createChild()`) yields one
instance per request, shared within that request. `@Service({ scope: 'request' })`
records `di:scope='request'` and marks the class injectable (constructor metadata
captured) without registering a singleton; `getServiceScope` returns `'request'`.

Non-breaking: `singleton` and `transient` registration is unchanged, and no
per-resolve overhead is added for them. See
`docs/RFC/RFC-NEXTRUSH-REQUEST-SCOPE.md`.
