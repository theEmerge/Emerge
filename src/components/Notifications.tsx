"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Heart, MessageCircle, UserPlus, Repeat2, Briefcase, GitPullRequest, CircleDot } from "lucide-react";
import Avatar from "./Avatar";
import AppShell from "./AppShell";
import type { HubId } from "@/lib/hubs";

type NotificationType = "LIKE" | "COMMENT" | "FOLLOW" | "RESHARE" | "CONNECTION_REQUEST" | "CONNECTION_ACCEPTED" | "JOB_APPLICATION" | "PULL_REQUEST" | "ISSUE";
type Notif = {
  id: string;
  type: NotificationType;
  read: boolean;
  createdAt: string;
  actor: { id: string; name: string; handle: string };
  post: { id: string; imageUrl: string | null; text: string | null; isReel: boolean } | null;
};

const LABEL: Record<NotificationType, string> = {
  LIKE: "liked your post",
  COMMENT: "commented on your post",
  FOLLOW: "started following you",
  RESHARE: "reshared your post",
  CONNECTION_REQUEST: "sent you a connection request",
  CONNECTION_ACCEPTED: "accepted your connection request",
  JOB_APPLICATION: "applied to a job you posted",
  PULL_REQUEST: "opened a pull request in your repository",
  ISSUE: "opened an issue in your repository",
};

// Where a notification leads. Social ones open the actor's profile; hub ones
// open the hub screen where you can act on them.
const TARGET: Partial<Record<NotificationType, string>> = {
  CONNECTION_REQUEST: "/connection/network",
  CONNECTION_ACCEPTED: "/connection/network",
  JOB_APPLICATION: "/connection/jobs",
  PULL_REQUEST: "/developer",
  ISSUE: "/developer",
};

const ICON: Record<NotificationType, React.ReactNode> = {
  LIKE: <Heart size={14} fill="currentColor" />,
  COMMENT: <MessageCircle size={14} />,
  FOLLOW: <UserPlus size={14} />,
  RESHARE: <Repeat2 size={14} />,
  CONNECTION_REQUEST: <UserPlus size={14} />,
  CONNECTION_ACCEPTED: <UserPlus size={14} />,
  JOB_APPLICATION: <Briefcase size={14} />,
  PULL_REQUEST: <GitPullRequest size={14} />,
  ISSUE: <CircleDot size={14} />,
};

function timeAgo(iso: string) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString();
}

// Flat, newest-first activity list - liking/commenting/following/
// resharing all create a Notification row server-side (see
// src/lib/notifications.ts). Opening this page marks everything read.
export default function Notifications({ hub = "social" }: { hub?: HubId }) {
  const router = useRouter();

  // Stay inside the hub you opened Notifications from: a follow/like/comment
  // opens that person's profile in the current hub, not the Social one.
  function targetFor(n: Notif) {
    const t = TARGET[n.type];
    if (t) return t;
    if (hub === "connection") return `/connection/in/${n.actor.handle}`;
    if (hub === "developer") return `/developer/u/${n.actor.handle}`;
    if (hub === "game") return "/game";
    return `/u/${n.actor.handle}`;
  }
  const [notifications, setNotifications] = useState<Notif[] | null>(null);

  useEffect(() => {
    fetch(`/api/notifications?hub=${hub}`)
      .then((res) => res.json())
      .then((data) => setNotifications(data.notifications || []));
    fetch(`/api/notifications/read?hub=${hub}`, { method: "POST" }).catch(() => {});
  }, [hub]);

  return (
    <AppShell active="notifications" hub={hub}>
      <div className="ap-shell ig-notifications-page">
        <h1 className="ig-notifications-title">Notifications</h1>

        {notifications === null && <div className="ap-loading">Loading…</div>}
        {notifications !== null && notifications.length === 0 && (
          <div className="ap-loading">Nothing yet - activity in this hub will show up here.</div>
        )}

        {notifications?.map((n) => (
          <button
            key={n.id}
            className={"ig-notification-row" + (n.read ? "" : " unread")}
            onClick={() => router.push(targetFor(n))}
          >
            <div className="ig-notification-avatar">
              <Avatar name={n.actor.name} size={40} />
              <span className={"ig-notification-badge " + n.type.toLowerCase()}>{ICON[n.type]}</span>
            </div>
            <div className="ig-notification-body">
              <span>
                <b>{n.actor.name}</b> {LABEL[n.type]}
              </span>
              <span className="ig-notification-time">{timeAgo(n.createdAt)}</span>
            </div>
            {n.post?.imageUrl && !n.post.isReel && (
              <div className="ig-notification-thumb">
                <Image src={n.post.imageUrl} alt="" width={44} height={44} />
              </div>
            )}
          </button>
        ))}
      </div>
    </AppShell>
  );
}
