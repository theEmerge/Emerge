import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import ConnectionCompany from "@/components/connection/ConnectionCompany";

export default async function Page({ params }: { params: { slug: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  return <ConnectionCompany slug={params.slug} />;
}
