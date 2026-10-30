import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import HubDetail from "@/components/HubDetail";
import { hubBySlug } from "@/lib/hubs";

export default async function HubDetailPage({ params }: { params: { slug: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const hub = hubBySlug(params.slug);
  if (!hub) return notFound();
  if (hub.status === "live") redirect(hub.href);
  return <HubDetail hub={hub} />;
}
