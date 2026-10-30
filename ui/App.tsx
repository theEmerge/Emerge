import { useState } from "react";

type IconName =
  | "home"
  | "compass"
  | "bell"
  | "message"
  | "bookmark"
  | "search"
  | "plus"
  | "heart"
  | "comment"
  | "send"
  | "more"
  | "image"
  | "smile"
  | "close";

const paths: Record<IconName, React.ReactNode> = {
  home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" /></>,
  compass: <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5Z" /></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
  message: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" /></>,
  bookmark: <><path d="M6 3h12v18l-6-4-6 4Z" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  heart: <><path d="M20.8 4.6a5.4 5.4 0 0 0-7.6 0L12 5.8l-1.2-1.2a5.4 5.4 0 1 0-7.6 7.6L12 21l8.8-8.8a5.4 5.4 0 0 0 0-7.6Z" /></>,
  comment: <><path d="M21 12a8.5 8.5 0 0 1-9 8.5 10 10 0 0 1-4-.8L3 21l1.4-4A8.4 8.4 0 0 1 3 12a8.5 8.5 0 0 1 9-8.5 8.5 8.5 0 0 1 9 8.5Z" /></>,
  send: <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>,
  more: <><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" /></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9" r="1.5" /><path d="m21 15-5-5L5 20" /></>,
  smile: <><circle cx="12" cy="12" r="9" /><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" /></>,
  close: <><path d="m6 6 12 12M18 6 6 18" /></>,
};

