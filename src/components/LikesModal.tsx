"use client";
import UserListModal from "./UserListModal";

// Thin wrapper around UserListModal for post/reel likes - kept as its own
// component since Feed/ProfileView/Reels already import it by this name.
export default function LikesModal({ postId, onClose }: { postId: string; onClose: () => void }) {
  return <UserListModal title="Likes" fetchUrl={`/api/posts/${postId}/likes`} emptyText="No likes yet." onClose={onClose} />;
}
