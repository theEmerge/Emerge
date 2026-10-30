"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppShell from "../AppShell";
import Avatar from "../Avatar";
import { Empty, ErrorLine, PersonLite } from "../HubUI";
import { call, errorText } from "@/lib/hubClient";
import { timeAgo } from "@/lib/timeAgo";

type Chan = { id: string; name: string; topic: string | null };
type Member = { role: string; user: PersonLite; playing: string | null };
type Msg = { id: string; body: string; createdAt: string; author: PersonLite };
type Info = {
  server: { id: string; name: string; description: string | null; memberCount: number; isPublic?: boolean; inviteCode?: string | null };
  isMember: boolean; role?: string; channels?: Chan[]; members?: Member[];
};

const POLL_MS = 3000;

export default function GameServerView({ serverId }: { serverId: string }) {
  const router = useRouter();
  const [info, setInfo] = useState<Info | null>(null);
  const [denied, setDenied] = useState(false);
  const [channelId, setChannelId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [manage, setManage] = useState(false);
  const [newChan, setNewChan] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const lastRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    const r = await call("GET", `/api/game/servers/${serverId}`);
    if (!r.ok) return setDenied(true);
    setInfo(r.data);
    if (r.data.isMember) setChannelId((cur) => cur ?? r.data.channels?.[0]?.id ?? null);
  }, [serverId]);
  useEffect(() => { load(); }, [load]);

  // Load the channel, then poll for newer messages every few seconds.
  useEffect(() => {
    if (!channelId) return;
    let stop = false;
    setMsgs([]);
    lastRef.current = null;
    async function tick() {
      const after = lastRef.current;
      const r = await call("GET", `/api/game/channels/${channelId}/messages${after ? `?after=${encodeURIComponent(after)}` : ""}`);
      if (stop || !r.ok || !r.data.messages.length) return;
      const incoming: Msg[] = r.data.messages;
      lastRef.current = incoming[incoming.length - 1].createdAt;
      setMsgs((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        return [...prev, ...incoming.filter((m) => !seen.has(m.id))];
      });
    }
    tick();
    const t = setInterval(tick, POLL_MS);
    return () => { stop = true; clearInterval(t); };
  }, [channelId]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [msgs.length]);

  async function send() {
    if (!draft.trim() || !channelId) return;
    const body = draft;
    setDraft("");
    const r = await call("POST", `/api/game/channels/${channelId}/messages`, { body });
    if (!r.ok) { setDraft(body); return setErr(errorText(r.data)); }
    setErr(null);
    const m: Msg = r.data.message;
    lastRef.current = m.createdAt;
    setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
  }

  async function serverAction(body: Record<string, unknown>, after?: () => void) {
    setErr(null);
    const r = await call("POST", `/api/game/servers/${serverId}`, body);
    if (!r.ok) return setErr(errorText(r.data));
    if (after) after(); else load();
  }

  if (denied) return <AppShell active="hubs" hub="game"><div className="hx-page"><Empty>This server doesn't exist or is private. <Link href="/game">Back to servers</Link></Empty></div></AppShell>;
  if (!info) return <AppShell active="hubs" hub="game"><div className="hx-page"><div className="ap-loading">Loading…</div></div></AppShell>;

  if (!info.isMember) {
    return (
      <AppShell active="hubs" hub="game">
        <div className="hx-page">
          <div className="hx-card">
            <h2>{info.server.name}</h2>
            <p className="hx-muted">{info.server.memberCount} members</p>
            {info.server.description && <p className="hx-post-body">{info.server.description}</p>}
            <ErrorLine text={err} />
            <button className="hx-btn primary" onClick={() => serverAction({ action: "join" })}>Join server</button>
          </div>
        </div>
      </AppShell>
    );
  }

  const staff = info.role === "owner" || info.role === "admin";
  const channel = info.channels?.find((c) => c.id === channelId);

  return (
    <AppShell active="hubs" hub="game">
      <div className="hx-page wide">
        <div className="hx-head">
          <div><h1 style={{ fontSize: 22 }}>{info.server.name}</h1>{info.server.description && <p className="hx-muted">{info.server.description}</p>}</div>
          <div className="hx-row">
            <button className="hx-btn small" onClick={() => setManage((m) => !m)}>{manage ? "Close settings" : "Server settings"}</button>
          </div>
        </div>
        <ErrorLine text={err} />

        {manage && (
          <div className="hx-card">
            {staff && info.server.inviteCode && (
              <p style={{ marginTop: 0 }}>Invite code: <span className="hx-mono"><b>{info.server.inviteCode}</b></span> <span className="hx-muted">(share it so people can join{info.server.isPublic ? "" : " this private server"})</span></p>
            )}
            {staff && (
              <div className="hx-row" style={{ marginBottom: 10 }}>
                <input className="hx-input" style={{ flex: 1 }} placeholder="New channel name" maxLength={30} value={newChan} onChange={(e) => setNewChan(e.target.value)} />
                <button className="hx-btn primary" disabled={!newChan.trim()} onClick={() => serverAction({ action: "channel", name: newChan }, () => { setNewChan(""); load(); })}>Add channel</button>
              </div>
            )}
            {staff && channel && (info.channels?.length || 0) > 1 && (
              <button className="hx-btn small danger" onClick={() => confirm(`Delete #${channel.name} and its messages?`) && serverAction({ action: "deleteChannel", channelId: channel.id }, () => { setChannelId(null); load(); })}>Delete #{channel.name}</button>
            )}
            <div className="hx-row" style={{ marginTop: 10 }}>
              {info.role !== "owner" && <button className="hx-btn small danger" onClick={() => confirm("Leave this server?") && serverAction({ action: "leave" }, () => router.push("/game"))}>Leave server</button>}
              {info.role === "owner" && <button className="hx-btn small danger" onClick={() => confirm("Delete this server for everyone? This can't be undone.") && serverAction({ action: "delete" }, () => router.push("/game"))}>Delete server</button>}
            </div>
          </div>
        )}

        <div className="gx-layout">
          <div className="gx-side">
            <div className="hx-muted" style={{ margin: "2px 6px 6px", fontWeight: 700 }}>Text channels</div>
            {info.channels?.map((c) => (
              <button key={c.id} className={"gx-chan" + (c.id === channelId ? " on" : "")} onClick={() => setChannelId(c.id)}># {c.name}</button>
            ))}
            <div className="hx-muted" style={{ margin: "14px 6px 0", fontSize: 12 }}>Voice and video rooms aren&apos;t available yet.</div>
          </div>

          <div className="gx-chat">
            <div className="gx-chat-head"># {channel?.name}{channel?.topic && <span className="hx-muted" style={{ fontWeight: 400 }}> · {channel.topic}</span>}</div>
            <div className="gx-messages">
              {msgs.length === 0 && <div className="hx-muted">No messages yet. Say hi.</div>}
              {msgs.map((m) => (
                <div className="gx-msg" key={m.id}>
                  <Avatar name={m.author.name} src={m.author.avatarUrl} size={34} />
                  <div className="gx-msg-body">
                    <b>{m.author.name}</b> <span className="hx-muted">{timeAgo(m.createdAt)}</span>
                    <p>{m.body}</p>
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>
            <div className="gx-compose">
              <input className="hx-input" placeholder={`Message #${channel?.name ?? ""}`} maxLength={2000} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()} />
              <button className="hx-btn primary" onClick={send} disabled={!draft.trim()}>Send</button>
            </div>
          </div>

          <div className="gx-members">
            <div className="hx-muted" style={{ margin: "2px 4px 6px", fontWeight: 700 }}>Members · {info.members?.length}</div>
            {info.members?.map((m) => (
              <div className="gx-member" key={m.user.id}>
                <Avatar name={m.user.name} src={m.user.avatarUrl} size={28} />
                <div style={{ minWidth: 0 }}>
                  <Link href={`/u/${m.user.handle}`} style={{ color: "inherit" }}>{m.user.name}</Link>
                  <small>{m.playing ? `Playing ${m.playing}` : m.role !== "member" ? m.role : ""}</small>
                  {manage && info.role === "owner" && m.role !== "owner" && (
                    <small>
                      <button className="hx-btn small" style={{ padding: "1px 6px", marginRight: 4 }} onClick={() => serverAction({ action: "role", userId: m.user.id, role: m.role === "admin" ? "member" : "admin" })}>{m.role === "admin" ? "Demote" : "Make admin"}</button>
                      <button className="hx-btn small danger" style={{ padding: "1px 6px" }} onClick={() => confirm(`Remove ${m.user.name}?`) && serverAction({ action: "kick", userId: m.user.id })}>Kick</button>
                    </small>
                  )}
                  {manage && info.role === "admin" && m.role === "member" && (
                    <small><button className="hx-btn small danger" style={{ padding: "1px 6px" }} onClick={() => confirm(`Remove ${m.user.name}?`) && serverAction({ action: "kick", userId: m.user.id })}>Kick</button></small>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
