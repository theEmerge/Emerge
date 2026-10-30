import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { parseHub } from "@/lib/hubs";
import Messages from "@/components/Messages";

export default async function ConversationPage({ params, searchParams }: { params: { id: string }; searchParams: { hub?: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  return <Messages activeId={params.id} hub={parseHub(searchParams.hub)} />;
}
