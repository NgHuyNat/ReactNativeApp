import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Text,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  Dimensions,
  ScrollView,
  Vibration,
} from "react-native";
import { RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../types";
import { auth, db } from "../config/firebase";
import {
  collection,
  addDoc,
  orderBy,
  query,
  onSnapshot,
  Timestamp,
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useOtherUserStatus } from "../hooks/usePresence";
import * as Notifications from "expo-notifications";
import { AppState } from "react-native";

// Cấu hình notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

interface Message {
  _id: string;
  text: string;
  createdAt: Date;
  user: {
    _id: string;
    name: string;
  };
  image?: string;
  status?: "sending" | "sent" | "delivered" | "read";
}

type ChatRoomScreenRouteProp = RouteProp<RootStackParamList, "ChatRoom">;
type ChatRoomScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "ChatRoom"
>;

interface Props {
  route: ChatRoomScreenRouteProp;
  navigation: ChatRoomScreenNavigationProp;
}

export default function ChatRoomScreen({ route, navigation }: Props) {
  const { conversationId, name } = route.params;
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [otherUserId, setOtherUserId] = useState<string>("");
  const [userNames, setUserNames] = useState<{ [key: string]: string }>({});
  const [isAppInForeground, setIsAppInForeground] = useState(true);
  const user = auth.currentUser;

  // Request notification permissions
  useEffect(() => {
    const requestPermissions = async () => {
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        console.log("Notification permissions not granted");
      }
    };

    requestPermissions();
  }, []);

  // Track app state để biết app có đang mở không
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      setIsAppInForeground(nextAppState === "active");
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Đánh dấu đã đọc tin nhắn khi vào chat room
  useEffect(() => {
    if (!user) return;

    const markAsRead = async () => {
      try {
        const convRef = doc(db, "conversations", conversationId);
        const convSnap = await getDoc(convRef);
        if (convSnap.exists()) {
          const data = convSnap.data();
          const lastReadTimestamp = data.lastReadTimestamp || {};

          // Cập nhật timestamp đã đọc của user hiện tại
          await import("firebase/firestore").then(
            ({ updateDoc, serverTimestamp }) =>
              updateDoc(convRef, {
                [`lastReadTimestamp.${user.uid}`]: Date.now(),
              })
          );
        }
      } catch (error) {
        console.error("Error marking as read:", error);
      }
    };

    markAsRead();
  }, [conversationId, user]);

  // Lấy trạng thái online/offline của người dùng khác
  const { isOnline, lastSeen } = useOtherUserStatus(otherUserId);

  useEffect(() => {
    // Lấy thông tin conversation để tìm otherUserId
    const getOtherUser = async () => {
      if (!user) return;
      const convRef = doc(db, "conversations", conversationId);
      const convSnap = await getDoc(convRef);
      if (convSnap.exists()) {
        const participants = convSnap.data().participants || [];
        const otherId = participants.find((id: string) => id !== user.uid);
        if (otherId) setOtherUserId(otherId);
      }
    };
    getOtherUser();

    // Format last seen
    const formatLastSeen = (timestamp: number | null) => {
      if (!timestamp) return "";
      const now = Date.now();
      const diff = now - timestamp;
      const minutes = Math.floor(diff / 60000);
      if (minutes < 1) return "Active now";
      if (minutes < 60) return `Active ${minutes}m ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `Active ${hours}h ago`;
      return `Active ${Math.floor(hours / 24)}d ago`;
    };

    navigation.setOptions({
      title: name,
      headerTitle: () => (
        <View style={{ alignItems: "center" }}>
          <Text style={{ fontSize: 17, fontWeight: "600", color: "#000" }}>
            {name}
          </Text>
          <Text
            style={{ fontSize: 12, color: isOnline ? "#34c759" : "#8e8e93" }}
          >
            {isOnline ? "Online" : formatLastSeen(lastSeen)}
          </Text>
        </View>
      ),
    });

    const messagesRef = collection(
      db,
      "conversations",
      conversationId,
      "messages"
    );
    const q = query(messagesRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      // Kiểm tra tin nhắn mới
      const docChanges = snapshot.docChanges();
      const newMessages = docChanges.filter(
        (change) => change.type === "added"
      );

      const msgs: Message[] = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          _id: doc.id,
          text: data.text,
          createdAt: data.createdAt.toDate(),
          user: data.user,
          image: data.image,
          status: data.status || "sent",
        };
      });

      // Lấy tên mới nhất từ Firestore users collection
      const uniqueUserIds = [...new Set(msgs.map((msg) => msg.user._id))];
      const names: { [key: string]: string } = {};

      await Promise.all(
        uniqueUserIds.map(async (userId) => {
          try {
            const userDoc = await getDoc(doc(db, "users", userId));
            if (userDoc.exists()) {
              names[userId] = userDoc.data().displayName || "User";
            }
          } catch (error) {
            console.error("Error fetching user name:", error);
          }
        })
      );

      setUserNames(names);
      setMessages(msgs);

      // Xử lý tin nhắn mới từ người khác
      // Chỉ hoạt động khi có tin nhắn mới (không phải load lần đầu)
      if (messages.length > 0) {
        for (const change of newMessages) {
          const msgData = change.doc.data();
          const isFromOtherUser = msgData.user._id !== user?.uid;

          if (isFromOtherUser) {
            const senderName =
              names[msgData.user._id] || msgData.user.name || "Someone";

            // Nếu app đang ở background, gửi notification
            if (!isAppInForeground) {
              try {
                await Notifications.scheduleNotificationAsync({
                  content: {
                    title: senderName,
                    body: msgData.text || "📷 Photo",
                    sound: true,
                    data: { conversationId, name },
                  },
                  trigger: null,
                });
              } catch (error) {
                console.log("Notification not supported");
              }
            } else {
              // Nếu app đang mở, rung điện thoại để báo có tin nhắn mới
              Vibration.vibrate(100);
            }
          }
        }
      }
    });

    return () => unsubscribe();
  }, [conversationId, navigation, name, isOnline, lastSeen]);

  const sendMessage = async () => {
    if (!inputText.trim() || !user) return;

    const messageText = inputText.trim();
    const messageData = {
      _id: Math.random().toString(36).substring(7),
      createdAt: Timestamp.now(),
      text: messageText,
      user: {
        _id: user.uid,
        name: user.displayName || "User",
      },
      userId: user.uid,
      timestamp: Date.now(),
      status: "sent",
    };

    try {
      setInputText(""); // Xóa input ngay sau khi gửi
      await addDoc(
        collection(db, "conversations", conversationId, "messages"),
        messageData
      );

      // Cập nhật lastMessage và lastMessageUserId trong conversation
      await updateDoc(doc(db, "conversations", conversationId), {
        lastMessage: messageText,
        lastMessageTime: Timestamp.now(),
        lastMessageUserId: user.uid,
      });
    } catch (error) {
      console.error("Error sending message: ", error);
      Alert.alert("Error", "Could not send message. Please try again.");
    }
  };

  const pickImage = async () => {
    // Yêu cầu quyền truy cập thư viện ảnh
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert("Permission Required", "Please allow access to your photos");
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const base64 = result.assets[0].base64;
      if (base64) {
        sendImageMessage(base64);
      }
    }
  };

  const sendImageMessage = async (base64: string) => {
    if (!user) return;
    try {
      const messageData = {
        _id: Math.random().toString(36).substring(7),
        createdAt: Timestamp.now(),
        text: "",
        image: `data:image/jpeg;base64,${base64}`,
        user: {
          _id: user.uid,
          name: user.displayName || "User",
        },
        userId: user.uid,
        timestamp: Date.now(),
        status: "sent",
      };

      await addDoc(
        collection(db, "conversations", conversationId, "messages"),
        messageData
      );

      // Cập nhật lastMessage và lastMessageUserId trong conversation
      await updateDoc(doc(db, "conversations", conversationId), {
        lastMessage: "📷 Photo",
        lastMessageTime: Timestamp.now(),
        lastMessageUserId: user.uid,
      });
    } catch (error: any) {
      console.error("Error sending image: ", error);
      Alert.alert("Error", "Could not send image. Image might be too large.");
    }
  };

  const renderStatusIcon = (status: string) => {
    switch (status) {
      case "sent":
        return (
          <Ionicons
            name="checkmark"
            size={14}
            color="rgba(255, 255, 255, 0.8)"
          />
        );
      case "delivered":
        return (
          <Ionicons
            name="checkmark-done"
            size={14}
            color="rgba(255, 255, 255, 0.8)"
          />
        );
      case "read":
        return <Ionicons name="checkmark-done" size={14} color="#34c759" />;
      default:
        return null;
    }
  };

  const formatTime = (date: Date) => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}`;
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isCurrentUser = item.user._id === user?.uid;
    return (
      <View
        style={[
          styles.messageContainer,
          isCurrentUser && styles.currentUserContainer,
        ]}
      >
        {!isCurrentUser && (
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(userNames[item.user._id] || item.user.name)
                  .charAt(0)
                  .toUpperCase()}
              </Text>
            </View>
          </View>
        )}
        <View
          style={[
            styles.messageBubble,
            isCurrentUser ? styles.currentUserBubble : styles.otherUserBubble,
          ]}
        >
          {!isCurrentUser && (
            <Text style={styles.userName}>
              {userNames[item.user._id] || item.user.name}
            </Text>
          )}
          {item.image && (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => setSelectedImage(item.image || null)}
            >
              <Image source={{ uri: item.image }} style={styles.messageImage} />
            </TouchableOpacity>
          )}
          {item.text ? (
            <Text
              style={[
                styles.messageText,
                isCurrentUser ? styles.currentUserText : styles.otherUserText,
              ]}
            >
              {item.text}
            </Text>
          ) : null}
          <View style={styles.messageFooter}>
            <Text
              style={[
                styles.timestamp,
                isCurrentUser
                  ? styles.currentUserTimestamp
                  : styles.otherUserTimestamp,
              ]}
            >
              {formatTime(item.createdAt)}
            </Text>
            {isCurrentUser && item.status && (
              <View style={styles.statusIcon}>
                {renderStatusIcon(item.status)}
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={90}
    >
      <FlatList
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item._id}
        inverted
        contentContainerStyle={styles.messageList}
      />
      <View style={styles.inputContainer}>
        <TouchableOpacity
          style={styles.iconButton}
          activeOpacity={0.6}
          onPress={pickImage}
        >
          <Ionicons name="image-outline" size={26} color="#007AFF" />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Aa"
          placeholderTextColor="#8e8e93"
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          onPress={sendMessage}
          style={styles.sendButton}
          activeOpacity={0.8}
          disabled={!inputText.trim()}
        >
          <Ionicons name="arrow-up" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Modal xem ảnh full screen */}
      <Modal
        visible={selectedImage !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedImage(null)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={() => setSelectedImage(null)}
            activeOpacity={0.8}
          >
            <Ionicons name="close" size={32} color="#fff" />
          </TouchableOpacity>
          <ScrollView
            contentContainerStyle={styles.modalScrollContent}
            maximumZoomScale={3}
            minimumZoomScale={1}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
          >
            {selectedImage && (
              <Image
                source={{ uri: selectedImage }}
                style={styles.fullScreenImage}
                resizeMode="contain"
              />
            )}
          </ScrollView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0f2f5",
  },
  messageList: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  messageContainer: {
    flexDirection: "row",
    marginVertical: 2,
    paddingHorizontal: 4,
  },
  currentUserContainer: {
    justifyContent: "flex-end",
  },
  avatarContainer: {
    marginRight: 8,
    marginTop: 4,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#4a90e2",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  messageBubble: {
    maxWidth: "70%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    marginVertical: 2,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  currentUserBubble: {
    backgroundColor: "#007AFF",
    borderBottomRightRadius: 4,
  },
  otherUserBubble: {
    backgroundColor: "#fff",
    borderBottomLeftRadius: 4,
  },
  userName: {
    fontSize: 11,
    color: "#8e8e93",
    marginBottom: 4,
    fontWeight: "600",
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  currentUserText: {
    color: "#fff",
  },
  otherUserText: {
    color: "#000",
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginBottom: 6,
  },
  messageFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 4,
  },
  timestamp: {
    fontSize: 11,
  },
  currentUserTimestamp: {
    color: "rgba(255, 255, 255, 0.8)",
  },
  otherUserTimestamp: {
    color: "#8e8e93",
  },
  statusIcon: {
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#fff",
    borderTopWidth: 0.5,
    borderTopColor: "#d1d1d6",
  },
  iconButton: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  input: {
    flex: 1,
    backgroundColor: "#f0f2f5",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    marginHorizontal: 8,
    maxHeight: 100,
    fontSize: 16,
    color: "#000",
  },
  sendButton: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#007AFF",
    borderRadius: 18,
    marginBottom: 4,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalCloseButton: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 22,
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  fullScreenImage: {
    width: Dimensions.get("window").width,
    height: Dimensions.get("window").height,
  },
});
