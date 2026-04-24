export async function withConcurrency<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (queue.length > 0) {
        const next = queue.shift();
        if (next !== undefined) {
          await fn(next);
        }
      }
    })
  );
}
