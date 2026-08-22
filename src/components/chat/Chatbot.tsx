import React, { useState, useRef, useEffect } from "react";
import { X, Send, Sparkles, Trash2, Check } from "lucide-react";
import { useChat } from "@/contexts/ChatContext";
import { ChatMessage } from "./ChatMessage";
import { EmptyChatState } from "./EmptyChatState";

interface ChatbotProps {
  storyId: string;
  onClose?: () => void;
  mode?: "sidebar" | "floating";
}

export const Chatbot: React.FC<ChatbotProps> = ({
  storyId,
  onClose,
  mode = "sidebar",
}) => {
  const {
    messages,
    isLoading,
    error,
    sendMessage,
    initializeChat,
    clearChat,
    clearError,
  } = useChat();
  const [inputMessage, setInputMessage] = useState("");
  const [confirmingClear, setConfirmingClear] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (storyId) initializeChat(storyId);
  }, [storyId, initializeChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [inputMessage]);

  const handleSend = async () => {
    if (!inputMessage.trim() || isLoading) return;
    const msg = inputMessage;
    setInputMessage("");
    await sendMessage(storyId, msg);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleSuggestion = (text: string) => {
    setInputMessage(text);
    textareaRef.current?.focus();
  };

  const handleClearConfirm = async () => {
    setConfirmingClear(false);
    setInputMessage("");
    await clearChat(storyId);
  };

  return (
    <div
      className={`flex flex-col h-full bg-ns-bg ${
        mode === "floating" ? "border-l border-ns-border" : ""
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-ns-border shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-ns-accent" />
          <span className="font-heading text-sm text-ns-ink">
            Writing Assistant
          </span>
        </div>
        <div className="flex items-center gap-1">
          {confirmingClear ? (
            <div className="flex items-center gap-1.5 text-ns-destructive">
              <span className="font-ui text-xs">Clear everything?</span>
              <button
                onClick={() => void handleClearConfirm()}
                className="p-1 rounded hover:bg-ns-destructive/10 transition-colors"
                aria-label="Confirm clear"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setConfirmingClear(false)}
                className="p-1 rounded hover:bg-ns-surface-hover transition-colors text-ns-ink-muted hover:text-ns-ink"
                aria-label="Cancel clear"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmingClear(true)}
              disabled={isLoading || messages.length === 0}
              className="p-1 rounded text-ns-ink-muted hover:text-ns-destructive hover:bg-ns-destructive/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Clear chat"
              title="Clear chat and memory"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded text-ns-ink-muted hover:text-ns-ink hover:bg-ns-surface-hover transition-colors"
              aria-label="Close chat"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-ns-destructive/10 border-b border-ns-destructive/20 shrink-0">
          <p className="font-ui text-xs text-ns-destructive">{error}</p>
          <button
            onClick={clearError}
            className="text-ns-destructive hover:opacity-70 transition-opacity"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
        {messages.length === 0 ? (
          <EmptyChatState onSuggestion={handleSuggestion} />
        ) : (
          messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))
        )}

        {/* Typing indicator */}
        {isLoading && (
          <div className="flex items-end gap-2 justify-start">
            <div className="w-6 h-6 rounded-full bg-ns-accent-subtle flex items-center justify-center mb-5 flex-shrink-0">
              <Sparkles className="w-3 h-3 text-ns-accent" />
            </div>
            <div className="px-4 py-3 bg-ns-elevated border border-ns-border rounded-2xl rounded-bl-md">
              <div className="flex gap-1 items-center">
                <span
                  className="w-1.5 h-1.5 rounded-full bg-ns-ink-muted animate-bounce"
                  style={{ animationDelay: "0ms" }}
                />
                <span
                  className="w-1.5 h-1.5 rounded-full bg-ns-ink-muted animate-bounce"
                  style={{ animationDelay: "150ms" }}
                />
                <span
                  className="w-1.5 h-1.5 rounded-full bg-ns-ink-muted animate-bounce"
                  style={{ animationDelay: "300ms" }}
                />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-3 border-t border-ns-border shrink-0">
        <div className="flex items-end gap-2 bg-ns-surface border border-ns-border rounded-2xl px-3 py-2 focus-within:border-ns-accent transition-colors">
          <textarea
            ref={textareaRef}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            data-cy="chat-input"
            placeholder="Ask about your story…"
            className="flex-1 resize-none bg-transparent font-ui text-sm text-ns-ink placeholder:text-ns-ink-muted focus:outline-none min-h-[20px] leading-5"
            rows={1}
            disabled={isLoading}
          />
          <button
            onClick={() => void handleSend()}
            disabled={!inputMessage.trim() || isLoading}
            className="flex-shrink-0 w-7 h-7 rounded-full bg-ns-accent flex items-center justify-center hover:bg-ns-accent-hover transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Send message"
            data-cy="chat-send"
          >
            <Send className="w-3.5 h-3.5 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
};
