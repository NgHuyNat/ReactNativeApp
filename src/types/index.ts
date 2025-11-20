export type RootStackParamList = {
  Login: undefined;
  ChatList: undefined;
  ChatRoom: { conversationId: string; name: string };
  SearchUsers: undefined;
  Profile: undefined;
};

export interface User {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  isOnline?: boolean;
  lastSeen?: number;
}

export interface Message {
  _id: string;
  text: string;
  createdAt: number;
  user: {
    _id: string;
    name: string;
    avatar?: string;
  };
  image?: string;
  status?: "sending" | "sent" | "delivered" | "read";
}

export interface Conversation {
  id: string;
  users: string[];
  lastMessage?: string;
  lastMessageTimestamp?: number;
  lastMessageUserId?: string;
  participantDetails?: {
    [userId: string]: {
      displayName: string;
      email: string;
    };
  };
  unreadCount?: number;
  lastReadTimestamp?: { [userId: string]: number };
}
