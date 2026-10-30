import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import ConnectionCompanies from "@/components/connection/ConnectionCompanies";

export default async function Page() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  return <ConnectionCompanies />;
}
