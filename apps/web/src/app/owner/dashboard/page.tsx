// apps/web/src/app/owner/dashboard/page.tsx
import { redirect } from "next/navigation";

export default function OwnerDashboardRedirectPage() {
  redirect("/owner");
}