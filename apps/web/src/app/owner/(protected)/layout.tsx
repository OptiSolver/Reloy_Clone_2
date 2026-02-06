export const runtime = "nodejs";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

async function getAuthUserId(): Promise<string | null> {
  const c = cookies() as unknown;
  const store = (c instanceof Promise ? await c : c) as {
    get(name: string): { value: string } | undefined;
  };

  // real auth cookie
  const real = store.get("auth_user_id")?.value ?? null;
  if (real) return real;

  // dev fallback
  return store.get("dev_auth_user_id")?.value ?? null;
}

export default async function OwnerProtectedLayout({ children }: { children: React.ReactNode }) {
  const authUserId = await getAuthUserId();
  if (!authUserId) redirect("/owner/login");
  return <>{children}</>;
}