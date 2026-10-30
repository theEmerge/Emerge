"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Empty, PersonLite } from "../HubUI";
import { call } from "@/lib/hubClient";
import { timeAgo } from "@/lib/timeAgo";
import type { RepoProps } from "./RepoView";

type C = { id: string; message: string; paths: string[]; createdAt: string; author: PersonLite };

export default function RepoCommits({ meta, base }: RepoProps) {
  const [branch, setBranch] = useState(meta.branches.includes("main") ? "main" : meta.branches[0]);
  const [commits, setCommits] = useState<C[] | null>(null);
  useEffect(() => {
    setCommits(null);
    call("GET", `${base}/commits?branch=${encodeURIComponent(branch)}`).then((r) => r.ok && setCommits(r.data.commits));
  }, [base, branch]);

  return (
    <div>
      <select className="hx-select" style={{ width: "auto", marginBottom: 12 }} value={branch} onChange={(e) => setBranch(e.target.value)}>
        {meta.branches.map((b) => <option key={b}>{b}</option>)}
      </select>
      {commits === null && <div className="ap-loading">Loading…</div>}
      {commits?.length === 0 && <Empty>No commits on this branch.</Empty>}
      <div className="hx-card" style={{ padding: "0 16px" }}>
        {commits?.map((c) => (
          <div className="hx-list-item" key={c.id}>
            <b>{c.message}</b>
            <div className="hx-muted"><Link href={`/developer/u/${c.author.handle}`}>{c.author.name}</Link> · {timeAgo(c.createdAt)}{c.paths.length ? ` · ${c.paths.length} file${c.paths.length === 1 ? "" : "s"}: ${c.paths.slice(0, 3).join(", ")}${c.paths.length > 3 ? "…" : ""}` : ""}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
