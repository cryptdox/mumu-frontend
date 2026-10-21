import { api } from "@/lib/api";

export interface AdminSettings {
  consumerModeEnabled: boolean;
  liveEnabled: boolean;
  maxProvidersPerAccount: number;
}
export interface AdminReport {
  reportId: string;
  targetType: "PROFILE" | "POST" | "COMMENT" | "MESSAGE" | "LIVE";
  targetId: string;
  reason: string;
  status: "OPEN" | "ACTIONED" | "DISMISSED";
  createdAt: string;
  reporter: ProfileCard;
}
import type {
  Account, Audience, Category, Device, CallInfo, Comment, Conversation, LiveStream, Media, Message, MyProfile,
  Notification, Post, Profile, ProfileCard, ProfileView, ReactionType, RtcJoin,
} from "./types";

const before = (cursor?: string) => (cursor ? { before: cursor } : {});

export const mu = {
  me: () => api<Account>("/api/me"),
  categories: () => api<Category[]>("/api/categories", { auth: false }),
  deleteAccount: () => api<{ deletedProfiles: number }>("/api/me", { method: "DELETE" }),
  devices: () => api<{ max: number; devices: Device[] }>("/api/me/devices"),
  signOutDevice: (id: string) => api<void>(`/api/me/devices/${encodeURIComponent(id)}`, { method: "DELETE" }),

  profiles: {
    get: (idOrHandle: string) => api<ProfileView>(`/api/profiles/${encodeURIComponent(idOrHandle)}`),
    search: (q: string, kind?: "PERSONAL" | "BUSINESS") => api<ProfileCard[]>("/api/profiles/search", { query: { q, kind, limit: 20 } }),
    createBusiness: (body: { handle: string; displayName: string; categoryId?: string; bio?: string; website?: string }) =>
      api<MyProfile>("/api/profiles", { method: "POST", body }),
    update: (profileId: string, body: Partial<{ handle: string; displayName: string; bio: string | null; categoryId: string | null; website: string | null; avatarMediaId: string | null; coverMediaId: string | null }>) =>
      api<Profile>(`/api/profiles/${profileId}`, { method: "PATCH", body }),
    remove: (profileId: string) => api<void>(`/api/profiles/${profileId}`, { method: "DELETE" }),
    members: (profileId: string) => api<{ userId: string; role: string; profile: ProfileCard | null }[]>(`/api/profiles/${profileId}/members`),
    addMember: (profileId: string, handle: string, role: "ADMIN" | "EDITOR") => api<void>(`/api/profiles/${profileId}/members`, { method: "POST", body: { handle, role } }),
    removeMember: (profileId: string, userId: string) => api<void>(`/api/profiles/${profileId}/members/${userId}`, { method: "DELETE" }),
  },

  connections: {
    requests: (direction: "in" | "out") => api<{ profile: ProfileCard; createdAt: string }[]>("/api/connections/friend-requests", { query: { direction } }),
    addFriend: (id: string) => api<{ friendStatus: string }>(`/api/connections/friends/${id}`, { method: "POST" }),
    accept: (id: string) => api<{ friendStatus: string }>(`/api/connections/friends/${id}/accept`, { method: "POST" }),
    removeFriend: (id: string) => api<{ friendStatus: string }>(`/api/connections/friends/${id}`, { method: "DELETE" }),
    follow: (id: string) => api(`/api/connections/follows/${id}`, { method: "POST" }),
    unfollow: (id: string) => api(`/api/connections/follows/${id}`, { method: "DELETE" }),
    block: (id: string) => api(`/api/connections/blocks/${id}`, { method: "POST" }),
    unblock: (id: string) => api(`/api/connections/blocks/${id}`, { method: "DELETE" }),
    blocks: () => api<ProfileCard[]>("/api/connections/blocks"),
    list: (id: string, list: "friends" | "followers" | "following") => api<ProfileCard[]>(`/api/connections/${id}/${list}`, { query: { limit: 100 } }),
  },

  media: {
    upload: (file: Blob, name = "image.jpg") => {
      const form = new FormData();
      form.append("file", file, name);
      return api<Media>("/api/media", { method: "POST", form });
    },
  },

  posts: {
    feed: (tab: "following" | "explore", cursor?: string) => api<Post[]>("/api/posts/feed", { query: { tab, ...before(cursor) } }),
    byProfile: (profileId: string, cursor?: string) => api<Post[]>(`/api/posts/by/${profileId}`, { query: before(cursor) }),
    get: (postId: string) => api<Post>(`/api/posts/${postId}`),
    create: (body: { text?: string; mediaId?: string; audience: Audience }) => api<Post>("/api/posts", { method: "POST", body }),
    update: (postId: string, body: { text?: string | null; audience?: Audience }) => api<Post>(`/api/posts/${postId}`, { method: "PATCH", body }),
    remove: (postId: string) => api<void>(`/api/posts/${postId}`, { method: "DELETE" }),
    react: (postId: string, type: ReactionType) => api<{ myReaction: ReactionType; reactionCount: number }>(`/api/posts/${postId}/reactions`, { method: "PUT", body: { type } }),
    unreact: (postId: string) => api<{ myReaction: null; reactionCount: number }>(`/api/posts/${postId}/reactions`, { method: "DELETE" }),
    comments: (postId: string, cursor?: string) => api<Comment[]>(`/api/posts/${postId}/comments`, { query: before(cursor) }),
    comment: (postId: string, text: string, parentId?: string) => api<Comment>(`/api/posts/${postId}/comments`, { method: "POST", body: { text, parentId } }),
    removeComment: (commentId: string) => api<void>(`/api/posts/comments/${commentId}`, { method: "DELETE" }),
  },

  chats: {
    list: () => api<Conversation[]>("/api/conversations", { query: { limit: 100 } }),
    get: (id: string) => api<Conversation>(`/api/conversations/${id}`),
    direct: (profileId: string) => api<Conversation>("/api/conversations/direct", { method: "POST", body: { profileId } }),
    group: (title: string, memberIds: string[]) => api<Conversation>("/api/conversations/group", { method: "POST", body: { title, memberIds } }),
    updateGroup: (id: string, body: { title?: string; avatarMediaId?: string | null }) => api<Conversation>(`/api/conversations/${id}`, { method: "PATCH", body }),
    addMembers: (id: string, profileIds: string[]) => api<Conversation>(`/api/conversations/${id}/members`, { method: "POST", body: { profileIds } }),
    removeMember: (id: string, profileId: string) => api<void>(`/api/conversations/${id}/members/${profileId}`, { method: "DELETE" }),
    messages: (id: string, cursor?: string) => api<Message[]>(`/api/conversations/${id}/messages`, { query: { ...before(cursor), limit: 30 } }),
    send: (id: string, body: { text?: string; mediaId?: string; replyToId?: string }) => api<Message>(`/api/conversations/${id}/messages`, { method: "POST", body }),
    edit: (messageId: string, text: string) => api<Message>(`/api/conversations/messages/${messageId}`, { method: "PATCH", body: { text } }),
    remove: (messageId: string) => api<void>(`/api/conversations/messages/${messageId}`, { method: "DELETE" }),
    read: (id: string) => api<{ lastReadAt: string }>(`/api/conversations/${id}/read`, { method: "POST", body: {} }),
    mute: (id: string, until: string | null) => api(`/api/conversations/${id}/mute`, { method: "POST", body: { until } }),
  },

  calls: {
    start: (conversationId: string, type: "AUDIO" | "VIDEO") => api<{ call: CallInfo; rtc: RtcJoin }>("/api/calls", { method: "POST", body: { conversationId, type } }),
    join: (callId: string) => api<{ call: CallInfo; rtc: RtcJoin }>(`/api/calls/${callId}/join`, { method: "POST" }),
    decline: (callId: string) => api<CallInfo>(`/api/calls/${callId}/decline`, { method: "POST" }),
    end: (callId: string) => api<CallInfo>(`/api/calls/${callId}/end`, { method: "POST" }),
    get: (callId: string) => api<CallInfo>(`/api/calls/${callId}`),
  },

  live: {
    list: () => api<LiveStream[]>("/api/live"),
    get: (id: string) => api<LiveStream>(`/api/live/${id}`),
    start: (title: string, audience: Audience, replace = false) => api<{ stream: LiveStream; rtc: RtcJoin }>("/api/live", { method: "POST", body: { title, audience, replace } }),
    watch: (id: string, takeover = false) => api<{ stream: LiveStream; rtc: RtcJoin }>(`/api/live/${id}/watch`, { method: "POST", body: { takeover } }),
    leave: (id: string) => api<LiveStream>(`/api/live/${id}/leave`, { method: "POST" }),
    react: (id: string, type: "LIKE" | "LOVE" | "HAHA" | "WOW" | "SAD") => api<{ floated: boolean }>(`/api/live/${id}/react`, { method: "POST", body: { type } }),
    end: (id: string) => api<LiveStream>(`/api/live/${id}/end`, { method: "POST" }),
  },

  notifications: {
    list: (cursor?: string) => api<{ items: Notification[]; unread: number }>("/api/notifications", { query: before(cursor) }),
    readAll: () => api("/api/notifications/read", { method: "POST", body: {} }),
  },

  admin: {
    overview: () => api<Record<string, number>>("/api/admin/overview"),
    categories: () => api<Category[]>("/api/admin/categories"),
    addCategory: (name: string) => api<Category>("/api/admin/categories", { method: "POST", body: { name } }),
    updateCategory: (id: string, body: Partial<{ name: string; sortOrder: number; isActive: boolean }>) => api<Category>(`/api/admin/categories/${id}`, { method: "PATCH", body }),
    deleteCategory: (id: string) => api<void>(`/api/admin/categories/${id}`, { method: "DELETE" }),
    settings: () => api<AdminSettings>("/api/admin/settings"),
    saveSettings: (body: Partial<AdminSettings>) => api<AdminSettings>("/api/admin/settings", { method: "PUT", body }),
    profiles: (q: { q?: string; kind?: string; status?: string; offset?: number }) =>
      api<{ items: (Profile & { suspendedAt: string | null; _count: { members: number; posts: number; followers: number } })[]; total: number }>("/api/admin/profiles", { query: { ...q, limit: 30 } }),
    moderateProfile: (id: string, body: { isVerified?: boolean; suspended?: boolean }) => api<Profile>(`/api/admin/profiles/${id}`, { method: "PATCH", body }),
    reports: (status: string) => api<{ items: AdminReport[]; total: number }>("/api/reports", { query: { status, limit: 50 } }),
    resolveReport: (id: string, status: "ACTIONED" | "DISMISSED") => api(`/api/reports/${id}`, { method: "PATCH", body: { status } }),
    lives: () => api<LiveStream[]>("/api/admin/live"),
    endLive: (id: string) => api(`/api/admin/live/${id}/end`, { method: "POST" }),
  },

  report: (targetType: "PROFILE" | "POST" | "COMMENT" | "MESSAGE" | "LIVE", targetId: string, reason: string) =>
    api("/api/reports", { method: "POST", body: { targetType, targetId, reason } }),
};
