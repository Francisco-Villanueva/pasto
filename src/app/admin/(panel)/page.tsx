import { redirect } from "next/navigation";
import { homeFor } from "@/domain/permissions";
import { requireStaff } from "@/server/auth/dal";

export default async function AdminIndex() {
  const user = await requireStaff();
  redirect(homeFor(user.role));
}
