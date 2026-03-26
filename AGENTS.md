# AGENTS.md

This file provides guidance for agents working with this NestJS + Mnemonica example project.

## Project Overview

This is a **NestJS** application demonstrating integration with **mnemonica** for runtime type inheritance and **@mnemonica/tactica** for TypeScript type generation.

## Build/Test Commands

All commands run from the `tactica-examples/nestjs/` directory:

```bash
# Install dependencies
npm install

# Development mode with auto-reload
npm run start:dev

# Build for production
npm run build

# Generate tactica types
npm run tactica:generate

# Watch mode for tactica (auto-regenerate on file changes)
npm run tactica:watch
```

## Code Style

### Indentation
- **Tabs** for indentation (not spaces)
- Tab width: 4

### Function Spacing
- **Always** space before function parentheses:
  ```typescript
  function myFunc () { }  // ✓ correct
  function myFunc() { }   // ✗ wrong
  ```

### TypeScript Strictness
- `strict: true` enabled
- `noImplicitAny: true`
- `noUnusedLocals: true` - unused variables cause errors
- `noUnusedParameters: true` - unused parameters cause errors

### Return Statement Pattern
- **Always** use intermediate variable before return for debugging support:
  ```typescript
  // ✓ correct - allows setting breakpoint on the variable
  const result = this.service.doSomething();
  return result;
  
  // ✗ wrong - cannot set breakpoint on return value
  return this.service.doSomething();
  ```

## Architecture Patterns

### Mnemonica Type Hierarchy

The project demonstrates a three-level inheritance hierarchy:

```
UserEntity
├── UserResponse (nested type)
└── AdminEntity
    ├── AdminResponse (nested type)
    └── SuperAdminEntity
        └── SuperAdminResponse (nested type)
```

### Type Import Pattern

Types are imported from tactica-generated files:

```typescript
// Import constructors from entities
import { UserEntity, UserResponse } from './entities/user.entity';

// Import types from tactica-generated file
import type { UserEntityInstance, UserResponseInstance } from '../.tactica/types';
```

### Creating Nested Types

Use the `parent.SubType` pattern:

```typescript
const user = new UserEntity({ id: '1', email: 'test@test.com', name: 'Test' });
const response = new user.UserResponse({
	id: user.id,
	email: user.email,
	name: user.name,
	type: 'user',
});
```

## File Structure

```
src/
├── dto/
│   ├── user.dto.ts          # NestJS DTOs with class-validator
│   └── async.dto.ts         # DTOs for async examples
├── entities/
│   ├── user.entity.ts       # Mnemonica entities with define() - REFERENCE EXAMPLE
│   └── async.entity.ts      # Async/await + @decorate() - REFERENCE EXAMPLE
├── user.controller.ts       # NestJS controllers
├── async.controller.ts      # Async examples controller
├── user.service.ts          # NestJS services
├── app.module.ts            # NestJS module
└── main.ts                  # Bootstrap with Swagger
```

**Reference Examples:**
- `entities/user.entity.ts` - Clean pattern for `define()` types
- `entities/async.entity.ts` - Clean pattern for async + `@decorate()` types

## API Documentation

Swagger UI is available at `http://localhost:3000/api-docs` when the server is running.

## Handling Tactica's `unknown` Type Fields

Tactica generates types from mnemonica entities, but it often infers properties as `unknown` when it cannot determine the exact type. This is **normal** and expected behavior.

### The Problem

Tactica-generated types may look like this:

```typescript
export type RootAsyncInstance = {
	value: number;
	computed: unknown;  // Tactica couldn't infer this
	ResultFromDecorate: TypeConstructor<ResultFromDecorateInstance>;
}
```

### The Solution

**Define proper types inline in your entity file** instead of importing from tactica:

```typescript
// src/entities/async.entity.ts

// Define proper types with correct types (not unknown)
export type RootAsyncInstance = {
	value: number;
	computed: number;  // Proper type!
	ResultFromDecorate: (multiplier: number) => Promise<ResultFromDecorateInstance>;
};

export type ResultFromDecorateInstance = RootAsyncInstance & {
	result: number;     // Proper type!
	timestamp: number;  // Proper type!
};

// Use these types for `this` parameter
export const RootAsync = define('RootAsync', async function (this: RootAsyncInstance, data: { value: number }) {
	await sleep(100);
	this.value = data.value;
	this.computed = data.value * 2;  // No type assertions needed!
	return this;
});
```

### Key Principles

1. **Don't fight tactica's `unknown` types** - they're auto-generated
2. **Define your own types** in the entity file with proper property types
3. **Use your types for `this` parameter** in constructor functions
4. **No type assertions** (`as unknown as`) needed in entity definitions
5. **Export types** from entity file for use in controllers

### Reference Examples

Two excellent reference files that demonstrate the correct pattern:

- [`src/entities/user.entity.ts`](src/entities/user.entity.ts) - Basic inheritance pattern
- [`src/entities/async.entity.ts`](src/entities/async.entity.ts) - Async/await with `@decorate()` pattern

Both files show how to define proper types inline and use them cleanly without type assertions.

## reflect-metadata

**Mnemonica does NOT use `reflect-metadata`**. Do not add `import 'reflect-metadata'` to entity files.

Only NestJS and Swagger decorators require reflect-metadata, which is imported once in `main.ts`.

## Related Documentation

- [Tactica AGENTS.md](../../tactica/AGENTS.md)
- [Mnemonica Documentation](https://github.com/wentout/mnemonica)
