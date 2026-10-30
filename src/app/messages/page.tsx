import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { parseHub } from "@/lib/hubs";
import Messages from "@/components/Messages";

export default async function MessagesPage({ searchParams }: { searchParams: { hub?: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  return <Messages hub={parseHub(searchParams.hub)} />;
}
