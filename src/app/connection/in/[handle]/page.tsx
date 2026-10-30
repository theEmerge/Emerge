import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import ProProfileView from "@/components/connection/ProProfileView";

export default async function Page({ params }: { params: { handle: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  return <ProProfileView handle={decodeURIComponent(params.handle)} />;
}
