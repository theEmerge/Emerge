import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import Saved from "@/components/Saved";

export default async function SavedPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  return <Saved />;
}
