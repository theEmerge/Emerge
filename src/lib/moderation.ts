import { prisma } from "./prisma";

// No DB-level cascades in this schema, so deleting a post means clearing
// everything that points at it first, in one transaction.
export async function deletePostCascade(postId: string) {
  await prisma.$transaction([
    prisma.comment.deleteMany({ where: { postId } }),
    prisma.like.deleteMany({ where: { postId } }),
    prisma.helpfulMark.deleteMany({ where: { postId } }),
    prisma.reshare.deleteMany({ where: { postId } }),
    prisma.notification.deleteMany({ where: { postId } }),
    prisma.postTag.deleteMany({ where: { postId } }),
    prisma.saved.deleteMany({ where: { postId } }),
    prisma.postImage.deleteMany({ where: { postId } }),
    prisma.post.delete({ where: { id: postId } }),
  ]);
}
