import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import Search from "@/components/Search";

export default async function SearchPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  return <Search />;
}
