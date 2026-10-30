import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import Hubs from "@/components/Hubs";

export default async function HubsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  return <Hubs />;
}
