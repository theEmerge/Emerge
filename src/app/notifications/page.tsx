import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { parseHub } from "@/lib/hubs";
import Notifications from "@/components/Notifications";

export default async function NotificationsPage({ searchParams }: { searchParams: { hub?: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  return <Notifications hub={parseHub(searchParams.hub)} />;
}
