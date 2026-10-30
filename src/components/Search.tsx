"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search as SearchIcon } from "lucide-react";
import Avatar from "./Avatar";
import AppShell from "./AppShell";

type SearchUser = { id: string; name: string; handle: string; avatarUrl: string | null };

// Site-wide "find anyone" search - separate from the light-weight user
// picker inside Messages (which is scoped to starting a DM). This is how
// you reach an account you don't follow yet: search here, open their
// profile, and their posts are visible there regardless of follow status
// (Home itself stays follow-only, by design).
export default function Search() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (query.trim().length < 1) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(query.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.users || []);
      }
      setSearched(true);
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <AppShell active="search">
      <div className="ap-shell ig-search-page">
        <div className="ig-search-page-bar">
          <SearchIcon size={16} className="ig-search-page-icon" />
          <input
            autoFocus
            placeholder="Search by name or @handle"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {loading && <div className="ap-loading">Searching…</div>}

        {!loading &&
          results.map((u) => (
            <button key={u.id} className="ig-conversation-row" onClick={() => router.push(`/u/${u.handle}`)}>
              <Avatar name={u.name} src={u.avatarUrl} size={44} />
              <div className="ig-conversation-info">
                <span className="ig-conversation-name">{u.name}</span>
                <span className="ig-conversation-preview">@{u.handle}</span>
              </div>
            </button>
          ))}

        {!loading && searched && results.length === 0 && (
          <div className="ap-loading">No one found for &ldquo;{query.trim()}&rdquo;.</div>
        )}

        {!loading && !searched && (
          <div className="ap-loading">Search for anyone on Emerge by name or @handle.</div>
        )}
      </div>
    </AppShell>
  );
}
