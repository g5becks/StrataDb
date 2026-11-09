/**
 * Type tests for nested field support
 */

import { expectTypeOf } from "expect-type"
import { createSchema, type Document } from "../../src/index.js"

// Test: Nested field names are accepted
{
  type User = Document<{
    name: string
    profile?: {
      bio: string
      avatar: string
    }
  }>

  const schema = createSchema<Omit<User, "_id" | "createdAt" | "updatedAt">>()
    .field("name", { type: "TEXT", indexed: true })
    .field("profile.bio", { type: "TEXT", indexed: true })
    .field("profile.avatar", { type: "TEXT", indexed: false })
    .build()

  expectTypeOf(schema).toEqualTypeOf<typeof schema>()
}

// Test: Multi-level nested fields work
{
  type Config = Document<{
    name: string
    settings?: {
      display?: {
        theme: string
        fontSize: number
      }
    }
  }>

  const schema = createSchema<Omit<Config, "_id" | "createdAt" | "updatedAt">>()
    .field("name", { type: "TEXT", indexed: true })
    .field("settings.display.theme", { type: "TEXT", indexed: true })
    .field("settings.display.fontSize", { type: "INTEGER", indexed: false })
    .build()

  expectTypeOf(schema).toEqualTypeOf<typeof schema>()
}

// Test: Compound indexes accept nested field names
{
  type Alert = Document<{
    name: string
    isActive: boolean
    watchlistItem?: {
      ticker: string
      symbol: string
    }
  }>

  const schema = createSchema<Omit<Alert, "_id" | "createdAt" | "updatedAt">>()
    .field("name", { type: "TEXT", indexed: true })
    .field("isActive", { type: "INTEGER", indexed: true })
    .field("watchlistItem.ticker", { type: "TEXT", indexed: true })
    .field("watchlistItem.symbol", { type: "TEXT", indexed: true })
    .compoundIndex("watchlist_active", ["watchlistItem.ticker", "isActive"])
    .compoundIndex("watchlist_symbols", [
      "watchlistItem.ticker",
      "watchlistItem.symbol",
    ])
    .build()

  expectTypeOf(schema).toEqualTypeOf<typeof schema>()
}

// Test: Top-level fields still work normally
{
  type User = Document<{
    name: string
    email: string
    age: number
  }>

  const schema = createSchema<Omit<User, "_id" | "createdAt" | "updatedAt">>()
    .field("name", { type: "TEXT", indexed: true })
    .field("email", { type: "TEXT", indexed: true, unique: true })
    .field("age", { type: "INTEGER", indexed: true })
    .compoundIndex("name_age", ["name", "age"])
    .build()

  expectTypeOf(schema).toEqualTypeOf<typeof schema>()
}

// Test: Mix of top-level and nested fields
{
  type Product = Document<{
    name: string
    price: number
    inventory?: {
      warehouse: string
      quantity: number
    }
  }>

  const schema = createSchema<
    Omit<Product, "_id" | "createdAt" | "updatedAt">
  >()
    .field("name", { type: "TEXT", indexed: true })
    .field("price", { type: "INTEGER", indexed: true })
    .field("inventory.warehouse", { type: "TEXT", indexed: true })
    .field("inventory.quantity", { type: "INTEGER", indexed: true })
    .compoundIndex("warehouse_lookup", ["inventory.warehouse", "name"])
    .build()

  expectTypeOf(schema).toEqualTypeOf<typeof schema>()
}

// Test: Deeply nested fields (3+ levels)
{
  type Config = Document<{
    name: string
    user?: {
      profile?: {
        settings?: {
          display?: {
            theme: string
          }
        }
      }
    }
  }>

  const schema = createSchema<Omit<Config, "_id" | "createdAt" | "updatedAt">>()
    .field("name", { type: "TEXT", indexed: true })
    .field("user.profile.settings.display.theme", {
      type: "TEXT",
      indexed: true,
    })
    .build()

  expectTypeOf(schema).toEqualTypeOf<typeof schema>()
}

// Test: Real-world Alert schema
{
  type Alert = Document<{
    name: string
    priority: "low" | "medium" | "high" | "urgent"
    bias: "neutral" | "bullish" | "bearish"
    isActive: boolean
    logAlways: boolean
    isTemplate: boolean
    templateName?: string
    watchlistItem?: {
      ticker: string
      symbol: string
      bias: "neutral" | "bullish" | "bearish"
    }
  }>

  const schema = createSchema<Omit<Alert, "_id" | "createdAt" | "updatedAt">>()
    .field("name", { type: "TEXT", indexed: true, unique: true })
    .field("isActive", { type: "INTEGER", indexed: true })
    .field("isTemplate", { type: "INTEGER", indexed: true })
    .field("templateName", { type: "TEXT", indexed: true })
    .field("priority", { type: "TEXT", indexed: true })
    .field("bias", { type: "TEXT", indexed: true })
    .field("watchlistItem.ticker", { type: "TEXT", indexed: true })
    .field("watchlistItem.symbol", { type: "TEXT", indexed: true })
    .field("watchlistItem.bias", { type: "TEXT", indexed: true })
    .compoundIndex("watchlist_active", ["watchlistItem.ticker", "isActive"])
    .compoundIndex("template_name", ["isTemplate", "templateName"])
    .timestamps(true)
    .build()

  expectTypeOf(schema).toEqualTypeOf<typeof schema>()
}
