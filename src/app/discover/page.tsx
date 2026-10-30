import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import Discover from "@/components/Discover";

export default async function DiscoverPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  return <Discover />;
}
