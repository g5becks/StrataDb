/**
 * Integration tests for cursor-based pagination.
 *
 * @remarks
 * These tests verify that cursor pagination works correctly through
 * the full StrataDB API with real database operations.
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import {
  createSchema,
  type Document,
  QueryError,
  Strata,
} from "../../src/index.js"

// ============================================================================
// Test Document Types
// ============================================================================

/**
 * Post document for testing cursor pagination.
 */
type Post = Document<{
  title: string
  score: number
  publishedAt: number
  author: string
}>

// ============================================================================
// Test Setup
// ============================================================================

describe("Cursor Pagination Integration", () => {
  let db: Strata

  const createPostSchema = () =>
    createSchema<Post>()
      .field("title", { type: "TEXT", indexed: true })
      .field("score", { type: "INTEGER", indexed: true })
      .field("publishedAt", { type: "INTEGER", indexed: true })
      .field("author", { type: "TEXT", indexed: true })
      .build()

  beforeEach(async () => {
    db = new Strata({ database: ":memory:" })
    const posts = db.collection("posts", createPostSchema())

    // Seed test data with sequential IDs for predictable ordering
    // Use specific _ids to ensure deterministic cursor behavior
    await posts.insertMany([
      {
        _id: "post-001",
        title: "First Post",
        score: 100,
        publishedAt: 1000,
        author: "Alice",
      },
      {
        _id: "post-002",
        title: "Second Post",
        score: 200,
        publishedAt: 2000,
        author: "Bob",
      },
      {
        _id: "post-003",
        title: "Third Post",
        score: 150,
        publishedAt: 3000,
        author: "Alice",
      },
      {
        _id: "post-004",
        title: "Fourth Post",
        score: 300,
        publishedAt: 4000,
        author: "Charlie",
      },
      {
        _id: "post-005",
        title: "Fifth Post",
        score: 250,
        publishedAt: 5000,
        author: "Bob",
      },
      {
        _id: "post-006",
        title: "Sixth Post",
        score: 175,
        publishedAt: 6000,
        author: "Alice",
      },
      {
        _id: "post-007",
        title: "Seventh Post",
        score: 225,
        publishedAt: 7000,
        author: "Charlie",
      },
      {
        _id: "post-008",
        title: "Eighth Post",
        score: 125,
        publishedAt: 8000,
        author: "Bob",
      },
    ])
  })

  afterEach(() => {
    db.close()
  })

  // ==========================================================================
  // FORWARD PAGINATION (after)
  // ==========================================================================

  describe("forward pagination (after)", () => {
    it("should get first page without cursor", async () => {
      const posts = db.collection("posts", createPostSchema())

      const page1 = await posts.find({}, { sort: { publishedAt: 1 }, limit: 3 })

      expect(page1).toHaveLength(3)
      expect(page1[0].title).toBe("First Post")
      expect(page1[1].title).toBe("Second Post")
      expect(page1[2].title).toBe("Third Post")
    })

    it("should get next page using cursor", async () => {
      const posts = db.collection("posts", createPostSchema())

      // Get first page
      const page1 = await posts.find({}, { sort: { publishedAt: 1 }, limit: 3 })
      const lastItem = page1.at(-1)

      // Get second page using cursor
      const page2 = await posts.find(
        {},
        {
          sort: { publishedAt: 1 },
          limit: 3,
          cursor: { after: lastItem._id },
        }
      )

      expect(page2).toHaveLength(3)
      expect(page2[0].title).toBe("Fourth Post")
      expect(page2[1].title).toBe("Fifth Post")
      expect(page2[2].title).toBe("Sixth Post")
    })

    it("should get third page using cursor", async () => {
      const posts = db.collection("posts", createPostSchema())

      // Get first two pages
      const page1 = await posts.find({}, { sort: { publishedAt: 1 }, limit: 3 })
      const page2 = await posts.find(
        {},
        {
          sort: { publishedAt: 1 },
          limit: 3,
          cursor: { after: page1.at(-1)._id },
        }
      )

      // Get third page
      const page3 = await posts.find(
        {},
        {
          sort: { publishedAt: 1 },
          limit: 3,
          cursor: { after: page2.at(-1)._id },
        }
      )

      expect(page3).toHaveLength(2) // Only 2 remaining
      expect(page3[0].title).toBe("Seventh Post")
      expect(page3[1].title).toBe("Eighth Post")
    })

    it("should work with descending sort", async () => {
      const posts = db.collection("posts", createPostSchema())

      // Get first page (newest first)
      const page1 = await posts.find(
        {},
        { sort: { publishedAt: -1 }, limit: 3 }
      )

      expect(page1[0].title).toBe("Eighth Post")
      expect(page1[1].title).toBe("Seventh Post")
      expect(page1[2].title).toBe("Sixth Post")

      // Get second page
      const page2 = await posts.find(
        {},
        {
          sort: { publishedAt: -1 },
          limit: 3,
          cursor: { after: page1.at(-1)._id },
        }
      )

      expect(page2).toHaveLength(3)
      expect(page2[0].title).toBe("Fifth Post")
      expect(page2[1].title).toBe("Fourth Post")
      expect(page2[2].title).toBe("Third Post")
    })
  })

  // ==========================================================================
  // BACKWARD PAGINATION (before)
  // ==========================================================================

  describe("backward pagination (before)", () => {
    it("should get previous page using before cursor", async () => {
      const posts = db.collection("posts", createPostSchema())

      // Get to page 2 first
      const page1 = await posts.find({}, { sort: { publishedAt: 1 }, limit: 3 })
      const page2 = await posts.find(
        {},
        {
          sort: { publishedAt: 1 },
          limit: 3,
          cursor: { after: page1.at(-1)._id },
        }
      )

      // Go back to page 1 using before cursor
      const backToPage1 = await posts.find(
        {},
        {
          sort: { publishedAt: 1 },
          limit: 3,
          cursor: { before: page2[0]._id },
        }
      )

      expect(backToPage1).toHaveLength(3)
      expect(backToPage1[0].title).toBe("First Post")
      expect(backToPage1[1].title).toBe("Second Post")
      expect(backToPage1[2].title).toBe("Third Post")
    })

    it("should work with descending sort and before cursor", async () => {
      const posts = db.collection("posts", createPostSchema())

      // Get page 2 first (newest first)
      const page1 = await posts.find(
        {},
        { sort: { publishedAt: -1 }, limit: 3 }
      )
      const page2 = await posts.find(
        {},
        {
          sort: { publishedAt: -1 },
          limit: 3,
          cursor: { after: page1.at(-1)._id },
        }
      )

      // Go back using before cursor
      const backToPage1 = await posts.find(
        {},
        {
          sort: { publishedAt: -1 },
          limit: 3,
          cursor: { before: page2[0]._id },
        }
      )

      expect(backToPage1).toHaveLength(3)
      expect(backToPage1[0].title).toBe("Eighth Post")
      expect(backToPage1[1].title).toBe("Seventh Post")
      expect(backToPage1[2].title).toBe("Sixth Post")
    })
  })

  // ==========================================================================
  // CURSOR WITH FILTERS
  // ==========================================================================

  describe("cursor with filters", () => {
    it("should combine cursor with equality filter", async () => {
      const posts = db.collection("posts", createPostSchema())

      // Get Alice's posts page 1
      const page1 = await posts.find(
        { author: "Alice" },
        { sort: { publishedAt: 1 }, limit: 2 }
      )

      expect(page1).toHaveLength(2)
      expect(page1[0].author).toBe("Alice")
      expect(page1[1].author).toBe("Alice")

      // Get Alice's posts page 2
      const page2 = await posts.find(
        { author: "Alice" },
        {
          sort: { publishedAt: 1 },
          limit: 2,
          cursor: { after: page1.at(-1)._id },
        }
      )

      expect(page2).toHaveLength(1) // Alice has 3 posts total
      expect(page2[0].author).toBe("Alice")
    })

    it("should combine cursor with comparison operators", async () => {
      const posts = db.collection("posts", createPostSchema())

      // Get high-score posts (score >= 200)
      const page1 = await posts.find(
        { score: { $gte: 200 } },
        { sort: { score: -1 }, limit: 2 }
      )

      expect(page1).toHaveLength(2)
      expect(page1[0].score).toBeGreaterThanOrEqual(200)

      // Get next page
      const page2 = await posts.find(
        { score: { $gte: 200 } },
        {
          sort: { score: -1 },
          limit: 2,
          cursor: { after: page1.at(-1)._id },
        }
      )

      expect(page2.length).toBeLessThanOrEqual(2)
      for (const post of page2) {
        expect(post.score).toBeGreaterThanOrEqual(200)
      }
    })
  })

  // ==========================================================================
  // CURSOR WITH OTHER OPTIONS
  // ==========================================================================

  describe("cursor with other options", () => {
    it("should combine cursor with select projection", async () => {
      const posts = db.collection("posts", createPostSchema())

      const page1 = await posts.find(
        {},
        {
          sort: { publishedAt: 1 },
          limit: 3,
          select: ["title", "author"],
        }
      )

      expect(page1).toHaveLength(3)
      expect("title" in page1[0]).toBe(true)
      expect("author" in page1[0]).toBe(true)
      expect("score" in page1[0]).toBe(false)

      const page2 = await posts.find(
        {},
        {
          sort: { publishedAt: 1 },
          limit: 3,
          cursor: { after: page1.at(-1)._id },
          select: ["title", "author"],
        }
      )

      expect(page2).toHaveLength(3)
      expect("score" in page2[0]).toBe(false)
    })

    it("should combine cursor with search", async () => {
      const posts = db.collection("posts", createPostSchema())

      // Search for posts with "Post" in title
      const page1 = await posts.find(
        {},
        {
          sort: { publishedAt: 1 },
          limit: 3,
          search: { text: "Post", fields: ["title"] },
        }
      )

      expect(page1).toHaveLength(3)

      const page2 = await posts.find(
        {},
        {
          sort: { publishedAt: 1 },
          limit: 3,
          cursor: { after: page1.at(-1)._id },
          search: { text: "Post", fields: ["title"] },
        }
      )

      expect(page2.length).toBeGreaterThan(0)
    })
  })

  // ==========================================================================
  // EDGE CASES
  // ==========================================================================

  describe("edge cases", () => {
    it("should return empty array when cursor points to last item", async () => {
      const posts = db.collection("posts", createPostSchema())

      // Get all posts to find the last one
      const allPosts = await posts.find({}, { sort: { publishedAt: 1 } })
      const lastPost = allPosts.at(-1)

      // Try to get next page after last item
      const nextPage = await posts.find(
        {},
        {
          sort: { publishedAt: 1 },
          limit: 3,
          cursor: { after: lastPost._id },
        }
      )

      expect(nextPage).toHaveLength(0)
    })

    it("should reject when cursor document is not found", async () => {
      const posts = db.collection("posts", createPostSchema())

      // Use non-existent cursor
      await expect(
        posts.find(
          {},
          {
            sort: { publishedAt: 1 },
            limit: 3,
            cursor: { after: "non-existent-id" },
          }
        )
      ).rejects.toBeInstanceOf(QueryError)
    })

    it("should reject a cursor when sort is not provided", async () => {
      const posts = db.collection("posts", createPostSchema())

      await expect(
        posts.find(
          {},
          {
            limit: 3,
            cursor: { after: "post-003" },
          }
        )
      ).rejects.toBeInstanceOf(QueryError)
    })

    it("should handle duplicate sort values correctly", async () => {
      const posts = db.collection("posts", createPostSchema())

      // Sort by author (has duplicates: Alice, Bob, Charlie each have multiple posts)
      const page1 = await posts.find({}, { sort: { author: 1 }, limit: 3 })

      expect(page1).toHaveLength(3)

      // Get next page - should work even with duplicate author values
      const page2 = await posts.find(
        {},
        {
          sort: { author: 1 },
          limit: 3,
          cursor: { after: page1.at(-1)._id },
        }
      )

      // Should not include any items from page1
      const page1Ids = page1.map((p) => p._id)
      for (const post of page2) {
        expect(page1Ids).not.toContain(post._id)
      }
    })
  })

  // ==========================================================================
  // SORTING BY DIFFERENT FIELDS
  // ==========================================================================

  describe("sorting by different fields", () => {
    it("should paginate correctly when sorting by score", async () => {
      const posts = db.collection("posts", createPostSchema())

      // Sort by score descending
      const page1 = await posts.find({}, { sort: { score: -1 }, limit: 3 })

      expect(page1).toHaveLength(3)
      // Highest scores: 300, 250, 225
      expect(page1[0].score).toBe(300)
      expect(page1[1].score).toBe(250)
      expect(page1[2].score).toBe(225)

      const page2 = await posts.find(
        {},
        {
          sort: { score: -1 },
          limit: 3,
          cursor: { after: page1.at(-1)._id },
        }
      )

      expect(page2).toHaveLength(3)
      // Next scores: 200, 175, 150
      expect(page2[0].score).toBe(200)
      expect(page2[1].score).toBe(175)
      expect(page2[2].score).toBe(150)
    })

    it("should paginate correctly when sorting by title", async () => {
      const posts = db.collection("posts", createPostSchema())

      // Sort by title ascending
      const page1 = await posts.find({}, { sort: { title: 1 }, limit: 3 })

      expect(page1).toHaveLength(3)

      const page2 = await posts.find(
        {},
        {
          sort: { title: 1 },
          limit: 3,
          cursor: { after: page1.at(-1)._id },
        }
      )

      expect(page2).toHaveLength(3)

      // Verify no overlap
      const page1Titles = page1.map((p) => p.title)
      for (const post of page2) {
        expect(page1Titles).not.toContain(post.title)
      }
    })
  })
})
