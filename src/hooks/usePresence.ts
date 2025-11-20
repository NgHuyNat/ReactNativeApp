import { useEffect } from "react";
import { AppState, AppStateStatus } from "react-native";
import { auth, db } from "../config/firebase";
import {
  doc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";

export const useUserPresence = () => {
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const userRef = doc(db, "users", user.uid);

    // Set user online khi vào app
    const setOnline = async () => {
      try {
        await updateDoc(userRef, {
          isOnline: true,
          lastSeen: serverTimestamp(),
        });
      } catch (error) {
        console.error("Error setting online status:", error);
      }
    };

    // Set user offline khi thoát app
    const setOffline = async () => {
      try {
        await updateDoc(userRef, {
          isOnline: false,
          lastSeen: serverTimestamp(),
        });
      } catch (error) {
        console.error("Error setting offline status:", error);
      }
    };

    // Set online khi mount
    setOnline();

    // Lắng nghe app state changes
    const subscription = AppState.addEventListener(
      "change",
      (nextAppState: AppStateStatus) => {
        if (nextAppState === "active") {
          setOnline();
        } else if (
          nextAppState === "background" ||
          nextAppState === "inactive"
        ) {
          setOffline();
        }
      }
    );

    // Set offline khi unmount
    return () => {
      setOffline();
      subscription.remove();
    };
  }, []);
};

export const useOtherUserStatus = (userId: string) => {
  const [isOnline, setIsOnline] = React.useState(false);
  const [lastSeen, setLastSeen] = React.useState<number | null>(null);

  useEffect(() => {
    if (!userId) return;

    const userRef = doc(db, "users", userId);
    const unsubscribe = onSnapshot(userRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setIsOnline(data.isOnline || false);
        setLastSeen(data.lastSeen?.toMillis() || null);
      }
    });

    return () => unsubscribe();
  }, [userId]);

  return { isOnline, lastSeen };
};

// Import React ở đầu file
import React from "react";
