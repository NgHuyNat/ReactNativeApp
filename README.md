# Chat App

A React Native Chat Application built with Expo, Firebase, and TypeScript.

## Features

- **Authentication**: Login and Sign Up using Firebase Auth.
- **Real-time Messaging**: Chat with other users in real-time using Firestore.
- **Image Sharing**: Send images in chat using `expo-image-picker` and Firebase Storage.
- **Conversation List**: View your active conversations.

## Setup

1.  **Install Dependencies**:

    ```bash
    npm install
    ```

2.  **Firebase Configuration**:

    - Create a Firebase project at [https://console.firebase.google.com/](https://console.firebase.google.com/).
    - Enable **Authentication** (Email/Password).
    - Enable **Firestore Database**.
    - Enable **Storage**.
    - Copy your web app configuration.
    - Update `src/config/firebase.ts` with your configuration keys.

3.  **Run the App**:
    ```bash
    npx expo start
    ```

## Project Structure

- `src/screens`: Application screens (Login, ChatList, ChatRoom).
- `src/navigation`: Navigation configuration.
- `src/config`: Firebase configuration.
- `src/types`: TypeScript definitions.
