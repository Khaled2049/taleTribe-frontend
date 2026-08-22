import React from "react";
import { ChatMessage as IChatMessage } from "@/types/IChat";
import { Sparkles } from "lucide-react";

interface ChatMessageProps {
  message: IChatMessage;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === "user";

  return (
    <div
      data-cy={isUser ? "chat-message-user" : "chat-message-assistant"}
      className={`flex items-end gap-2 ${isUser ? "justify-end" : "justify-start"}`}
    >
      {!isUser && (
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-ns-accent-subtle flex items-center justify-center mb-5">
          <Sparkles className="w-3 h-3 text-ns-accent" />
        </div>
      )}

      <div
        className={`flex flex-col gap-1 max-w-[78%] ${isUser ? "items-end" : "items-start"}`}
      >
        <div
          className={`px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
            isUser
              ? "bg-ns-accent text-white rounded-2xl rounded-br-md"
              : "bg-ns-elevated text-ns-ink rounded-2xl rounded-bl-md border border-ns-border"
          }`}
        >
          {message.content}
        </div>
        <span className="text-[11px] text-ns-ink-muted px-1">
          {message.timestamp.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  );
};
