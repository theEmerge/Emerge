# Emect: where user data lives, and the breach plan (draft)

Draft for legal review. Items marked [FILL IN] need the business owner.

## 1. Every place that holds user data

| Where | What | Removed on "Delete my account"? |
|---|---|---|
| Postgres (via Prisma), table `User` | email, handle, name, bio, avatar/banner URLs, password hash, termsAcceptedAt | Yes (row deleted) |
| Tables with a foreign key to `User` or to the user's posts/stories/messages: Follow, Roll, Post, PostImage, Story, StoryView, Conversation*, Message, MessageReaction, PostTag, Saved, CloseFriend, Notification, Reshare, Community*, HelpfulMark, Like, Comment, Block, Report, AuthToken, EmailOtp, ProProfile/ProExperience/ProConnection/Event*/Company/Job*/ProEndorsement/ProRecommendation, GameServer/ServerMember/Channel*/GamePresence/Lfg*, Repo*/Commit/PullRequest/Issue/DevComment/Release | content and relationships | Yes, by cascading foreign keys (migration `20261126120000_cascade_user_data`). Optional links (a post's roll or community, a report's target user) are set to NULL. |
| Reports about the user | snapshot text and note | Blanked before deletion |
| Cloudinary | avatar, banner, post images, reel and story media (public URLs) | Yes, best effort via the Admin API after the database delete |
| Upstash Redis | rate-limit counters keyed by IP / user id (auto-expire) | Expire on their own |
| Gmail (emectapp@gmail.com) | sent copies of OTP, verification, reset, report and deletion emails | **No.** Delete from the Sent folder periodically [FILL IN: owner] |
| Netlify | access/function logs (IP addresses) | **No.** Controlled by Netlify retention [FILL IN: check plan] |
| Database host backups | full copy of the database | Expire on the host's schedule [FILL IN: schedule] |
| Giphy | search terms and IP when the GIF picker is used | Not our data; disclosed in the policy |

Open question: messages a user sent in a conversation are deleted with the account. The other person loses those messages. Confirm this is the behaviour you want.

## 2. Retention (needs your decision)

Currently only stories expire from view (24 hours). Nothing deletes expired OTP codes, used reset tokens, or old reports. [FILL IN: periods, then add a scheduled cleanup.]

## 3. Data-breach plan (template)

1. **Decide:** [FILL IN: name] is the incident owner and decides whether personal data was exposed.
2. **Contain (first hours):** rotate `NEXTAUTH_SECRET`, database password, Cloudinary secret, Upstash token and Gmail app password; redeploy; invalidate sessions.
3. **Record:** what data, how many people, when it started, how it was found.
4. **Tell users:** email affected users without undue delay: what happened, what data, what to do (change password), contact point.
5. **Tell the regulator:** India: the Data Protection Board of India and affected users, as the DPDP Rules require. EU/UK: the supervisory authority within 72 hours of becoming aware (GDPR). [FILL IN: confirm exact forms, deadlines and contacts. Ask a lawyer.]
6. **Review:** write down the cause and the fix.
