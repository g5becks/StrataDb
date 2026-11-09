# Installation

## Requirements

::: danger Bun Required
StrataDB **only works with Bun**. It uses `bun:sqlite` which is not available in Node.js or Deno.
:::

::: warning ESM Only
StrataDB is an ESM-only package. It does not provide CommonJS exports.
:::

- [Bun](https://bun.com) **1.4.4 or newer**
- SQLite **3.45.0 or newer** for JSONB. On macOS, use `Database.setCustomSQLite()` before opening a connection if the system SQLite is older.

## Install StrataDB

```bash
bun add stratadb
```

## Optional: Validation Libraries

StrataDB works with any Standard Schema compatible validation library:

```bash
# Choose one (or none)
bun add zod        # Most popular
bun add arktype    # Best TypeScript integration
bun add valibot    # Lightweight alternative
```

See [Validation](/guide/validation) for usage examples.

## TypeScript Configuration

StrataDB is written in TypeScript and includes type definitions. For best results, enable strict mode in your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "moduleResolution": "bundler",
    "target": "ESNext",
    "module": "ESNext",
    "types": ["bun"]
  }
}
```

## Verify Installation

```typescript
import { Strata } from 'stratadb'

const db = new Strata({ database: ':memory:' })
console.log('StrataDB is working!')
db.close()
```

Run with:

```bash
bun run your-file.ts
```
