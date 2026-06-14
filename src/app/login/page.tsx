import { redirect } from "next/navigation";
import { AuthScreen } from "@/components/auth-screen";
import { getCurrentUser } from "@/lib/server-auth";

export default async function LoginPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/");
  }

  return <AuthScreen />;
}
