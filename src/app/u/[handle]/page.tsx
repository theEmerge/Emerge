import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import ProfileView from "@/components/ProfileView";

export default async function ProfilePage({ params }: { params: { handle: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  return <ProfileView handle={params.handle} />;
}
