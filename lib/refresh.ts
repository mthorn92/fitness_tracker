let batchDepth = 0;

/** Bust Next page caches after a write. No-ops in scripts (tsx). */
export async function refreshPages(): Promise<void> {
  if (batchDepth > 0) return;
  try {
    const { revalidatePath } = await import("next/cache");
    revalidatePath("/");
    revalidatePath("/log");
    revalidatePath("/body");
    revalidatePath("/recovery");
  } catch {
    // Running outside Next (verify-import).
  }
}

/** Run several writes, then revalidate once. */
export async function withBatchedRefresh<T>(fn: () => Promise<T>): Promise<T> {
  batchDepth += 1;
  try {
    return await fn();
  } finally {
    batchDepth -= 1;
    if (batchDepth === 0) await refreshPages();
  }
}
