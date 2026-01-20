# Database Transactions

Atomic operations and isolation patterns.

## Contents

- [Basic Pattern](#basic-pattern) - Drizzle transaction syntax
- [Isolation Levels](#isolation-levels) - When to use each
- [Best Practices](#best-practices) - Short transactions, no external calls
- [Error Handling](#error-handling) - Retries and conflicts

## Basic Pattern

```typescript
await db.transaction(async (tx) => {
  const user = await tx.insert(users).values({ email }).returning();
  await tx.insert(profiles).values({ userId: user[0].id });
  // Commits if no errors, rolls back on exception
});
```

## Isolation Levels

| Level | Dirty Read | Non-Repeatable | Phantom |
|-------|------------|----------------|---------|
| Read Uncommitted | Possible | Possible | Possible |
| **Read Committed** (default) | No | Possible | Possible |
| Repeatable Read | No | No | Possible |
| Serializable | No | No | No |

```typescript
await db.transaction(async (tx) => {
  // ...
}, {
  isolationLevel: 'serializable', // For strict consistency
});
```

## Best Practices

1. **Keep transactions short** - Hold locks briefly
2. **No external APIs inside** - Network latency extends lock time
3. **Use appropriate isolation** - Read Committed is usually fine
4. **Handle conflicts** - Retry on serialization failures

## Error Handling

```typescript
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      // Retry on serialization failure
      if (error.code === '40001' && attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, Math.random() * 100));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}

// Usage
await withRetry(() => db.transaction(async (tx) => {
  // Critical operation
}));
```

## Transfer Example

```typescript
async function transfer(fromId: string, toId: string, amount: number) {
  await db.transaction(async (tx) => {
    // Lock source account
    const [from] = await tx.select()
      .from(accounts)
      .where(eq(accounts.id, fromId))
      .for('update');

    if (from.balance < amount) {
      throw new Error('Insufficient funds');
    }

    await tx.update(accounts)
      .set({ balance: sql`balance - ${amount}` })
      .where(eq(accounts.id, fromId));

    await tx.update(accounts)
      .set({ balance: sql`balance + ${amount}` })
      .where(eq(accounts.id, toId));
  });
}
```

## Savepoints

```typescript
await db.transaction(async (tx) => {
  await tx.insert(orders).values(order);

  try {
    // Nested operation with savepoint
    await tx.execute(sql`SAVEPOINT bonus_points`);
    await tx.insert(bonusPoints).values({ orderId: order.id });
  } catch {
    // Rollback just the bonus points, not the order
    await tx.execute(sql`ROLLBACK TO SAVEPOINT bonus_points`);
  }
});
```
