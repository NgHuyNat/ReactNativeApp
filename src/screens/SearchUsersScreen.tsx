import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Text,
  Alert,
  ActivityIndicator,
} from "react-native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../types";
import { auth, db } from "../config/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  Timestamp,
  arrayUnion,
  doc,
  updateDoc,
  getDoc,
} from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";

type SearchUsersScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "SearchUsers"
>;

interface Props {
  navigation: SearchUsersScreenNavigationProp;
}

interface User {
  id: string;
  email: string;
  displayName: string;
}

export default function SearchUsersScreen({ navigation }: Props) {
  const [searchText, setSearchText] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const currentUser = auth.currentUser;

  const searchUsers = async () => {
    if (!searchText.trim()) {
      setUsers([]);
      return;
    }

    setLoading(true);
    try {
      const usersRef = collection(db, "users");
      const q = query(
        usersRef,
        where("email", ">=", searchText.toLowerCase()),
        where("email", "<=", searchText.toLowerCase() + "\uf8ff")
      );

      const snapshot = await getDocs(q);
      const foundUsers: User[] = [];

      snapshot.forEach((doc) => {
        if (doc.id !== currentUser?.uid) {
          foundUsers.push({
            id: doc.id,
            email: doc.data().email,
            displayName: doc.data().displayName || "User",
          });
        }
      });

      setUsers(foundUsers);
    } catch (error) {
      console.error("Error searching users:", error);
      Alert.alert("Error", "Could not search users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      searchUsers();
    }, 500);

    return () => clearTimeout(timer);
  }, [searchText]);

  const createOrOpenConversation = async (otherUser: User) => {
    if (!currentUser) return;

    setLoading(true);
    try {
      // Tìm xem đã có conversation giữa 2 người chưa
      const conversationsRef = collection(db, "conversations");
      const q = query(
        conversationsRef,
        where("participants", "array-contains", currentUser.uid)
      );

      const snapshot = await getDocs(q);
      let existingConversationId: string | null = null;

      snapshot.forEach((doc) => {
        const participants = doc.data().participants;
        if (participants.includes(otherUser.id) && participants.length === 2) {
          existingConversationId = doc.id;
        }
      });

      // Nếu đã có conversation, mở nó
      if (existingConversationId) {
        navigation.navigate("ChatRoom", {
          conversationId: existingConversationId,
          name: otherUser.displayName,
        });
        return;
      }

      // Nếu chưa có, tạo mới
      const newConversation = {
        participants: [currentUser.uid, otherUser.id],
        participantDetails: {
          [currentUser.uid]: {
            displayName: currentUser.displayName || "User",
            email: currentUser.email,
          },
          [otherUser.id]: {
            displayName: otherUser.displayName,
            email: otherUser.email,
          },
        },
        createdAt: Timestamp.now(),
        lastMessage: "",
        lastMessageTime: Timestamp.now(),
      };

      const docRef = await addDoc(conversationsRef, newConversation);

      navigation.navigate("ChatRoom", {
        conversationId: docRef.id,
        name: otherUser.displayName,
      });
    } catch (error) {
      console.error("Error creating conversation:", error);
      Alert.alert("Error", "Could not create conversation");
    } finally {
      setLoading(false);
    }
  };

  const renderUser = ({ item }: { item: User }) => (
    <TouchableOpacity
      style={styles.userItem}
      onPress={() => createOrOpenConversation(item)}
      activeOpacity={0.7}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {item.displayName.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.displayName}</Text>
        <Text style={styles.userEmail}>{item.email}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#c7c7cc" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Ionicons
          name="search"
          size={20}
          color="#8e8e93"
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchInput}
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Tìm kiếm theo email..."
          placeholderTextColor="#8e8e93"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
        />
        {searchText.length > 0 && (
          <TouchableOpacity onPress={() => setSearchText("")}>
            <Ionicons name="close-circle" size={20} color="#8e8e93" />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : users.length > 0 ? (
        <FlatList
          data={users}
          renderItem={renderUser}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
        />
      ) : searchText.length > 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="person-outline" size={64} color="#c7c7cc" />
          <Text style={styles.emptyText}>Không tìm thấy người dùng</Text>
        </View>
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="search" size={64} color="#c7c7cc" />
          <Text style={styles.emptyText}>Nhập email để tìm người dùng</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0f2f5",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#c7c7cc",
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 17,
    color: "#000",
  },
  listContainer: {
    paddingVertical: 8,
  },
  userItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#f0f2f5",
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#4a90e2",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "600",
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 17,
    fontWeight: "600",
    color: "#000",
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 15,
    color: "#8e8e93",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 17,
    color: "#8e8e93",
    marginTop: 16,
    textAlign: "center",
  },
});
