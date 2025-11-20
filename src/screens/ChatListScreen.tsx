import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList, Conversation } from "../types";
import { auth, db } from "../config/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  setDoc,
  doc,
  getDoc,
  getDocs,
} from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";

type ChatListScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "ChatList"
>;

interface Props {
  navigation: ChatListScreenNavigationProp;
}

export default function ChatListScreen({ navigation }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [userNames, setUserNames] = useState<{ [key: string]: string }>({});
  const user = auth.currentUser;

  useEffect(() => {
    if (!user) return;

    // Lưu thông tin user vào Firestore để có thể tìm kiếm
    const saveUserInfo = async () => {
      try {
        await setDoc(
          doc(db, "users", user.uid),
          {
            email: user.email,
            displayName: user.displayName || "User",
            uid: user.uid,
          },
          { merge: true }
        );
      } catch (error) {
        console.error("Error saving user info:", error);
      }
    };
    saveUserInfo();

    // Lấy danh sách conversations
    const q = query(
      collection(db, "conversations"),
      where("participants", "array-contains", user.uid)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const convs: Conversation[] = [];
      const allUserIds = new Set<string>();

      // Tính unread count cho mỗi conversation
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const participants = data.participants || [];
        participants.forEach((id: string) => allUserIds.add(id));

        // Lấy timestamp đã đọc của user hiện tại
        const lastReadTimestamp = data.lastReadTimestamp?.[user.uid] || 0;

        // Đếm số tin nhắn chưa đọc
        let unreadCount = 0;
        try {
          const messagesRef = collection(
            db,
            "conversations",
            docSnap.id,
            "messages"
          );
          const messagesSnap = await getDocs(messagesRef);

          // Đếm tin nhắn được tạo sau lastReadTimestamp và không phải của mình
          unreadCount = messagesSnap.docs.filter((msgDoc) => {
            const msgData = msgDoc.data();
            const msgTimestamp = msgData.createdAt?.toMillis() || 0;
            const msgUserId = msgData.user?._id || msgData.userId;

            return msgTimestamp > lastReadTimestamp && msgUserId !== user.uid;
          }).length;
        } catch (error) {
          console.error("Error counting unread messages:", error);
        }

        convs.push({
          id: docSnap.id,
          users: participants,
          lastMessage: data.lastMessage || "",
          lastMessageTimestamp: data.lastMessageTime?.toMillis() || Date.now(),
          lastMessageUserId: data.lastMessageUserId || "",
          participantDetails: data.participantDetails || {},
          unreadCount: unreadCount,
        });
      }

      // Lấy tên real-time từ users collection
      const names: { [key: string]: string } = {};
      await Promise.all(
        Array.from(allUserIds).map(async (userId) => {
          try {
            const userDoc = await import("firebase/firestore").then(
              ({ getDoc, doc }) => getDoc(doc(db, "users", userId))
            );
            if (userDoc.exists()) {
              names[userId] = userDoc.data().displayName || "User";
            }
          } catch (error) {
            console.error("Error fetching user name:", error);
          }
        })
      );

      setUserNames(names);
      setConversations(convs);
    });

    return () => unsubscribe();
  }, []);

  const getOtherUserName = (conversation: Conversation) => {
    if (!user) return "Unknown";
    const otherUserId = conversation.users.find((id) => id !== user.uid);
    if (!otherUserId) return "Unknown";

    // Ưu tiên lấy từ userNames state (real-time), sau đó mới lấy từ participantDetails
    if (userNames[otherUserId]) {
      return userNames[otherUserId];
    }

    const otherUserDetails = conversation.participantDetails?.[otherUserId];
    return otherUserDetails?.displayName || otherUserDetails?.email || "User";
  };

  const getOtherUserInitial = (conversation: Conversation) => {
    const name = getOtherUserName(conversation);
    return name.charAt(0).toUpperCase();
  };

  const formatLastMessage = (conversation: Conversation) => {
    if (!conversation.lastMessage || conversation.lastMessage.trim() === "") {
      return "No messages yet";
    }

    // Kiểm tra xem tin nhắn cuối cùng có phải của mình không
    const isMyMessage = conversation.lastMessageUserId === user?.uid;

    if (isMyMessage) {
      return `You: ${conversation.lastMessage}`;
    }

    return conversation.lastMessage;
  };

  const handleLogout = () => {
    auth.signOut();
  };

  const formatTime = (timestamp?: number) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (days === 1) {
      return "Yesterday";
    } else if (days < 7) {
      return date.toLocaleDateString([], { weekday: "short" });
    } else {
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }
  };

  const createTestConversation = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const newConv = await collection(db, "conversations");
      await addDoc(newConv, {
        users: [user.uid],
        lastMessage: "Test conversation created!",
        lastMessageTimestamp: Date.now(),
      });
    } catch (error) {
      console.error("Error creating conversation:", error);
    }
  };

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate("Profile")}
          style={{ marginLeft: 12 }}
        >
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: "#007AFF",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>
              {user?.displayName?.charAt(0).toUpperCase() || "U"}
            </Text>
          </View>
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate("SearchUsers")}
          style={{ marginRight: 16 }}
        >
          <Ionicons name="person-add-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  return (
    <View style={styles.container}>
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const unreadCount = item.unreadCount || 0;
          return (
            <TouchableOpacity
              style={styles.item}
              onPress={() =>
                navigation.navigate("ChatRoom", {
                  conversationId: item.id,
                  name: getOtherUserName(item),
                })
              }
              activeOpacity={0.7}
            >
              <View style={styles.avatarContainer}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {getOtherUserInitial(item)}
                  </Text>
                </View>
              </View>
              <View style={styles.itemContent}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemText} numberOfLines={1}>
                    {getOtherUserName(item)}
                  </Text>
                  <Text style={styles.timeText}>
                    {formatTime(item.lastMessageTimestamp)}
                  </Text>
                </View>
                <View style={styles.lastMessageContainer}>
                  <Text style={styles.subText} numberOfLines={2}>
                    {formatLastMessage(item)}
                  </Text>
                  {unreadCount > 0 && item.lastMessageUserId !== user?.uid && (
                    <View style={styles.unreadDot} />
                  )}
                </View>
              </View>
              {unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadText}>{unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={64} color="#d1d1d6" />
            <Text style={styles.emptyText}>No conversations yet</Text>
            <Text style={styles.emptySubText}>
              Start a new conversation to begin chatting
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  item: {
    flexDirection: "row",
    padding: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: "#d1d1d6",
    backgroundColor: "#fff",
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "600",
  },
  itemContent: {
    flex: 1,
    justifyContent: "center",
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  itemText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#000",
    flex: 1,
  },
  timeText: {
    fontSize: 14,
    color: "#8e8e93",
    marginLeft: 8,
  },
  lastMessageContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  subText: {
    fontSize: 15,
    color: "#8e8e93",
    lineHeight: 20,
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#007AFF",
  },
  unreadBadge: {
    backgroundColor: "#34c759",
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  unreadText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#8e8e93",
    marginTop: 16,
  },
  emptySubText: {
    fontSize: 15,
    color: "#c7c7cc",
    marginTop: 8,
    textAlign: "center",
  },
});
