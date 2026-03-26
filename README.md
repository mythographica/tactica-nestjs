# NestJS + Mnemonica + Tactica Integration Example

This example demonstrates how to use **mnemonica** with **NestJS** for runtime inheritance in DTOs/entities, along with **@mnemonica/tactica** for TypeScript type generation.

## Tactica Integration

This project includes **@mnemonica/tactica** which generates TypeScript types from mnemonica entities:

```typescript
// src/entities/user.entity.ts
/// <reference types="../../.tactica/types" />
import type { UserEntityInstance, AdminEntityInstance, SuperAdminEntityInstance } from '../../.tactica/types';
```

### Tactica Scripts

```bash
# Generate types from mnemonica entities
npm run tactica:generate

# Watch mode for development (auto-regenerate on file changes)
npm run tactica:watch
```

The generated types are located in `.tactica/types.ts` and are excluded from git via `.gitignore`.

## Overview

This example shows:

1. **Mnemonica `define()`** - Creating type hierarchies with inheritance
2. **NestJS Validation** - Using class-validator with mnemonica entities
3. **Swagger Documentation** - API docs at `/api-docs`
4. **Three-level Inheritance** - User → Admin → SuperAdmin
5. **Integration Pattern** - How mnemonica works within a NestJS application

## Project Structure

```
src/
├── dto/
│   ├── user.dto.ts          # Standard NestJS DTOs with class-validator & Swagger
│   └── async.dto.ts         # DTOs for async/await examples
├── entities/
│   ├── user.entity.ts       # Mnemonica entities with define()
│   └── async.entity.ts      # Async constructors with @decorate() examples
├── user.controller.ts       # NestJS controllers with Swagger decorators
├── async.controller.ts      # Async/await examples controller
├── user.service.ts          # NestJS services
├── app.module.ts            # NestJS module
└── main.ts                  # Bootstrap with Swagger setup & mnemonica hooks
```

## Key Concepts

### Mnemonica Entities (entities/user.entity.ts)

Using `define()` instead of `@decorate()` for cleaner integration:

```typescript
export const UserEntity = define('UserEntity', function (this: UserData, data: UserData) {
  this.id = data.id;
  this.email = data.email;
  this.name = data.name;
});

export const AdminEntity = UserEntity.define('AdminEntity', function (this: AdminData, data: AdminData) {
  // Inherits from UserEntity
  this.id = data.id;
  this.email = data.email;
  this.name = data.name;
  this.role = data.role;
  this.permissions = data.permissions || [];
});
```

### Complete Example

**DTO with class-validator:**
```typescript
// src/dto/user.dto.ts
import { IsString, IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
	@ApiProperty({ example: 'user@example.com' })
	@IsEmail()
	email!: string;

	@ApiProperty({ example: 'John Doe' })
	@IsString()
	name!: string;
}
```

**Entity with nested types:**
```typescript
// src/entities/user.entity.ts
import { define } from 'mnemonica';
import type { UserEntityInstance, UserResponseInstance } from '../../.tactica/types';

export const UserEntity = define('UserEntity', function (
	this: UserEntityInstance,
	data: { id: string; email: string; name: string }
) {
	this.id = data.id;
	this.email = data.email;
	this.name = data.name;
});

// Nested response type - accessible as user.UserResponse
export const UserResponse = UserEntity.define('UserResponse', function (
	this: UserResponseInstance,
	data: { id: string; email: string; name: string; type: 'user' }
) {
	this.id = data.id;
	this.email = data.email;
	this.name = data.name;
	this.type = data.type;
});
```

**Controller:**
```typescript
// src/user.controller.ts
import { Controller, Post, Body } from '@nestjs/common';
import { UserEntity } from './entities/user.entity';
import type { UserResponseInstance } from '../.tactica/types';

@Controller('users')
export class UserController {
	@Post()
	createUser (@Body() createUserDto: CreateUserDto): UserResponseInstance {
		// Create entity
		const user = new UserEntity({
			id: crypto.randomUUID(),
			email: createUserDto.email,
			name: createUserDto.name,
		});

		// Create response using nested type
		return new user.UserResponse({
			id: user.id,
			email: user.email,
			name: user.name,
			type: 'user',
		});
	}
}
```

### Swagger Integration

Swagger UI is available at `http://localhost:3000/api-docs` when the server is running.

All DTOs and controllers are decorated with Swagger annotations for automatic API documentation.

## Installation

```bash
npm install
```

## Running the Example

```bash
# Development
npm run start:dev

# Build and run
npm run build
npm start
```

The server will start on `http://localhost:3000` with Swagger docs at `http://localhost:3000/api-docs`.

## API Endpoints

### Swagger Documentation
- **URL:** `http://localhost:3000/api-docs`
- Interactive API documentation with try-it feature

### Users
- `POST /users` - Create a user
- `GET /users/:id` - Get a user

### Admins
- `POST /admins` - Create an admin (inherits User properties)
- `GET /admins/:id` - Get an admin

### Super Admins
- `POST /super-admins` - Create a super admin (3-level inheritance)
- `GET /super-admins/:id` - Get a super admin

### Async Examples (Async/Await + @decorate())
- `POST /async/root-async` - Create RootAsync instance (async constructor)
- `POST /async/root-async/result` - Create RootAsync then ResultFromDecorate (chained)
- `GET /async/root-async/:value/result/:multiplier` - GET version of chained result
- `POST /async/sync-base` - Create SyncBase (@decorate() class)
- `POST /async/sync-base/sub-async` - Create Sync.SubAsync (async on decorated class)
- `POST /async/sync-base/sub-async/sub-decorate` - Full chain: Sync → SubAsync → SubDecorate
- `GET /async/sync-base/:baseValue/sub-async/:delay/:extra/sub-decorate/:decorateValue` - GET version

