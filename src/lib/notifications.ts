import { prisma } from "./prisma";
import { isBlockedEitherWay } from "./blocks";
import type { NotificationType } from "@prisma/client";

// Hub-specific events land in that hub's inbox; everything else is Social.
function hubForType(type: NotificationType): string {
  if (type === "CONNECTION_REQUEST" || type === "CONNECTION_ACCEPTED" || type === "JOB_APPLICATION") return "connection";
  if (type === "PULL_REQUEST" || type === "ISSUE") return "developer";
  return "social";
}

// Shared by the four notification-worthy actions (like, comment, follow,
// reshare) - never notifies someone about their own action, e.g. liking
// your own post doesn't create a notification.
export async function notify(params: {
  recipientId: string;
  actorId: string;
  type: NotificationType;
  postId?: string;
}) {
  if (params.recipientId === params.actorId) return;
  if (await isBlockedEitherWay(params.recipientId, params.actorId)) return;
  await prisma.notification.create({
    data: {
      recipientId: params.recipientId,
      actorId: params.actorId,
      type: params.type,
      hub: hubForType(params.type),
      postId: params.postId,
    },
  });
}
