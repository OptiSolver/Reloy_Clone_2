import { redirect } from "next/navigation";

export default function StaffLoginPage() {
  // MVP dev: después lo cambiamos por auth real
  redirect("/staff");
}