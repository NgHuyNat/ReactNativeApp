import React, { useState, useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "../config/firebase";
import LoginScreen from "../screens/LoginScreen";
import ChatListScreen from "../screens/ChatListScreen";
import ChatRoomScreen from "../screens/ChatRoomScreen";
import SearchUsersScreen from "../screens/SearchUsersScreen";
import ProfileScreen from "../screens/ProfileScreen";
import { RootStackParamList } from "../types";
import { ActivityIndicator, View } from "react-native";
import { useUserPresence } from "../hooks/usePresence";

const Stack = createStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Sử dụng presence hook để track online/offline
  useUserPresence();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {user ? (
          <>
            <Stack.Screen
              name="ChatList"
              component={ChatListScreen}
              options={{ title: "Conversations" }}
            />
            <Stack.Screen
              name="SearchUsers"
              component={SearchUsersScreen}
              options={{ title: "Tìm người dùng" }}
            />
            <Stack.Screen
              name="Profile"
              component={ProfileScreen}
              options={{ title: "Profile" }}
            />
            <Stack.Screen name="ChatRoom" component={ChatRoomScreen} />
          </>
        ) : (
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
