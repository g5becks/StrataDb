import type { Database } from "bun:sqlite"
import { AsyncLocalStorage } from "node:async_hooks"
import { assertDatabaseOpen } from "./database-state.js"
import { TransactionError } from "./errors.js"
import { quoteIdent } from "./field-resolver.js"

class SerialQueue {
  private tail: Promise<void> = Promise.resolve()
  pending = 0

  run<R>(operation: () => Promise<R>): Promise<R> {
    this.pending += 1
    const result = this.tail.then(operation)
    this.tail = result.then(
      () => {
        /* Release the queue on success. */
      },
      () => {
        /* Release the queue on failure. */
      }
    )
    return result.finally(() => {
      this.pending -= 1
    })
  }

  drain(): Promise<void> {
    return this.tail
  }
}

export type TransactionFrame = {
  active: boolean
  savepoint: string | null
  parent: TransactionFrame | null
  events: (() => void)[]
  queue: SerialQueue
}

class TransactionManager {
  private readonly context = new AsyncLocalStorage<
    TransactionFrame | undefined
  >()
  private readonly queue = new SerialQueue()
  private readonly frames: TransactionFrame[] = []
  private sequence = 0
  private readonly database: Database

  constructor(database: Database) {
    this.database = database
  }

  assertSynchronousAccess(): void {
    const current = this.context.getStore()
    if (current && !current.active) {
      throw new TransactionError("Transaction context has completed")
    }
    if ((current?.queue.pending ?? this.queue.pending) > 0) {
      throw new TransactionError(
        "Synchronous database changes cannot enter a pending execute(); use execute()"
      )
    }
  }

  begin(owned = false): TransactionFrame {
    assertDatabaseOpen(this.database)
    if (!owned) {
      this.assertSynchronousAccess()
    }
    const parent = this.frames.at(-1) ?? null
    this.sequence += 1
    const savepoint = this.database.inTransaction
      ? quoteIdent(`stratadb_savepoint_${this.sequence}`)
      : null
    this.database.exec(
      savepoint ? `SAVEPOINT ${savepoint}` : "BEGIN TRANSACTION"
    )
    const frame: TransactionFrame = {
      active: true,
      savepoint,
      parent,
      events: [],
      queue: new SerialQueue(),
    }
    this.frames.push(frame)
    return frame
  }

  private assertTop(frame: TransactionFrame): void {
    if (this.frames.at(-1) !== frame) {
      throw new TransactionError("Transactions must complete in nesting order")
    }
  }

  commit(frame: TransactionFrame): void {
    if (!frame.active) {
      return
    }
    this.assertTop(frame)
    this.database.exec(
      frame.savepoint ? `RELEASE SAVEPOINT ${frame.savepoint}` : "COMMIT"
    )
    this.frames.pop()
    frame.active = false
    if (frame.parent) {
      frame.parent.events.push(...frame.events)
    } else {
      this.context.run(undefined, () => {
        for (const dispatch of frame.events) {
          dispatch()
        }
      })
    }
    frame.events = []
  }

  rollback(frame: TransactionFrame): void {
    if (!frame.active) {
      return
    }
    this.assertTop(frame)
    if (frame.savepoint) {
      this.database.exec(`ROLLBACK TO SAVEPOINT ${frame.savepoint}`)
      this.database.exec(`RELEASE SAVEPOINT ${frame.savepoint}`)
    } else {
      this.database.exec("ROLLBACK")
    }
    this.frames.pop()
    frame.active = false
    frame.events = []
  }

  sync<R>(operation: () => R): R {
    const frame = this.begin(true)
    try {
      const result = this.context.run(frame, operation)
      this.commit(frame)
      return result
    } catch (error) {
      this.rollback(frame)
      throw error
    }
  }

  private async inTransactionFrame<R>(
    operation: (frame: TransactionFrame) => Promise<R>
  ): Promise<R> {
    const frame = this.begin(true)
    return await this.context.run(frame, async () => {
      try {
        const result = await operation(frame)
        await frame.queue.drain()
        this.commit(frame)
        return result
      } catch (error) {
        await frame.queue.drain()
        this.rollback(frame)
        throw error
      }
    })
  }

  execute<R>(operation: (frame: TransactionFrame) => Promise<R>): Promise<R> {
    const current = this.context.getStore()
    if (current && !current.active) {
      return Promise.reject(
        new TransactionError("Transaction context has completed")
      )
    }
    const queue = current?.queue ?? this.queue
    return queue.run(() => this.inTransactionFrame(operation))
  }

  async run<R>(operation: () => Promise<R>): Promise<R> {
    const current = this.context.getStore()
    if (current && !current.active) {
      throw new TransactionError("Transaction context has completed")
    }
    const queue = current?.queue ?? this.queue
    if (queue.pending > 0) {
      return await queue.run(operation)
    }
    return await operation()
  }

  event(dispatch: () => void): void {
    const frame = this.frames.at(-1)
    if (frame) {
      frame.events.push(dispatch)
    } else {
      dispatch()
    }
  }
}

const managers = new WeakMap<Database, TransactionManager>()

export function transactionManager(database: Database): TransactionManager {
  let manager = managers.get(database)
  if (!manager) {
    manager = new TransactionManager(database)
    managers.set(database, manager)
  }
  return manager
}