function Icon({ name, size = 21, filled = false }: { name: IconName; size?: number; filled?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

const photos = {
  hero: "https://images.unsplash.com/photo-1617014215128-49b02928a8e5?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=1200",
  architecture: "https://images.unsplash.com/photo-1602128110234-2d11c0aaadfe?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=1000",
  nina: "https://images.unsplash.com/photo-1517256673644-36ad11246d21?crop=faces&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=200&h=200",
  maya: "https://images.unsplash.com/photo-1665180702781-a580dbf92b8c?crop=faces&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=200&h=200",
  group: "https://images.unsplash.com/photo-1529903384028-929ae5dccdf1?crop=faces&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=200&h=200",
};

const stories = [
  { name: "Your story", image: photos.nina, yours: true },
  { name: "Maya", image: photos.maya },
  { name: "Theo", image: photos.group },
  { name: "Amélie", image: photos.architecture },
  { name: "Jordan", image: photos.hero },
];

const nav = [
  ["home", "Home"],
  ["compass", "Discover"],
  ["bell", "Notifications"],
  ["message", "Messages"],
  ["bookmark", "Saved"],
] as [IconName, string][];

function Avatar({ src, size = "md" }: { src: string; size?: "sm" | "md" | "lg" }) {
  const sizing = size === "sm" ? "h-9 w-9" : size === "lg" ? "h-12 w-12" : "h-10 w-10";
  return <img src={src} alt="" className={`${sizing} shrink-0 rounded-full object-cover`} />;
}

function PostActions({ initialLikes }: { initialLikes: number }) {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between pt-4">
        <div className="flex items-center gap-5">
          <button
            className={`action ${liked ? "text-[#ff5d3b]" : ""}`}
            onClick={() => setLiked(!liked)}
            aria-label={liked ? "Unlike post" : "Like post"}
          >
            <Icon name="heart" filled={liked} />
          </button>
          <button className="action" aria-label="Comment"><Icon name="comment" /></button>
          <button className="action" aria-label="Share"><Icon name="send" /></button>
        </div>
        <button
          className={`action ${saved ? "text-[#ff5d3b]" : ""}`}
          onClick={() => setSaved(!saved)}
          aria-label={saved ? "Remove saved post" : "Save post"}
        >
          <Icon name="bookmark" filled={saved} />
        </button>
      </div>
      <p className="mt-3 text-sm font-bold">{(initialLikes + (liked ? 1 : 0)).toLocaleString()} likes</p>
    </div>
  );
}

function CreateModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#171713]/50 px-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="w-full max-w-lg bg-white p-6 shadow-2xl sm:p-8" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <p className="eyebrow">New post</p>
            <h2 className="mt-1 text-2xl font-bold tracking-[-0.04em]">Share something good.</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        </div>
        <textarea
          autoFocus
          className="mt-7 min-h-32 w-full resize-none border-0 bg-[#f4f3ef] p-4 text-base outline-none placeholder:text-[#94938c]"
          placeholder="What's on your mind?"
        />
        <div className="mt-4 flex items-center justify-between border-t border-[#e9e7df] pt-4">
          <div className="flex gap-2">
            <button className="icon-button" aria-label="Add image"><Icon name="image" /></button>
            <button className="icon-button" aria-label="Add feeling"><Icon name="smile" /></button>
          </div>
          <button className="primary-button" onClick={onClose}>Publish</button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [active, setActive] = useState("Home");
  const [following, setFollowing] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const toggleFollow = (name: string) => {
    setFollowing((items) => items.includes(name) ? items.filter((item) => item !== name) : [...items, name]);
  };

  return (
    <div className="min-h-screen bg-[#f4f3ef] text-[#171713]">
      <header className="mobile-header">
        <div className="brand-mark">e</div>
        <span className="brand-name">emerge</span>
        <div className="ml-auto flex items-center gap-2">
          <button className="icon-button" aria-label="Search"><Icon name="search" /></button>
          <button className="icon-button relative" aria-label="Messages"><Icon name="message" /><span className="notification-dot" /></button>
        </div>
      </header>

      <aside className="sidebar">
        <div className="flex items-center gap-3 px-2">
          <div className="brand-mark">e</div>
          <span className="brand-name">emerge</span>
        </div>
        <nav className="mt-12 space-y-2">
          {nav.map(([icon, label]) => (
            <button key={label} className={`nav-item ${active === label ? "active" : ""}`} onClick={() => setActive(label)}>
              <Icon name={icon} filled={active === label && icon === "home"} />
              <span>{label}</span>
              {label === "Notifications" && <span className="ml-auto h-2 w-2 rounded-full bg-[#ff5d3b]" />}
            </button>
          ))}
        </nav>
        <button className="primary-button mt-8 w-full" onClick={() => setCreating(true)}>
          <Icon name="plus" size={18} /> Create post
        </button>
        <div className="mt-auto flex items-center gap-3 border-t border-[#dedcd4] pt-5">
          <Avatar src={photos.nina} />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">Nina Hart</p>
            <p className="truncate text-xs text-[#77766f]">@ninahart</p>
          </div>
          <button className="ml-auto" aria-label="Profile options"><Icon name="more" /></button>
        </div>
      </aside>

      <main className="page-shell">
        <section className="feed">
          <div className="desktop-title">
            <div>
              <p className="eyebrow">Your daily mix</p>
              <h1>Good morning, Nina.</h1>
            </div>
            <button className="icon-button" aria-label="Search"><Icon name="search" /></button>
          </div>

          <div className="stories" aria-label="Stories">
            {stories.map((story) => (
              <button key={story.name} className="story">
                <div className={`story-ring ${story.yours ? "your-story" : ""}`}>
                  <img src={story.image} alt={`${story.name}'s story`} />
                  {story.yours && <span className="story-plus">+</span>}
                </div>
                <span>{story.name}</span>
              </button>
            ))}
          </div>

          <article className="post">
            <div className="post-head">
              <Avatar src={photos.maya} />
              <div>
                <p className="text-sm font-bold">Maya Lin <span className="ml-1 text-[#ff5d3b]">●</span></p>
                <p className="text-xs text-[#77766f]">Lisbon, Portugal · 18 min</p>
              </div>
              <button className="ml-auto action" aria-label="Post options"><Icon name="more" /></button>
            </div>
            <div className="relative mt-4 overflow-hidden bg-[#ddd]">
              <img className="aspect-[4/4.35] w-full object-cover sm:aspect-[4/3.45]" src={photos.hero} alt="Friends walking through the city at sunset" />
              <div className="absolute bottom-4 left-4 bg-[#171713] px-3 py-2 text-xs font-bold text-white">36.7213° N, 4.4214° W</div>
            </div>
            <PostActions initialLikes={2847} />
            <p className="mt-3 text-[15px] leading-6">
              <strong className="mr-1.5">mayalin</strong>
              Chasing the last light through streets that feel like a movie. Some days stay with you.
            </p>
            <p className="mt-2 text-xs font-semibold text-[#8a8982]">VIEW ALL 84 COMMENTS</p>
          </article>

          <article className="post">
            <div className="post-head">
              <Avatar src={photos.group} />
              <div>
                <p className="text-sm font-bold">Theo Jameson</p>
                <p className="text-xs text-[#77766f]">Copenhagen · 2 hr</p>
              </div>
              <button className="ml-auto action" aria-label="Post options"><Icon name="more" /></button>
            </div>
            <p className="my-4 text-xl font-semibold leading-snug tracking-[-0.025em]">Finding calm in the lines, light, and little details.</p>
            <img className="aspect-[16/11] w-full object-cover" src={photos.architecture} alt="Minimal white architecture among green trees" />
            <PostActions initialLikes={936} />
          </article>
        </section>

        <aside className="right-rail">
          <div className="mb-7 flex items-center justify-between">
            <div>
              <p className="eyebrow">People</p>
              <h2 className="mt-1 text-lg font-bold tracking-tight">Worth following</h2>
            </div>
            <button className="text-xs font-bold text-[#ff5d3b]">See all</button>
          </div>
          <div className="space-y-5">
            {[
              ["Mika Chen", "@mika.chen", photos.maya],
              ["Sam Rivera", "@samshoots", photos.group],
              ["Leila Noor", "@leilanoor", photos.nina],
            ].map(([name, handle, image]) => (
              <div className="flex items-center gap-3" key={name}>
                <Avatar src={image} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{name}</p>
                  <p className="truncate text-xs text-[#77766f]">{handle}</p>
                </div>
                <button className={`follow-button ${following.includes(name) ? "following" : ""}`} onClick={() => toggleFollow(name)}>
                  {following.includes(name) ? "Following" : "Follow"}
                </button>
              </div>
            ))}
          </div>
          <div className="trend-card">
            <p className="eyebrow text-[#ffb09f]">Trending now</p>
            <p className="mt-3 text-xl font-bold leading-tight tracking-[-0.03em]">The art of slowing down</p>
            <p className="mt-2 text-sm leading-5 text-white/60">12.8k people are sharing their quiet moments.</p>
            <button className="mt-5 text-xs font-bold text-white">Explore the topic →</button>
          </div>
          <footer className="mt-6 text-[11px] leading-5 text-[#99978f]">
            About · Help · Privacy · Terms · Language<br />© 2026 Emerge Social
          </footer>
        </aside>
      </main>

      <nav className="bottom-nav">
        {nav.slice(0, 4).map(([icon, label]) => (
          <button key={label} className={active === label ? "text-[#ff5d3b]" : ""} onClick={() => setActive(label)} aria-label={label}>
            <Icon name={icon} filled={active === label && icon === "home"} />
          </button>
        ))}
        <button className="mobile-create" onClick={() => setCreating(true)} aria-label="Create post"><Icon name="plus" /></button>
      </nav>

      {creating && <CreateModal onClose={() => setCreating(false)} />}
    </div>
  );
}
