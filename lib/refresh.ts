/** Bust Next page caches after a write. No-ops in scripts (tsx). */
export async function refreshPages(): Promise<void> {
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
