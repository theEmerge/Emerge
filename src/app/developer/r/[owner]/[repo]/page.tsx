import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import RepoView from "@/components/dev/RepoView";

export default async function Page({ params }: { params: { owner: string; repo: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  return <RepoView owner={decodeURIComponent(params.owner)} name={decodeURIComponent(params.repo)} />;
}
