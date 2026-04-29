"use server";

import { revalidatePath } from "next/cache";

/** Refresh server-rendered pages that depend on profile / timezone / habits. */
export async function revalidateTrackerPages() {
  revalidatePath("/dashboard");
  revalidatePath("/settings");
  revalidatePath("/coach");
  revalidatePath("/insights");
}
