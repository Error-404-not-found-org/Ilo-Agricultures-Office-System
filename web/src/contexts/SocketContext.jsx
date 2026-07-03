import { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "@clerk/clerk-react";

const SocketContext = createContext(null);

// eslint-disable-next-line react-refresh/only-export-components
export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const { getToken, isSignedIn } = useAuth();

  useEffect(() => {
    if (!isSignedIn) {
      Promise.resolve().then(() => {
        setSocket((currentSocket) => {
          if (currentSocket) currentSocket.disconnect();
          return null;
        });
      });
      return;
    }

    let isMounted = true;
    let newSocket = null;

    const establishConnection = async () => {
      try {
        const token = await getToken();
        if (!isMounted) return;

        let socketUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
        socketUrl = socketUrl.replace(/\/api$/, "");

        console.log("[Socket] Attempting connection to:", socketUrl);

        newSocket = io(socketUrl, {
          withCredentials: true,
          transports: ["websocket", "polling"],
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          auth: {
            token
          }
        });

        newSocket.on("connect", () => {
          console.log("[Socket] Connected to server");
        });

        newSocket.on("connect_error", async (err) => {
          console.error("[Socket] Connection error:", err.message);
          if (err.message && err.message.includes("Authentication error")) {
            try {
              const freshToken = await getToken();
              newSocket.auth = { ...newSocket.auth, token: freshToken };
            } catch (tokenErr) {
              console.error("[Socket] Failed to refresh token:", tokenErr);
            }
          }
        });

        setSocket(newSocket);
      } catch (err) {
        console.error("[Socket] Init failed:", err);
      }
    };

    establishConnection();

    return () => {
      isMounted = false;
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, [isSignedIn, getToken]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};
