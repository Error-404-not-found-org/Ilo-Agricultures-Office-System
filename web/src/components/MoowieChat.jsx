import React, { useEffect } from "react";
import { useUser } from "@clerk/clerk-react";

const MoowieChat = () => {
  const { user } = useUser();
  const role = user?.publicMetadata?.role || "farmer";
  const userName = user?.firstName || "Guest";

  useEffect(() => {
    const projectId = import.meta.env.VITE_VOICEFLOW_PROJECT_ID;
    if (!projectId || projectId === "your_voiceflow_project_id_here") {
      console.warn(
        "[Voiceflow Warning] VITE_VOICEFLOW_PROJECT_ID in web/.env is not configured yet.",
      );
      return;
    }

    // 1. Create Voiceflow widget-next script element
    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = "https://cdn.voiceflow.com/widget-next/bundle.mjs";
    script.onload = () => {
      let retries = 0;
      const initVoiceflow = () => {
        if (window.voiceflow?.chat?.load) {
          window.voiceflow.chat.load({
            verify: { projectID: projectId },
            url: "https://general-runtime.voiceflow.com",
            voice: {
              url: "https://runtime-api.voiceflow.com"
            },
            user: {
              name: userName,
            },
            launch: {
              event: {
                type: "launch",
                payload: {
                  user_name: userName,
                  user_role: role,
                }
              }
            },
            render: {
              variables: {
                user_name: userName,
                user_role: role,
              },
            },
          });

          // Inject session variables directly into Voiceflow
          setTimeout(() => {
            if (window.voiceflow?.chat?.setVariables) {
              window.voiceflow.chat.setVariables({
                user_name: userName,
                user_role: role,
              });
              console.log("[Voiceflow] Session variables injected successfully:", { userName, role });
            }
          }, 500);
        } else if (retries < 15) {
          retries++;
          setTimeout(initVoiceflow, 100);
        }
      };
      initVoiceflow();
    };

    // 2. Append script to document body
    document.body.appendChild(script);

    // 3. Register click handler for sidebar trigger button
    const handleTriggerClick = (e) => {
      e.preventDefault();
      if (window.voiceflow?.chat) {
        window.voiceflow.chat.open();
      }
    };

    const triggerBtn = document.getElementById("moowie-trigger");
    if (triggerBtn) {
      triggerBtn.addEventListener("click", handleTriggerClick);
    }

    // 4. Cleanup on unmount
    return () => {
      if (triggerBtn) {
        triggerBtn.removeEventListener("click", handleTriggerClick);
      }
      // Remove Voiceflow script and container to prevent duplicate widgets
      script.remove();

      // Clean up any Voiceflow DOM residues
      const vfWidget =
        document.getElementById("voiceflow-chat-frame") ||
        document.querySelector(".vfrc-widget");
      if (vfWidget) vfWidget.remove();

      if (window.voiceflow) {
        delete window.voiceflow;
      }
    };
  }, [user, role, userName]);

  // Render a hidden target button for sidebar document.getElementById('moowie-trigger') to bind to
  return <button id="moowie-trigger" style={{ display: "none" }} />;
};

export default MoowieChat;
