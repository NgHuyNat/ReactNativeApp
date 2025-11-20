import { initializeApp } from "firebase/app";
// @ts-ignore
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";

// TODO: Replace with your actual Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBLsCEYkXIb6nyrKeDl8CzDGEuPtxJOBUk",
  authDomain: "chatapp-e148b.firebaseapp.com",
  projectId: "chatapp-e148b",
  storageBucket: "chatapp-e148b.firebasestorage.app",
  messagingSenderId: "678987402306",
  appId: "1:678987402306:web:90c39406b9877e690831db",
  measurementId: "G-S7FBE97W4Q",
};

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage),
});
export const db = getFirestore(app);
export const storage = getStorage(app);
