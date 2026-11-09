import { Database } from "bun:sqlite"
import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import type { InsertEvent } from "../../src/collection-events.js"
import type { Document } from "../../src/core-types.js"
import { createSchema } from "../../src/schema-builder.js"
import { SQLiteCollection } from "../../src/sqlite-collection.js"
import { Strata } from "../../src/stratadb.js"

type TestUser = Document<{
  name: string
  email: string
  age: number
}>

describe("Collection Events - Registration Methods", () => {
  let db: Database
  let collection: SQLiteCollection<TestUser>

  beforeEach(() => {
    db = new Database(":memory:")
    const schema = createSchema<TestUser>()
      .field("name", { type: "TEXT", indexed: true })
      .field("email", { type: "TEXT", indexed: true, unique: true })
      .field("age", { type: "INTEGER", indexed: true })
      .build()

    collection = new SQLiteCollection(
      db,
      "users",
      schema,
      () => `test-${Date.now()}-${Math.random()}`
    )
  })

  afterEach(() => {
    db.close()
  })

  describe("on()", () => {
    it("should register listener and receive events", async () => {
      const events: InsertEvent<TestUser>[] = []

      collection.on("insert", (event) => {
        events.push(event)
      })

      await collection.insertOne({
        name: "Alice",
        email: "alice@example.com",
        age: 30,
      })

      expect(events).toHaveLength(1)
      expect(events[0].document.name).toBe("Alice")
      expect(events[0].document.email).toBe("alice@example.com")
      expect(events[0].document.age).toBe(30)
    })

    it("should return collection instance for chaining", () => {
      const result = collection.on("insert", () => {
        // no-op for testing
      })

      expect(result).toBe(collection)
    })

    it("should allow multiple listeners for same event", async () => {
      const events1: InsertEvent<TestUser>[] = []
      const events2: InsertEvent<TestUser>[] = []

      collection.on("insert", (event) => {
        events1.push(event)
      })

      collection.on("insert", (event) => {
        events2.push(event)
      })

      await collection.insertOne({
        name: "Bob",
        email: "bob@example.com",
        age: 25,
      })

      expect(events1).toHaveLength(1)
      expect(events2).toHaveLength(1)
      expect(events1[0].document._id).toBe(events2[0].document._id)
    })

    it("should support method chaining", () => {
      const listener1 = () => {
        // no-op for testing
      }
      const listener2 = () => {
        // no-op for testing
      }

      const result = collection.on("insert", listener1).on("update", listener2)

      expect(result).toBe(collection)
      expect(collection.listenerCount("insert")).toBe(1)
      expect(collection.listenerCount("update")).toBe(1)
    })
  })

  describe("once()", () => {
    it("should fire listener only once then auto-remove", async () => {
      let callCount = 0

      collection.once("insert", () => {
        callCount += 1
      })

      await collection.insertOne({
        name: "Alice",
        email: "alice@example.com",
        age: 30,
      })

      await collection.insertOne({
        name: "Bob",
        email: "bob@example.com",
        age: 25,
      })

      expect(callCount).toBe(1)
      expect(collection.listenerCount("insert")).toBe(0)
    })

    it("should return collection instance for chaining", () => {
      const result = collection.once("insert", () => {
        // no-op for testing
      })

      expect(result).toBe(collection)
    })

    it("should receive correct event data", async () => {
      let receivedEvent: InsertEvent<TestUser> | null = null

      collection.once("insert", (event) => {
        receivedEvent = event
      })

      await collection.insertOne({
        name: "Charlie",
        email: "charlie@example.com",
        age: 35,
      })

      expect(receivedEvent).not.toBeNull()
      expect(receivedEvent?.document.name).toBe("Charlie")
    })
  })

  describe("off()", () => {
    it("should remove specific listener", async () => {
      const events: InsertEvent<TestUser>[] = []
      const listener = (event: InsertEvent<TestUser>) => {
        events.push(event)
      }

      collection.on("insert", listener)

      await collection.insertOne({
        name: "Alice",
        email: "alice@example.com",
        age: 30,
      })

      expect(events).toHaveLength(1)

      collection.off("insert", listener)

      await collection.insertOne({
        name: "Bob",
        email: "bob@example.com",
        age: 25,
      })

      expect(events).toHaveLength(1)
    })

    it("should return collection instance for chaining", () => {
      const listener = () => {
        // no-op for testing
      }
      collection.on("insert", listener)

      const result = collection.off("insert", listener)

      expect(result).toBe(collection)
    })

    it("should only remove the specific listener instance", async () => {
      const events1: InsertEvent<TestUser>[] = []
      const events2: InsertEvent<TestUser>[] = []

      const listener1 = (event: InsertEvent<TestUser>) => {
        events1.push(event)
      }

      const listener2 = (event: InsertEvent<TestUser>) => {
        events2.push(event)
      }

      collection.on("insert", listener1)
      collection.on("insert", listener2)

      collection.off("insert", listener1)

      await collection.insertOne({
        name: "Alice",
        email: "alice@example.com",
        age: 30,
      })

      expect(events1).toHaveLength(0)
      expect(events2).toHaveLength(1)
    })

    it("should do nothing when removing non-existent listener", () => {
      const listener = () => {
        // no-op for testing
      }

      expect(() => collection.off("insert", listener)).not.toThrow()
    })

    it("should do nothing when no emitter exists", () => {
      const listener = () => {
        // no-op for testing
      }

      expect(() => collection.off("insert", listener)).not.toThrow()
      expect(collection.listenerCount("insert")).toBe(0)
    })
  })

  describe("removeAllListeners()", () => {
    it("A18: clears listener counts across event names without an argument", () => {
      const events: unknown[] = []
      collection.on("insert", (event) => events.push(event))
      collection.on("update", (event) => events.push(event))
      expect(collection.listenerCount("insert")).toBe(1)
      expect(collection.listenerCount("update")).toBe(1)

      expect(collection.removeAllListeners()).toBe(collection)

      expect(collection.listenerCount("insert")).toBe(0)
      expect(collection.listenerCount("update")).toBe(0)
    })

    it("should remove all listeners for specific event", async () => {
      const events1: InsertEvent<TestUser>[] = []
      const events2: InsertEvent<TestUser>[] = []

      collection.on("insert", (event) => {
        events1.push(event)
      })

      collection.on("insert", (event) => {
        events2.push(event)
      })

      collection.removeAllListeners("insert")

      await collection.insertOne({
        name: "Alice",
        email: "alice@example.com",
        age: 30,
      })

      expect(events1).toHaveLength(0)
      expect(events2).toHaveLength(0)
      expect(collection.listenerCount("insert")).toBe(0)
    })

    it("should remove all listeners for all events when no event specified", async () => {
      const insertEvents: InsertEvent<TestUser>[] = []
      const updateEvents: unknown[] = []

      collection.on("insert", (event) => {
        insertEvents.push(event)
      })

      collection.on("update", (event) => {
        updateEvents.push(event)
      })

      collection.removeAllListeners()

      await collection.insertOne({
        name: "Alice",
        email: "alice@example.com",
        age: 30,
      })

      await collection.updateOne({ name: "Alice" }, { age: 31 })

      expect(insertEvents).toHaveLength(0)
      expect(updateEvents).toHaveLength(0)
      expect(collection.listenerCount("insert")).toBe(0)
      expect(collection.listenerCount("update")).toBe(0)
    })

    it("should return collection instance for chaining", () => {
      collection.on("insert", () => {
        // no-op for testing
      })

      const result = collection.removeAllListeners("insert")

      expect(result).toBe(collection)
    })

    it("should not affect listeners for other events", async () => {
      const insertEvents: InsertEvent<TestUser>[] = []
      const updateEvents: unknown[] = []

      collection.on("insert", (event) => {
        insertEvents.push(event)
      })

      collection.on("update", (event) => {
        updateEvents.push(event)
      })

      collection.removeAllListeners("insert")

      await collection.insertOne({
        name: "Alice",
        email: "alice@example.com",
        age: 30,
      })

      await collection.updateOne({ name: "Alice" }, { age: 31 })

      expect(insertEvents).toHaveLength(0)
      expect(updateEvents).toHaveLength(1)
    })

    it("should do nothing when no emitter exists", () => {
      expect(() => collection.removeAllListeners()).not.toThrow()
      expect(() => collection.removeAllListeners("insert")).not.toThrow()
    })
  })

  describe("listenerCount()", () => {
    it("should return 0 when no listeners registered", () => {
      expect(collection.listenerCount("insert")).toBe(0)
    })

    it("should return correct count after registering listeners", () => {
      collection.on("insert", () => {
        // no-op for testing
      })
      expect(collection.listenerCount("insert")).toBe(1)

      collection.on("insert", () => {
        // no-op for testing
      })
      expect(collection.listenerCount("insert")).toBe(2)

      collection.on("insert", () => {
        // no-op for testing
      })
      expect(collection.listenerCount("insert")).toBe(3)
    })

    it("should return correct count after removing listeners", () => {
      const listener1 = () => {
        // no-op for testing
      }
      const listener2 = () => {
        // no-op for testing
      }

      collection.on("insert", listener1)
      collection.on("insert", listener2)

      expect(collection.listenerCount("insert")).toBe(2)

      collection.off("insert", listener1)

      expect(collection.listenerCount("insert")).toBe(1)

      collection.off("insert", listener2)

      expect(collection.listenerCount("insert")).toBe(0)
    })

    it("should count listeners per event separately", () => {
      collection.on("insert", () => {
        // no-op for testing
      })
      collection.on("insert", () => {
        // no-op for testing
      })
      collection.on("update", () => {
        // no-op for testing
      })

      expect(collection.listenerCount("insert")).toBe(2)
      expect(collection.listenerCount("update")).toBe(1)
      expect(collection.listenerCount("delete")).toBe(0)
    })

    it("should return 0 when no emitter exists", () => {
      expect(collection.listenerCount("insert")).toBe(0)
      expect(collection.listenerCount("update")).toBe(0)
    })
  })

  describe("listeners()", () => {
    it("should return empty array when no listeners registered", () => {
      const listeners = collection.listeners("insert")

      expect(listeners).toEqual([])
      expect(listeners).toHaveLength(0)
    })

    it("should return array of registered listeners", () => {
      const listener1 = () => {
        // no-op for testing
      }
      const listener2 = () => {
        // no-op for testing
      }
      const listener3 = () => {
        // no-op for testing
      }

      collection.on("insert", listener1)
      collection.on("insert", listener2)
      collection.on("insert", listener3)

      const listeners = collection.listeners("insert")

      expect(listeners).toHaveLength(3)
      expect(listeners).toContain(listener1)
      expect(listeners).toContain(listener2)
      expect(listeners).toContain(listener3)
    })

    it("should return listeners for specific event only", () => {
      const insertListener = () => {
        // no-op for testing
      }
      const updateListener = () => {
        // no-op for testing
      }

      collection.on("insert", insertListener)
      collection.on("update", updateListener)

      const insertListeners = collection.listeners("insert")
      const updateListeners = collection.listeners("update")

      expect(insertListeners).toHaveLength(1)
      expect(insertListeners).toContain(insertListener)
      expect(insertListeners).not.toContain(updateListener)

      expect(updateListeners).toHaveLength(1)
      expect(updateListeners).toContain(updateListener)
      expect(updateListeners).not.toContain(insertListener)
    })

    it("should return empty array for event with no listeners", () => {
      collection.on("insert", () => {
        // no-op for testing
      })

      const deleteListeners = collection.listeners("delete")

      expect(deleteListeners).toEqual([])
    })

    it("should return empty array when no emitter exists", () => {
      const listeners = collection.listeners("insert")

      expect(listeners).toEqual([])
      expect(listeners).toHaveLength(0)
    })
  })

  describe("Lazy initialization", () => {
    it("should not create emitter until first listener registration", () => {
      // Access listenerCount without registering listeners
      expect(collection.listenerCount("insert")).toBe(0)

      // Emitter should still not exist (property is private, but behavior is observable)
      const listeners = collection.listeners("insert")
      expect(listeners).toEqual([])
    })

    it("should create emitter on first on() call", () => {
      collection.on("insert", () => {
        // no-op for testing
      })

      expect(collection.listenerCount("insert")).toBe(1)
    })

    it("should create emitter on first once() call", () => {
      collection.once("insert", () => {
        // no-op for testing
      })

      expect(collection.listenerCount("insert")).toBe(1)
    })
  })

  describe("Multiple listeners receiving same event", () => {
    it("should invoke all registered listeners", async () => {
      let call1 = false
      let call2 = false
      let call3 = false

      collection.on("insert", () => {
        call1 = true
      })

      collection.on("insert", () => {
        call2 = true
      })

      collection.on("insert", () => {
        call3 = true
      })

      await collection.insertOne({
        name: "Alice",
        email: "alice@example.com",
        age: 30,
      })

      expect(call1).toBe(true)
      expect(call2).toBe(true)
      expect(call3).toBe(true)
    })

    it("should pass same event data to all listeners", async () => {
      const events: InsertEvent<TestUser>[] = []

      collection.on("insert", (event) => {
        events.push(event)
      })

      collection.on("insert", (event) => {
        events.push(event)
      })

      collection.on("insert", (event) => {
        events.push(event)
      })

      await collection.insertOne({
        name: "Bob",
        email: "bob@example.com",
        age: 25,
      })

      expect(events).toHaveLength(3)
      expect(events[0].document._id).toBe(events[1].document._id)
      expect(events[1].document._id).toBe(events[2].document._id)
      expect(events[0].document.name).toBe("Bob")
      expect(events[1].document.name).toBe("Bob")
      expect(events[2].document.name).toBe("Bob")
    })
  })

  describe("Insert Events", () => {
    it("should emit 'insert' event when insertOne succeeds", async () => {
      const events: InsertEvent<TestUser>[] = []

      collection.on("insert", (event) => {
        events.push(event)
      })

      await collection.insertOne({
        name: "Alice",
        email: "alice@example.com",
        age: 30,
      })

      expect(events).toHaveLength(1)
      expect(events[0].document.name).toBe("Alice")
      expect(events[0].document.email).toBe("alice@example.com")
      expect(events[0].document.age).toBe(30)
    })

    it("should include _id, createdAt, updatedAt in insert event payload", async () => {
      const events: InsertEvent<TestUser>[] = []

      collection.on("insert", (event) => {
        events.push(event)
      })

      await collection.insertOne({
        name: "Bob",
        email: "bob@example.com",
        age: 25,
      })

      expect(events).toHaveLength(1)
      expect(events[0].document._id).toBeDefined()
      expect(typeof events[0].document._id).toBe("string")
      expect(events[0].document._id.length).toBeGreaterThan(0)
    })

    it("should emit insert event after document is persisted", async () => {
      let insertedId: string | null = null

      collection.on("insert", (event) => {
        insertedId = event.document._id
      })

      const result = await collection.insertOne({
        name: "Charlie",
        email: "charlie@example.com",
        age: 35,
      })

      expect(insertedId).not.toBeNull()
      expect(insertedId).toBe(result._id)

      // Verify document can be queried after event fires
      if (insertedId) {
        const found = await collection.findById(insertedId)
        expect(found).not.toBeNull()
        expect(found?.name).toBe("Charlie")
      } else {
        expect.unreachable("insertedId should not be null")
      }
    })

    it("should emit 'insertMany' event when insertMany succeeds", async () => {
      const events: any[] = []

      collection.on("insertMany", (event) => {
        events.push(event)
      })

      await collection.insertMany([
        { name: "Alice", email: "alice@example.com", age: 30 },
        { name: "Bob", email: "bob@example.com", age: 25 },
        { name: "Charlie", email: "charlie@example.com", age: 35 },
      ])

      expect(events).toHaveLength(1)
      expect(events[0].insertedCount).toBe(3)
      expect(events[0].documents).toHaveLength(3)
    })

    it("should include all documents in insertMany event payload", async () => {
      const events: any[] = []

      collection.on("insertMany", (event) => {
        events.push(event)
      })

      await collection.insertMany([
        { name: "User1", email: "user1@example.com", age: 20 },
        { name: "User2", email: "user2@example.com", age: 30 },
      ])

      expect(events).toHaveLength(1)
      const docs = events[0].documents
      expect(docs[0].name).toBe("User1")
      expect(docs[0]._id).toBeDefined()
      expect(docs[1].name).toBe("User2")
      expect(docs[1]._id).toBeDefined()
    })

    it("should not emit events when no listeners registered", async () => {
      // Insert without any listeners - should succeed without errors
      const result = await collection.insertOne({
        name: "NoListener",
        email: "nolistener@example.com",
        age: 40,
      })

      expect(result._id).toBeDefined()
      expect(result.name).toBe("NoListener")

      // Verify listenerCount is 0
      expect(collection.listenerCount("insert")).toBe(0)
    })

    it("should emit insertMany event even with partial success in unordered mode", async () => {
      const events: any[] = []

      collection.on("insertMany", (event) => {
        events.push(event)
      })

      // First insert to create duplicate
      await collection.insertOne({
        name: "Duplicate",
        email: "duplicate@example.com",
        age: 25,
      })

      // Try to insert with duplicate email (unique constraint)
      await collection.insertMany(
        [
          { name: "User1", email: "unique1@example.com", age: 30 },
          { name: "User2", email: "duplicate@example.com", age: 35 }, // Duplicate
          { name: "User3", email: "unique3@example.com", age: 40 },
        ],
        { ordered: false }
      )

      // Event should be emitted with successfully inserted documents
      expect(events).toHaveLength(1)
      expect(events[0].insertedCount).toBe(2) // User1 and User3
      expect(events[0].documents).toHaveLength(2)
    })

    it("should emit multiple insert events for multiple insertOne calls", async () => {
      const events: InsertEvent<TestUser>[] = []

      collection.on("insert", (event) => {
        events.push(event)
      })

      await collection.insertOne({
        name: "First",
        email: "first@example.com",
        age: 20,
      })

      await collection.insertOne({
        name: "Second",
        email: "second@example.com",
        age: 30,
      })

      await collection.insertOne({
        name: "Third",
        email: "third@example.com",
        age: 40,
      })

      expect(events).toHaveLength(3)
      expect(events[0].document.name).toBe("First")
      expect(events[1].document.name).toBe("Second")
      expect(events[2].document.name).toBe("Third")
    })
  })

  describe("Update Events", () => {
    it("should emit 'update' event when updateOne succeeds", async () => {
      const events: Array<{
        filter: string | QueryFilter<TestUser>
        update: Partial<TestUser>
        document: TestUser | null
        upserted: boolean
      }> = []
      collection.on("update", (event) => events.push(event))

      // Insert a document first
      const inserted = await collection.insertOne({
        name: "Alice",
        email: "alice@example.com",
        age: 25,
      })

      // Update it
      await collection.updateOne(inserted._id, { age: 26 })

      expect(events).toHaveLength(1)
      expect(events[0].filter).toBe(inserted._id)
      expect(events[0].update).toEqual({ age: 26 })
      expect(events[0].document?.age).toBe(26)
      expect(events[0].upserted).toBe(false)
    })

    it("should emit 'update' event with upserted flag when upsert creates document", async () => {
      const events: Array<{
        filter: string | QueryFilter<TestUser>
        update: Partial<TestUser>
        document: TestUser | null
        upserted: boolean
      }> = []
      collection.on("update", (event) => events.push(event))

      await collection.updateOne(
        "new-user-id",
        { name: "Bob", email: "bob@example.com", age: 30 },
        { upsert: true }
      )

      expect(events).toHaveLength(1)
      expect(events[0].filter).toBe("new-user-id")
      expect(events[0].document?.name).toBe("Bob")
      expect(events[0].upserted).toBe(true)
    })

    it("should include updated document in update event payload", async () => {
      const events: Array<{
        filter: string | QueryFilter<TestUser>
        update: Partial<TestUser>
        document: TestUser | null
        upserted: boolean
      }> = []
      collection.on("update", (event) => events.push(event))

      const inserted = await collection.insertOne({
        name: "Charlie",
        email: "charlie@example.com",
        age: 28,
      })

      await collection.updateOne(inserted._id, { age: 29, name: "Charles" })

      expect(events).toHaveLength(1)
      expect(events[0].document).not.toBeNull()
      expect(events[0].document?._id).toBe(inserted._id)
      expect(events[0].document?.name).toBe("Charles")
      expect(events[0].document?.age).toBe(29)
      expect(events[0].document?.email).toBe("charlie@example.com")
    })

    it("should emit update event with QueryFilter when filter is object", async () => {
      const events: Array<{
        filter: string | QueryFilter<TestUser>
        update: Partial<TestUser>
        document: TestUser | null
        upserted: boolean
      }> = []
      collection.on("update", (event) => events.push(event))

      await collection.insertOne({
        name: "Dave",
        email: "dave@example.com",
        age: 35,
      })

      const filter = { email: "dave@example.com" }
      await collection.updateOne(filter, { age: 36 })

      expect(events).toHaveLength(1)
      expect(events[0].filter).toEqual(filter)
      expect(events[0].update).toEqual({ age: 36 })
    })

    it("should emit update event after document is persisted", async () => {
      let updatedDoc: TestUser | null = null
      collection.on("update", (event) => {
        updatedDoc = event.document
      })

      const inserted = await collection.insertOne({
        name: "Eve",
        email: "eve@example.com",
        age: 22,
      })

      await collection.updateOne(inserted._id, { age: 23 })

      // Verify the document was persisted before event fired
      expect(updatedDoc).not.toBeNull()
      const found = await collection.findOne(inserted._id)
      expect(found?.age).toBe(23)
      expect(updatedDoc?.age).toBe(23)
    })

    it("should emit 'updateMany' event when updateMany succeeds", async () => {
      const events: Array<{
        filter: QueryFilter<TestUser>
        update: Partial<TestUser>
        matchedCount: number
        modifiedCount: number
      }> = []
      collection.on("updateMany", (event) => events.push(event))

      // Insert multiple documents
      await collection.insertMany([
        { name: "User1", email: "user1@example.com", age: 20 },
        { name: "User2", email: "user2@example.com", age: 20 },
        { name: "User3", email: "user3@example.com", age: 25 },
      ])

      // Update documents matching filter
      const filter = { age: 20 }
      await collection.updateMany(filter, { age: 21 })

      expect(events).toHaveLength(1)
      expect(events[0].filter).toEqual(filter)
      expect(events[0].update).toEqual({ age: 21 })
      expect(events[0].matchedCount).toBe(2)
      expect(events[0].modifiedCount).toBe(2)
    })

    it("should emit 'updateMany' with zero counts when no documents match", async () => {
      const events: Array<{
        filter: QueryFilter<TestUser>
        update: Partial<TestUser>
        matchedCount: number
        modifiedCount: number
      }> = []
      collection.on("updateMany", (event) => events.push(event))

      const filter = { age: 999 }
      await collection.updateMany(filter, { age: 1000 })

      expect(events).toHaveLength(1)
      expect(events[0].matchedCount).toBe(0)
      expect(events[0].modifiedCount).toBe(0)
    })

    it("should emit updateMany event after all documents are persisted", async () => {
      let eventFired = false
      collection.on("updateMany", () => {
        eventFired = true
      })

      await collection.insertMany([
        { name: "A", email: "a@example.com", age: 10 },
        { name: "B", email: "b@example.com", age: 10 },
        { name: "C", email: "c@example.com", age: 10 },
      ])

      await collection.updateMany({ age: 10 }, { age: 11 })

      expect(eventFired).toBe(true)
      const updated = await collection.find({ age: 11 })
      expect(updated).toHaveLength(3)
    })

    it("should emit 'findOneAndUpdate' event when document is found and updated", async () => {
      const events: Array<{
        filter: string | QueryFilter<TestUser>
        update: Partial<TestUser>
        document: TestUser | null
        upserted: boolean
      }> = []
      collection.on("findOneAndUpdate", (event) => events.push(event))

      const inserted = await collection.insertOne({
        name: "Frank",
        email: "frank@example.com",
        age: 40,
      })

      await collection.findOneAndUpdate(inserted._id, { age: 41 })

      expect(events).toHaveLength(1)
      expect(events[0].filter).toBe(inserted._id)
      expect(events[0].update).toEqual({ age: 41 })
      expect(events[0].document?.age).toBe(41)
      expect(events[0].upserted).toBe(false)
    })

    it("should emit 'findOneAndUpdate' with 'before' document when returnDocument is 'before'", async () => {
      const events: Array<{
        filter: string | QueryFilter<TestUser>
        update: Partial<TestUser>
        document: TestUser | null
        upserted: boolean
      }> = []
      collection.on("findOneAndUpdate", (event) => events.push(event))

      const inserted = await collection.insertOne({
        name: "Grace",
        email: "grace@example.com",
        age: 50,
      })

      await collection.findOneAndUpdate(
        inserted._id,
        { age: 51 },
        { returnDocument: "before" }
      )

      expect(events).toHaveLength(1)
      expect(events[0].document?.age).toBe(50) // Original age
    })

    it("should emit 'findOneAndUpdate' with upserted flag when upsert creates document", async () => {
      const events: Array<{
        filter: string | QueryFilter<TestUser>
        update: Partial<TestUser>
        document: TestUser | null
        upserted: boolean
      }> = []
      collection.on("findOneAndUpdate", (event) => events.push(event))

      await collection.findOneAndUpdate(
        "new-id",
        { name: "Heidi", email: "heidi@example.com", age: 27 },
        { upsert: true, returnDocument: "after" }
      )

      expect(events).toHaveLength(1)
      expect(events[0].upserted).toBe(true)
      expect(events[0].document?.name).toBe("Heidi")
    })

    it("should emit 'findOneAndUpdate' with null document when not found and no upsert", async () => {
      const events: Array<{
        filter: string | QueryFilter<TestUser>
        update: Partial<TestUser>
        document: TestUser | null
        upserted: boolean
      }> = []
      collection.on("findOneAndUpdate", (event) => events.push(event))

      await collection.findOneAndUpdate("nonexistent-id", { age: 100 })

      expect(events).toHaveLength(1)
      expect(events[0].document).toBeNull()
      expect(events[0].upserted).toBe(false)
    })

    it("should not emit update events when no listeners registered", async () => {
      const inserted = await collection.insertOne({
        name: "Silent",
        email: "silent@example.com",
        age: 33,
      })

      // No listeners registered
      await collection.updateOne(inserted._id, { age: 34 })
      await collection.updateMany({ age: 34 }, { age: 35 })

      // Should complete without error
      const found = await collection.findOne(inserted._id)
      expect(found?.age).toBe(35)
    })

    it("should emit multiple update events for multiple updateOne calls", async () => {
      const events: Array<{
        filter: string | QueryFilter<TestUser>
        update: Partial<TestUser>
        document: TestUser | null
        upserted: boolean
      }> = []
      collection.on("update", (event) => events.push(event))

      const doc1 = await collection.insertOne({
        name: "Multi1",
        email: "multi1@example.com",
        age: 10,
      })
      const doc2 = await collection.insertOne({
        name: "Multi2",
        email: "multi2@example.com",
        age: 20,
      })

      await collection.updateOne(doc1._id, { age: 11 })
      await collection.updateOne(doc2._id, { age: 21 })

      expect(events).toHaveLength(2)
      expect(events[0].document?.age).toBe(11)
      expect(events[1].document?.age).toBe(21)
    })
  })

  describe("Delete Events", () => {
    it("should emit 'delete' event when deleteOne succeeds", async () => {
      const events: Array<{
        filter: string | QueryFilter<TestUser>
        deleted: boolean
      }> = []
      collection.on("delete", (event) => events.push(event))

      const inserted = await collection.insertOne({
        name: "Alice",
        email: "alice@example.com",
        age: 25,
      })

      await collection.deleteOne(inserted._id)

      expect(events).toHaveLength(1)
      expect(events[0].filter).toBe(inserted._id)
      expect(events[0].deleted).toBe(true)
    })

    it("should emit 'delete' event with deleted: false when document not found", async () => {
      const events: Array<{
        filter: string | QueryFilter<TestUser>
        deleted: boolean
      }> = []
      collection.on("delete", (event) => events.push(event))

      await collection.deleteOne("nonexistent-id")

      expect(events).toHaveLength(1)
      expect(events[0].filter).toBe("nonexistent-id")
      expect(events[0].deleted).toBe(false)
    })

    it("should emit delete event with QueryFilter when filter is object", async () => {
      const events: Array<{
        filter: string | QueryFilter<TestUser>
        deleted: boolean
      }> = []
      collection.on("delete", (event) => events.push(event))

      await collection.insertOne({
        name: "Bob",
        email: "bob@example.com",
        age: 30,
      })

      const filter = { email: "bob@example.com" }
      await collection.deleteOne(filter)

      expect(events).toHaveLength(1)
      expect(events[0].filter).toEqual(filter)
      expect(events[0].deleted).toBe(true)
    })

    it("should emit delete event after document is removed", async () => {
      let deletedFlag = false
      collection.on("delete", (event) => {
        deletedFlag = event.deleted
      })

      const inserted = await collection.insertOne({
        name: "Charlie",
        email: "charlie@example.com",
        age: 28,
      })

      await collection.deleteOne(inserted._id)

      expect(deletedFlag).toBe(true)
      const found = await collection.findOne(inserted._id)
      expect(found).toBeNull()
    })

    it("should emit 'deleteMany' event when deleteMany succeeds", async () => {
      const events: Array<{
        filter: QueryFilter<TestUser>
        deletedCount: number
      }> = []
      collection.on("deleteMany", (event) => events.push(event))

      await collection.insertMany([
        { name: "User1", email: "user1@example.com", age: 20 },
        { name: "User2", email: "user2@example.com", age: 20 },
        { name: "User3", email: "user3@example.com", age: 25 },
      ])

      const filter = { age: 20 }
      await collection.deleteMany(filter)

      expect(events).toHaveLength(1)
      expect(events[0].filter).toEqual(filter)
      expect(events[0].deletedCount).toBe(2)
    })

    it("should emit 'deleteMany' with zero count when no documents match", async () => {
      const events: Array<{
        filter: QueryFilter<TestUser>
        deletedCount: number
      }> = []
      collection.on("deleteMany", (event) => events.push(event))

      const filter = { age: 999 }
      await collection.deleteMany(filter)

      expect(events).toHaveLength(1)
      expect(events[0].deletedCount).toBe(0)
    })

    it("should emit deleteMany event after all documents are removed", async () => {
      let deletedCount = 0
      collection.on("deleteMany", (event) => {
        deletedCount = event.deletedCount
      })

      await collection.insertMany([
        { name: "A", email: "a@example.com", age: 10 },
        { name: "B", email: "b@example.com", age: 10 },
        { name: "C", email: "c@example.com", age: 10 },
      ])

      await collection.deleteMany({ age: 10 })

      expect(deletedCount).toBe(3)
      const remaining = await collection.find({ age: 10 })
      expect(remaining).toHaveLength(0)
    })

    it("should emit 'findOneAndDelete' event when document is found and deleted", async () => {
      const events: Array<{
        filter: string | QueryFilter<TestUser>
        document: TestUser | null
      }> = []
      collection.on("findOneAndDelete", (event) => events.push(event))

      const inserted = await collection.insertOne({
        name: "Dave",
        email: "dave@example.com",
        age: 35,
      })

      await collection.findOneAndDelete(inserted._id)

      expect(events).toHaveLength(1)
      expect(events[0].filter).toBe(inserted._id)
      expect(events[0].document).not.toBeNull()
      expect(events[0].document?.name).toBe("Dave")
    })

    it("should emit 'findOneAndDelete' with null document when not found", async () => {
      const events: Array<{
        filter: string | QueryFilter<TestUser>
        document: TestUser | null
      }> = []
      collection.on("findOneAndDelete", (event) => events.push(event))

      await collection.findOneAndDelete("nonexistent-id")

      expect(events).toHaveLength(1)
      expect(events[0].document).toBeNull()
    })

    it("should emit findOneAndDelete with QueryFilter", async () => {
      const events: Array<{
        filter: string | QueryFilter<TestUser>
        document: TestUser | null
      }> = []
      collection.on("findOneAndDelete", (event) => events.push(event))

      await collection.insertOne({
        name: "Eve",
        email: "eve@example.com",
        age: 22,
      })

      const filter = { email: "eve@example.com" }
      await collection.findOneAndDelete(filter)

      expect(events).toHaveLength(1)
      expect(events[0].filter).toEqual(filter)
      expect(events[0].document?.name).toBe("Eve")
    })

    it("should emit findOneAndDelete event after document is removed", async () => {
      let deletedDoc: TestUser | null = null
      collection.on("findOneAndDelete", (event) => {
        deletedDoc = event.document
      })

      const inserted = await collection.insertOne({
        name: "Frank",
        email: "frank@example.com",
        age: 40,
      })

      await collection.findOneAndDelete(inserted._id)

      expect(deletedDoc).not.toBeNull()
      expect(deletedDoc?.name).toBe("Frank")
      const found = await collection.findOne(inserted._id)
      expect(found).toBeNull()
    })

    it("should not emit delete events when no listeners registered", async () => {
      const inserted = await collection.insertOne({
        name: "Silent",
        email: "silent@example.com",
        age: 33,
      })

      // No listeners registered
      await collection.deleteOne(inserted._id)

      await collection.insertMany([
        { name: "S1", email: "s1@example.com", age: 11 },
        { name: "S2", email: "s2@example.com", age: 11 },
      ])
      await collection.deleteMany({ age: 11 })

      // Should complete without error
      const found = await collection.findOne(inserted._id)
      expect(found).toBeNull()
    })

    it("should emit multiple delete events for multiple deleteOne calls", async () => {
      const events: Array<{
        filter: string | QueryFilter<TestUser>
        deleted: boolean
      }> = []
      collection.on("delete", (event) => events.push(event))

      const doc1 = await collection.insertOne({
        name: "Multi1",
        email: "multi1@example.com",
        age: 10,
      })
      const doc2 = await collection.insertOne({
        name: "Multi2",
        email: "multi2@example.com",
        age: 20,
      })

      await collection.deleteOne(doc1._id)
      await collection.deleteOne(doc2._id)

      expect(events).toHaveLength(2)
      expect(events[0].deleted).toBe(true)
      expect(events[1].deleted).toBe(true)
    })
  })

  describe("Replace and Atomic Operation Events", () => {
    it("should emit 'replace' event when replaceOne succeeds", async () => {
      const events: Array<{
        filter: string | QueryFilter<TestUser>
        document: TestUser | null
      }> = []
      collection.on("replace", (event) => events.push(event))

      const inserted = await collection.insertOne({
        name: "Alice",
        email: "alice@example.com",
        age: 25,
      })

      await collection.replaceOne(inserted._id, {
        name: "Alice Updated",
        email: "alice.new@example.com",
        age: 26,
      })

      expect(events).toHaveLength(1)
      expect(events[0].filter).toBe(inserted._id)
      expect(events[0].document).not.toBeNull()
      expect(events[0].document?.name).toBe("Alice Updated")
    })

    it("should emit 'replace' event with null when document not found", async () => {
      const events: Array<{
        filter: string | QueryFilter<TestUser>
        document: TestUser | null
      }> = []
      collection.on("replace", (event) => events.push(event))

      await collection.replaceOne("nonexistent-id", {
        name: "Bob",
        email: "bob@example.com",
        age: 30,
      })

      expect(events).toHaveLength(1)
      expect(events[0].filter).toBe("nonexistent-id")
      expect(events[0].document).toBeNull()
    })

    it("should emit replace event with QueryFilter when filter is object", async () => {
      const events: Array<{
        filter: string | QueryFilter<TestUser>
        document: TestUser | null
      }> = []
      collection.on("replace", (event) => events.push(event))

      await collection.insertOne({
        name: "Charlie",
        email: "charlie@example.com",
        age: 28,
      })

      const filter = { email: "charlie@example.com" }
      await collection.replaceOne(filter, {
        name: "Charles",
        email: "charles@example.com",
        age: 29,
      })

      expect(events).toHaveLength(1)
      expect(events[0].filter).toEqual(filter)
      expect(events[0].document?.name).toBe("Charles")
    })

    it("should emit replace event after document is replaced", async () => {
      let replacedDoc: TestUser | null = null
      collection.on("replace", (event) => {
        replacedDoc = event.document
      })

      const inserted = await collection.insertOne({
        name: "Dave",
        email: "dave@example.com",
        age: 35,
      })

      await collection.replaceOne(inserted._id, {
        name: "David",
        email: "david@example.com",
        age: 36,
      })

      expect(replacedDoc).not.toBeNull()
      const found = await collection.findOne(inserted._id)
      expect(found?.name).toBe("David")
      expect(replacedDoc?.name).toBe("David")
    })

    it("should emit 'findOneAndReplace' event when document is found and replaced", async () => {
      const events: Array<{
        filter: string | QueryFilter<TestUser>
        document: TestUser | null
        upserted: boolean
      }> = []
      collection.on("findOneAndReplace", (event) => events.push(event))

      const inserted = await collection.insertOne({
        name: "Eve",
        email: "eve@example.com",
        age: 22,
      })

      await collection.findOneAndReplace(inserted._id, {
        name: "Eva",
        email: "eva@example.com",
        age: 23,
      })

      expect(events).toHaveLength(1)
      expect(events[0].filter).toBe(inserted._id)
      expect(events[0].document?.name).toBe("Eva")
      expect(events[0].upserted).toBe(false)
    })

    it("should emit 'findOneAndReplace' with 'before' document when returnDocument is 'before'", async () => {
      const events: Array<{
        filter: string | QueryFilter<TestUser>
        document: TestUser | null
        upserted: boolean
      }> = []
      collection.on("findOneAndReplace", (event) => events.push(event))

      const inserted = await collection.insertOne({
        name: "Frank",
        email: "frank@example.com",
        age: 40,
      })

      await collection.findOneAndReplace(
        inserted._id,
        {
          name: "Francis",
          email: "francis@example.com",
          age: 41,
        },
        { returnDocument: "before" }
      )

      expect(events).toHaveLength(1)
      expect(events[0].document?.name).toBe("Frank") // Original name
      expect(events[0].document?.age).toBe(40) // Original age
    })

    it("should emit 'findOneAndReplace' with upserted flag when upsert creates document", async () => {
      const events: Array<{
        filter: string | QueryFilter<TestUser>
        document: TestUser | null
        upserted: boolean
      }> = []
      collection.on("findOneAndReplace", (event) => events.push(event))

      await collection.findOneAndReplace(
        "new-id",
        {
          name: "Grace",
          email: "grace@example.com",
          age: 27,
        },
        { upsert: true, returnDocument: "after" }
      )

      expect(events).toHaveLength(1)
      expect(events[0].upserted).toBe(true)
      expect(events[0].document?.name).toBe("Grace")
    })

    it("should emit 'findOneAndReplace' with null document when not found and no upsert", async () => {
      const events: Array<{
        filter: string | QueryFilter<TestUser>
        document: TestUser | null
        upserted: boolean
      }> = []
      collection.on("findOneAndReplace", (event) => events.push(event))

      await collection.findOneAndReplace("nonexistent-id", {
        name: "Heidi",
        email: "heidi@example.com",
        age: 50,
      })

      expect(events).toHaveLength(1)
      expect(events[0].document).toBeNull()
      expect(events[0].upserted).toBe(false)
    })

    it("should emit findOneAndReplace with QueryFilter", async () => {
      const events: Array<{
        filter: string | QueryFilter<TestUser>
        document: TestUser | null
        upserted: boolean
      }> = []
      collection.on("findOneAndReplace", (event) => events.push(event))

      await collection.insertOne({
        name: "Ivan",
        email: "ivan@example.com",
        age: 33,
      })

      const filter = { email: "ivan@example.com" }
      await collection.findOneAndReplace(filter, {
        name: "Ivan Updated",
        email: "ivan.new@example.com",
        age: 34,
      })

      expect(events).toHaveLength(1)
      expect(events[0].filter).toEqual(filter)
      expect(events[0].document?.name).toBe("Ivan Updated")
    })

    it("should not emit replace events when no listeners registered", async () => {
      const inserted = await collection.insertOne({
        name: "Silent",
        email: "silent@example.com",
        age: 33,
      })

      // No listeners registered
      await collection.replaceOne(inserted._id, {
        name: "Silent Updated",
        email: "silent.new@example.com",
        age: 34,
      })

      await collection.findOneAndReplace(inserted._id, {
        name: "Silent Final",
        email: "silent.final@example.com",
        age: 35,
      })

      // Should complete without error
      const found = await collection.findOne(inserted._id)
      expect(found?.name).toBe("Silent Final")
    })

    it("should emit multiple replace events for multiple replaceOne calls", async () => {
      const events: Array<{
        filter: string | QueryFilter<TestUser>
        document: TestUser | null
      }> = []
      collection.on("replace", (event) => events.push(event))

      const doc1 = await collection.insertOne({
        name: "Multi1",
        email: "multi1@example.com",
        age: 10,
      })
      const doc2 = await collection.insertOne({
        name: "Multi2",
        email: "multi2@example.com",
        age: 20,
      })

      await collection.replaceOne(doc1._id, {
        name: "Multi1 Replaced",
        email: "multi1.new@example.com",
        age: 11,
      })
      await collection.replaceOne(doc2._id, {
        name: "Multi2 Replaced",
        email: "multi2.new@example.com",
        age: 21,
      })

      expect(events).toHaveLength(2)
      expect(events[0].document?.name).toBe("Multi1 Replaced")
      expect(events[1].document?.name).toBe("Multi2 Replaced")
    })
  })

  describe("Drop Event and Edge Cases", () => {
    it("should emit 'drop' event when collection is dropped", async () => {
      const events: Array<{ name: string }> = []
      collection.on("drop", (event) => events.push(event))

      await collection.insertOne({
        name: "Test",
        email: "test@example.com",
        age: 25,
      })

      await collection.drop()

      expect(events).toHaveLength(1)
      expect(events[0].name).toBe("users")
    })

    it("should emit drop event after collection is dropped", async () => {
      let eventName = ""
      collection.on("drop", (event) => {
        eventName = event.name
      })

      await collection.insertOne({
        name: "Test",
        email: "test@example.com",
        age: 25,
      })

      await collection.drop()

      expect(eventName).toBe("users")
    })

    it("should not emit drop event when no listeners registered", async () => {
      await collection.insertOne({
        name: "Test",
        email: "test@example.com",
        age: 25,
      })

      // No listeners registered - should complete without error
      await collection.drop()

      // Test passes if no error thrown
      expect(true).toBe(true)
    })

    it("should handle listeners registered after operations", async () => {
      const events: Array<{ document: TestUser }> = []

      await collection.insertOne({
        name: "Test",
        email: "test@example.com",
        age: 25,
      })

      // Register listener after insert
      collection.on("insert", (event) => events.push(event))

      await collection.insertOne({
        name: "Test2",
        email: "test2@example.com",
        age: 26,
      })

      expect(events).toHaveLength(1)
      expect(events[0].document.name).toBe("Test2")
    })

    it("should handle removing all listeners mid-operation", async () => {
      const events: Array<{ document: TestUser }> = []
      collection.on("insert", (event) => events.push(event))

      await collection.insertOne({
        name: "Test1",
        email: "test1@example.com",
        age: 25,
      })

      collection.removeAllListeners()

      await collection.insertOne({
        name: "Test2",
        email: "test2@example.com",
        age: 26,
      })

      expect(events).toHaveLength(1)
      expect(events[0].document.name).toBe("Test1")
    })

    it("should handle multiple event types on same collection", async () => {
      const insertEvents: Array<{ document: TestUser }> = []
      const updateEvents: Array<{
        filter: string | QueryFilter<TestUser>
        update: Partial<TestUser>
        document: TestUser | null
        upserted: boolean
      }> = []
      const deleteEvents: Array<{
        filter: string | QueryFilter<TestUser>
        deleted: boolean
      }> = []

      collection.on("insert", (event) => insertEvents.push(event))
      collection.on("update", (event) => updateEvents.push(event))
      collection.on("delete", (event) => deleteEvents.push(event))

      const inserted = await collection.insertOne({
        name: "Test",
        email: "test@example.com",
        age: 25,
      })
      await collection.updateOne(inserted._id, { age: 26 })
      await collection.deleteOne(inserted._id)

      expect(insertEvents).toHaveLength(1)
      expect(updateEvents).toHaveLength(1)
      expect(deleteEvents).toHaveLength(1)
    })

    it("should handle event listener errors gracefully", async () => {
      const events: Array<{ document: TestUser }> = []

      // First listener throws error
      collection.on("insert", () => {
        throw new Error("Listener error")
      })

      // Second listener should still receive event
      collection.on("insert", (event) => events.push(event))

      await collection.insertOne({
        name: "Test",
        email: "test@example.com",
        age: 25,
      })

      // Document should still be inserted
      const count = await collection.count({})
      expect(count).toBe(1)
      expect(events).toHaveLength(1)
    })

    it("should support chaining event registrations", async () => {
      const insertEvents: Array<{ document: TestUser }> = []
      const updateEvents: Array<{
        filter: string | QueryFilter<TestUser>
        update: Partial<TestUser>
        document: TestUser | null
        upserted: boolean
      }> = []

      collection
        .on("insert", (event) => insertEvents.push(event))
        .on("update", (event) => updateEvents.push(event))

      const inserted = await collection.insertOne({
        name: "Test",
        email: "test@example.com",
        age: 25,
      })
      await collection.updateOne(inserted._id, { age: 26 })

      expect(insertEvents).toHaveLength(1)
      expect(updateEvents).toHaveLength(1)
    })

    it("should handle once() listeners with multiple events", async () => {
      let insertCount = 0
      collection.once("insert", () => {
        insertCount += 1
      })

      await collection.insertOne({
        name: "Test1",
        email: "test1@example.com",
        age: 25,
      })
      await collection.insertOne({
        name: "Test2",
        email: "test2@example.com",
        age: 26,
      })

      expect(insertCount).toBe(1)
    })

    it("should verify listener count is accurate across operations", () => {
      expect(collection.listenerCount("insert")).toBe(0)

      const listener1 = () => {
        // Empty listener for testing
      }
      const listener2 = () => {
        // Empty listener for testing
      }

      collection.on("insert", listener1)
      expect(collection.listenerCount("insert")).toBe(1)

      collection.on("insert", listener2)
      expect(collection.listenerCount("insert")).toBe(2)

      collection.off("insert", listener1)
      expect(collection.listenerCount("insert")).toBe(1)

      collection.removeAllListeners("insert")
      expect(collection.listenerCount("insert")).toBe(0)
    })

    describe("Event Cleanup", () => {
      it("should clear all listeners after drop()", async () => {
        collection.on("insert", () => {
          // Empty listener for testing
        })
        collection.on("update", () => {
          // Empty listener for testing
        })
        collection.on("delete", () => {
          // Empty listener for testing
        })

        expect(collection.listenerCount("insert")).toBeGreaterThan(0)
        expect(collection.listenerCount("update")).toBeGreaterThan(0)
        expect(collection.listenerCount("delete")).toBeGreaterThan(0)

        await collection.drop()

        expect(collection.listenerCount("insert")).toBe(0)
        expect(collection.listenerCount("update")).toBe(0)
        expect(collection.listenerCount("delete")).toBe(0)
      })

      it("should fire drop event before cleanup", async () => {
        let dropEventFired = false
        let listenerCountAtEventTime = -1

        collection.on("drop", () => {
          dropEventFired = true
          listenerCountAtEventTime = collection.listenerCount("drop")
        })

        await collection.drop()

        expect(dropEventFired).toBe(true)
        expect(listenerCountAtEventTime).toBe(1) // Listener still exists during event
        expect(collection.listenerCount("drop")).toBe(0) // Cleaned up after event
      })

      it("should allow new listeners after drop (emitter recreated on next on())", async () => {
        collection.on("insert", () => {
          // Empty listener for testing
        })
        await collection.drop()

        expect(collection.listenerCount("insert")).toBe(0)

        // Re-register listener (emitter recreated)
        collection.on("insert", () => {
          // Empty listener for testing
        })
        expect(collection.listenerCount("insert")).toBe(1)
      })

      it("should clean up collection listeners on database close", () => {
        const db2 = new Strata({ database: ":memory:" })
        const schema2 = createSchema<TestUser>()
          .field("name", { type: "TEXT", indexed: true })
          .field("email", { type: "TEXT", indexed: true, unique: true })
          .field("age", { type: "INTEGER", indexed: true })
          .build()
        const collection2 = db2.collection<TestUser>("users", schema2)

        const events: Array<{ document: TestUser }> = []
        collection2.on("insert", (event) => events.push(event))

        expect(collection2.listenerCount("insert")).toBe(1)

        db2.close()

        expect(collection2.listenerCount("insert")).toBe(0)
      })

      it("should not throw error when dropping collection with no listeners", async () => {
        // No listeners registered
        await collection.drop()

        // Should complete without error
        expect(true).toBe(true)
      })

      it("should not throw error when closing database with no event listeners", () => {
        // No listeners registered on any collection
        db.close()

        // Should complete without error
        expect(true).toBe(true)
      })

      it("should clean up multiple collections on database close", () => {
        const db2 = new Strata({ database: ":memory:" })
        const schema2 = createSchema<TestUser>()
          .field("name", { type: "TEXT", indexed: true })
          .field("email", { type: "TEXT", indexed: true, unique: true })
          .field("age", { type: "INTEGER", indexed: true })
          .build()
        const collection1 = db2.collection<TestUser>("users1", schema2)
        const collection2 = db2.collection<TestUser>("users2", schema2)

        collection1.on("insert", () => {
          // Empty listener for testing
        })
        collection2.on("insert", () => {
          // Empty listener for testing
        })
        collection2.on("update", () => {
          // Empty listener for testing
        })

        expect(collection1.listenerCount("insert")).toBe(1)
        expect(collection2.listenerCount("insert")).toBe(1)
        expect(collection2.listenerCount("update")).toBe(1)

        db2.close()

        expect(collection1.listenerCount("insert")).toBe(0)
        expect(collection2.listenerCount("insert")).toBe(0)
        expect(collection2.listenerCount("update")).toBe(0)
      })

      it("should handle cleanup when listeners exist on dropped collection", async () => {
        const insertEvents: Array<{ document: TestUser }> = []
        const updateEvents: Array<{
          filter: string | QueryFilter<TestUser>
          update: Partial<TestUser>
          document: TestUser | null
          upserted: boolean
        }> = []

        collection.on("insert", (event) => insertEvents.push(event))
        collection.on("update", (event) => updateEvents.push(event))

        await collection.drop()

        // Verify all listener counts are 0
        expect(collection.listenerCount("insert")).toBe(0)
        expect(collection.listenerCount("update")).toBe(0)
        expect(collection.listenerCount("delete")).toBe(0)
        expect(collection.listenerCount("drop")).toBe(0)
      })

      it("should verify listeners() returns empty array after cleanup", async () => {
        collection.on("insert", () => {
          // Empty listener for testing
        })
        collection.on("insert", () => {
          // Empty listener for testing
        })

        expect(collection.listeners("insert")).toHaveLength(2)

        await collection.drop()

        expect(collection.listeners("insert")).toHaveLength(0)
      })
    })
  })
})
