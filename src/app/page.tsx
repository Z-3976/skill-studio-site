import { redirect } from "next/navigation";
import { SkillStudio } from "@/components/skill-studio";
import { getCurrentUser } from "@/lib/server-auth";

export default async function Home() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return <SkillStudio currentUser={user} />;
}