## Async/Await Constructor Examples

This project includes examples of **mnemonica's async constructors** combined with `@decorate()` decorator:

### Pattern 1: Async Constructor with Sub-types

```typescript
// src/entities/async.entity.ts
import { define } from 'mnemonica';

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export const RootAsync = define('RootAsync', async function (this: RootAsyncInstance, data: { value: number }) {
  await sleep(100);  // Simulate long operation
  this.value = data.value;
  this.computed = data.value * 2;
  return this;
});

// Define sub-type for adding decorated results
export const ResultFromDecorate = RootAsync.define('ResultFromDecorate', function (
  this: ResultFromDecorateInstance,
  multiplier: number
) {
  this.result = this.computed * multiplier;
  return this;
});
```

Usage:
```typescript
// await new RootAsync, then access rootAsync.ResultFromDecorate
const rootAsync = await new RootAsync({ value: 42 }) as RootAsyncInstance;
const result = await rootAsync.ResultFromDecorate(3) as ResultFromDecorateInstance;
// result.computed = 84, result.result = 252
```

### Pattern 2: @decorate() Class with Async Sub-types

```typescript
// src/entities/async.entity.ts
import { define, decorate } from 'mnemonica';

@decorate()
export class SyncBase {
  baseValue: string = '';

  constructor(data: { baseValue: string }) {
    this.baseValue = data.baseValue;
  }
}

// Define SubAsync on SyncBase
export const SubAsync = (SyncBase as unknown as {
  define: (name: string, handler: Function) => typeof SubAsync;
}).define('SubAsync', async function (this: SubAsyncInstance, asyncData: { delay: number; extra: string }) {
  await sleep(100);  // Simulate long operation
  this.delay = asyncData.delay;
  this.extra = asyncData.extra;
  this.processed = `${this.baseValue}-${asyncData.extra}`;
  return this;
});

// Define SubDecorate on SubAsync
export const SubDecorate = SubAsync.define('SubDecorate', function (
  this: SubDecorateInstance,
  decorateValue: string
) {
  this.decorateValue = decorateValue;
  this.combined = `${this.processed}:${decorateValue}`;
  return this;
});
```

Usage:
```typescript
// await new SyncBase, then chain SubAsync, then SubDecorate
const syncBase = new SyncBase({ baseValue: 'hello' });
const subAsync = await (syncBase as unknown as SubAsyncInstance).SubAsync({
  delay: 100,
  extra: 'world'
}) as SubAsyncInstance;
const subDecorate = await subAsync.SubDecorate('decorated') as SubDecorateInstance;
// subDecorate.combined = "hello-world:decorated"
```

### Key Concepts for Async Constructors

1. **Async constructors work with `await new Type()`** - Mnemonica handles the Promise
2. **`return this` is required** - The constructor must return the instance
3. **Sub-types are accessible after await** - `rootAsync.ResultFromDecorate`
4. **@decorate() enables sub-types on classes** - Classes can have async sub-types too
5. **Sleep simulates real async operations** - Database calls, HTTP requests, etc.

See the full implementation in:
- `src/entities/async.entity.ts` - Entity definitions
- `src/async.controller.ts` - API endpoints
- `src/dto/async.dto.ts` - Request/response DTOs

## Example Requests

Using the Swagger UI at `http://localhost:3000/api-docs`:

1. Navigate to the Swagger UI
2. Expand the desired endpoint (e.g., `POST /users`)
3. Click "Try it out"
4. Enter the request body:
   ```json
   {
     "email": "user@example.com",
     "name": "John Doe"
   }
   ```
5. Click "Execute"

Or using curl:

```bash
# Create a user
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","name":"John"}'

# Create an admin
curl -X POST http://localhost:3000/admins \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","name":"Admin","role":"admin","permissions":["read","write"]}'

# Create a super admin
curl -X POST http://localhost:3000/super-admins \
  -H "Content-Type: application/json" \
  -d '{"email":"super@example.com","name":"Super","role":"superadmin","permissions":["read","write","delete"],"domain":"global"}'

# Async Pattern 1: RootAsync then ResultFromDecorate
curl -X POST http://localhost:3000/async/root-async/result \
  -H "Content-Type: application/json" \
  -d '{"value":42,"multiplier":3}'

# Async Pattern 2: Sync -> SubAsync -> SubDecorate (full chain)
curl -X POST http://localhost:3000/async/sync-base/sub-async/sub-decorate \
  -H "Content-Type: application/json" \
  -d '{"baseValue":"hello","delay":100,"extra":"world","decorateValue":"decorated"}'
```

## How Tactica Detects This

When you run `npx tactica` in this project, it will:

1. Detect the `define()` calls in `entities/user.entity.ts`
2. Build the type hierarchy: UserEntity → AdminEntity → SuperAdminEntity
3. Generate type definitions in `.tactica/types.ts`

## Benefits of This Pattern

1. **Runtime Inheritance** - Mnemonica provides prototype chain inheritance
2. **Type Safety** - TypeScript interfaces ensure compile-time safety
3. **Validation** - class-validator ensures runtime data integrity
4. **API Documentation** - Swagger provides interactive API docs
5. **Clean Architecture** - Separation of concerns (DTOs, Entities, Controllers)

## Notes

- This example uses `define()` instead of `@decorate()` to avoid decorator conflicts
- The `new Entity(data)` pattern creates mnemonica instances
- Each entity has mnemonica's internal properties like `__type__`
- Swagger decorators provide automatic API documentation
