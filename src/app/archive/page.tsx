import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import RollArchive from "@/components/RollArchive";

export default async function ArchivePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  return <RollArchive />;
}
