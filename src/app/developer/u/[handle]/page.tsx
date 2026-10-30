import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import DevProfile from "@/components/dev/DevProfile";

export default async function Page({ params }: { params: { handle: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  return <DevProfile handle={decodeURIComponent(params.handle)} />;
}
