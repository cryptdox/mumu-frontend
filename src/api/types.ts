export type ProfileKind = "PERSONAL" | "BUSINESS";
export type MemberRole = "OWNER" | "ADMIN" | "EDITOR";
export type Audience = "PUBLIC" | "CONNECTIONS" | "ONLY_ME";
export type ReactionType = "LIKE" | "LOVE" | "HAHA" | "WOW" | "SAD";

export interface ProfileCard {
  profileId: string;
  kind: ProfileKind;
  handle: string;
  displayName: string;
  isVerified: boolean;
  avatarUrl: string | null;
}

export interface Profile extends ProfileCard {
  bio: string | null;
  category: string | null;
  website: string | null;
  coverUrl?: string | null;
  createdAt: string;
}

export interface MyProfile extends Profile {
  role: MemberRole;
}

export interface Account {
  userId: string;
  email: string;
  profiles: MyProfile[];
}

export interface ProfileView extends Profile {
  counts: { followers: number; following: number; friends: number; posts: number };
  online: boolean;
  relationship: { isSelf: boolean; friendStatus: "NONE" | "FRIENDS" | "REQUEST_SENT" | "REQUEST_RECEIVED"; following: boolean; blocked: boolean };
}

export interface Media {
  mediaId: string;
  url: string;
  width: number | null;
  height: number | null;
  mime: string;
}

export interface Post {
  postId: string;
  author: ProfileCard;
  text: string | null;
  media: { url: string; width: number | null; height: number | null } | null;
  audience: Audience;
  liveStream: { liveStreamId: string; title: string; status: "LIVE" | "ENDED"; viewerCount: number } | null;
  reactionCount: number;
  commentCount: number;
  myReaction: ReactionType | null;
  createdAt: string;
  editedAt: string | null;
}

export interface Comment {
  commentId: string;
  postId: string;
  parentId: string | null;
  author: ProfileCard;
  text: string;
  createdAt: string;
}

export interface CallInfo {
  /** On "call:ring": which of your profiles is being called. */
  to?: string;
  callId: string;
  conversationId: string;
  type: "AUDIO" | "VIDEO";
  status: "RINGING" | "ONGOING" | "ENDED" | "MISSED";
  startedAt: string;
  answeredAt: string | null;
  endedAt: string | null;
  startedBy?: ProfileCard;
  conversation?: { conversationId: string; type: "DIRECT" | "GROUP"; title: string | null };
}

export interface Message {
  messageId: string;
  conversationId: string;
  sender: ProfileCard;
  kind: "TEXT" | "CALL" | "SYSTEM";
  text: string | null;
  media: { url: string; width: number | null; height: number | null } | null;
  replyTo: { messageId: string; text: string | null; hasImage: boolean; deleted: boolean; sender: { profileId: string; displayName: string } } | null;
  call: Omit<CallInfo, "conversationId"> | null;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
}

export interface Conversation {
  conversationId: string;
  type: "DIRECT" | "GROUP";
  title: string;
  avatarUrl: string | null;
  partner: (ProfileCard & { online: boolean }) | null;
  members: (ProfileCard & { role: "ADMIN" | "MEMBER"; lastReadAt?: string | null; online?: boolean })[];
  memberCount: number;
  lastMessage: Message | null;
  lastMessageAt: string;
  unread: number;
  mutedUntil: string | null;
  myRole?: "ADMIN" | "MEMBER";
}

export interface RtcJoin {
  apiUrl: string;
  token: string;
  channel: string;
  role: "PUBLISHER" | "SUBSCRIBER" | "HOST" | "AUDIENCE";
}

export interface LiveStream {
  liveStreamId: string;
  hostProfileId: string;
  host: ProfileCard;
  title: string;
  audience: Audience;
  status: "LIVE" | "ENDED";
  viewerCount: number;
  peakViewers: number;
  startedAt: string;
  endedAt: string | null;
  postId: string | null;
  /** Only on your own live in the list: broadcasting from this device? */
  onThisDevice?: boolean;
}

export type NotificationType =
  | "FRIEND_REQUEST" | "FRIEND_ACCEPTED" | "NEW_FOLLOWER" | "POST_REACTION" | "POST_COMMENT"
  | "COMMENT_REPLY" | "LIVE_STARTED" | "MISSED_CALL" | "ADDED_TO_GROUP";

export interface Notification {
  notificationId: string;
  type: NotificationType;
  actor: ProfileCard | null;
  entityId: string | null;
  createdAt: string;
  readAt: string | null;
}

export interface Device {
  deviceId: string;
  label: string;
  signedInAt: string;
  lastSeenAt: string;
  current: boolean;
}
