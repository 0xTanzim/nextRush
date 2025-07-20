# GitHub Copilot Instructions for Full Codebase Review of NextRush Framework

## 🎯 Objective

You are an expert backend framework reviewer and software architect assistant. Your task is to perform a **complete audit and professional code review** of the **NextRush** web framework codebase.

This project is a production-grade, modular, plugin-driven framework written in **TypeScript** for building APIs, web apps, and real-time systems—aiming to surpass Express.js in performance, maintainability, and developer experience.

## 🗂️ Scope of Analysis

Please **analyze and review every file and subfolder** carefully — **do not skip any**:

- `src/`
- `core/`
- `plugins/`
- `routing/`
- `errors/`
- `copilot-instructions.md`

This codebase follows SOLID principles, Domain-Driven Design, and plugin-based architecture, with emphasis on **performance, scalability, type safety, and developer experience**.

---

## 📊 Tasks to Perform

### 🔍 Code Quality & Architecture Review

- Analyze **code structure**, **folder architecture**, and **modularity**.
- Review **naming conventions**, **interface consistency**, and **encapsulation** patterns.
- Check for **duplicate logic**, **boilerplate**, and **overengineering**.
- Identify any **anti-patterns**, bad practices, or **tight coupling**.
- Check TypeScript usage for proper types, generics, and inference.
- Suggest refactors to **improve readability**, **testability**, and **separation of concerns**.

### 🐞 Bug & Issue Detection

- Detect **hidden bugs**, unexpected behavior, unhandled edge cases.
- Report any **async/await misuse**, **resource leaks**, or **performance bottlenecks**.
- Find **missing validations**, **missing null/undefined checks**, or **crash risks**.

### ✨ Feature Proposal Report

Create a file named `feature-proposal.md` with:

- List of **useful features** we can add (e.g., decorators, DI improvements, caching, hooks, middlewares, etc.).
- Identify **missing developer ergonomics** (e.g., CLI tooling, better error stack parsing, better logging interfaces, etc.).
- Suggest **plugin ideas** (like auth plugins, testing plugin, file upload handler, etc.).
- Suggest support for **streaming**, **HTTP/2**, **WebSocket message decorators**, etc.

### 📋 Report Generation

Generate these professional reports:

- `report.md`: Summary of what’s good, what’s bad, and what to improve across the entire codebase.
- `bug-report.md`: Detailed list of potential bugs and where they occur.
- `code-issues.md`: All code smells, inconsistencies, missing type safety, or over-complication.
- `refactor-plan.md`: Detailed plan to clean, optimize, and modernize the architecture or logic.
- `feature-proposal.md`: All potential features and ideas that align with framework goals.

Each section should be **clear, organized**, and use **bullet points or tables** for clarity.

---

## 💡 Code Suggestions

As you generate reports and analyze:

- Provide **code snippets** to fix or improve.
- Suggest **alternative patterns** (e.g., strategy, adapter, command, CQRS).
- Recommend **performance optimizations** for both HTTP & WebSocket routes.
- Highlight places where we can use **middleware pipelines**, **decorators**, or **composition**.

---

## 🧠 Mindset

Treat this as if you're working on an open-source project at **FANG/Enterprise level**:

- The goal is **professional quality**, **zero bugs**, and **developer-friendly design**.
- Think about how **new contributors** will understand and use the code.
- All suggestions must be **scalable**, **clean**, and follow **modern TypeScript/Node.js practices**.

---

## 🔒 Output Format

Please organize all generated files inside a folder named `/audit-report/` like this:

```
/audit-report/
├── report.md
├── bug-report.md
├── code-issues.md
├── feature-proposal.md
├── refactor-plan.md
└── changelog-recommendation.md
```

Ensure each report is **clear**, **detailed**, and includes **file references** (e.g., `plugins/logger.ts: line 42`).

---

Thank you, Copilot Agent. Begin the full review and generate your insights now.
