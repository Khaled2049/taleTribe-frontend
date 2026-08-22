import { IMessage } from "@/types/IMessage";
import { useEffect, useRef, useState } from "react";
import { bookClubRepo } from "./bookClubRepo";
import { Send, AlertTriangle } from "lucide-react";
import { IUser } from "@/types/IUser";
import SpoilerTag from "./components/SpoilerTag";
import { ISpoilerTag } from "@/types/IClub";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RATE_LIMITS } from "@/config/rateLimits";
import { rateLimitService } from "@/services/RateLimitService";
import {
  useAuthorUsername,
  useProfileNames,
} from "@/hooks/queries/useUserQueries";

interface BookClubChatProps {
  clubId: string;
  user: IUser;
  userCurrentChapter?: number;
}

const BookClubChat: React.FC<BookClubChatProps> = ({
  clubId,
  user,
  userCurrentChapter = 0,
}) => {
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSpoilerDialogOpen, setIsSpoilerDialogOpen] = useState(false);
  const [spoilerContent, setSpoilerContent] = useState("");
  const [spoilerStartChapter, setSpoilerStartChapter] = useState<number>(1);
  const [spoilerEndChapter, setSpoilerEndChapter] = useState<
    number | undefined
  >();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Keyed by the sender set, so it resolves from cache whenever those profiles
  // were already fetched elsewhere on the page.
  const senderNames = useProfileNames(messages.map((m) => m.senderId));
  const currentUsername = useAuthorUsername(
    user.uid,
    user.username || "Anonymous",
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const maxMessageLength = RATE_LIMITS.MAX_MESSAGE_SIZE_CHARS;

  useEffect(() => {
    // Subscribe to messages
    const unsubscribe = bookClubRepo.getMessages(clubId, (updatedMessages) => {
      setMessages(updatedMessages);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [clubId]);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const getMessageSender = (message: IMessage) =>
    senderNames.get(message.senderId) || message.sender || "Anonymous";

  // Shared send pipeline: length check → rate limit → write → increment count.
  // Membership is enforced by Firestore rules; a denied write surfaces via catch.
  const submitMessage = async (message: IMessage): Promise<boolean> => {
    if (message.content.length > maxMessageLength) {
      setErrorMessage(
        `Message is too long. Maximum ${maxMessageLength} characters allowed.`,
      );
      return false;
    }

    const rateLimitCheck = await rateLimitService.canSendMessage(user.uid);
    if (!rateLimitCheck.allowed) {
      setErrorMessage(rateLimitCheck.message || "Rate limit exceeded");
      return false;
    }

    try {
      await bookClubRepo.sendMessage(clubId, message);
      await rateLimitService.incrementMessageCount(user.uid);
      setErrorMessage(null);
      return true;
    } catch (error) {
      console.error("Error sending message:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to send message",
      );
      return false;
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!newMessage.trim()) return;

    const sent = await submitMessage({
      content: newMessage.trim(),
      sender: currentUsername,
      senderId: user.uid,
    });

    if (sent) setNewMessage("");
  };

  const handleSendSpoiler = async () => {
    if (!spoilerContent.trim()) return;

    // Validate chapter range
    if (
      spoilerEndChapter !== undefined &&
      spoilerEndChapter < spoilerStartChapter
    ) {
      setErrorMessage("End chapter cannot be before start chapter.");
      return;
    }

    const sent = await submitMessage({
      content: spoilerContent.trim(),
      sender: currentUsername,
      senderId: user.uid,
      hasSpoiler: true,
      spoilerChapterRange: {
        start: spoilerStartChapter,
        ...(spoilerEndChapter !== undefined && { end: spoilerEndChapter }),
      },
    });

    if (sent) {
      setSpoilerContent("");
      setSpoilerStartChapter(1);
      setSpoilerEndChapter(undefined);
      setIsSpoilerDialogOpen(false);
    }
  };

  const renderMessageContent = (message: IMessage) => {
    if (message.hasSpoiler && message.spoilerChapterRange) {
      const spoiler: ISpoilerTag = {
        content: message.content,
        chapterRange: message.spoilerChapterRange,
      };
      return (
        <SpoilerTag
          spoiler={spoiler}
          userCurrentChapter={userCurrentChapter}
          className="w-full"
        />
      );
    }
    return <p className="break-words leading-relaxed">{message.content}</p>;
  };

  return (
    <div className="space-y-4">
      {/* Messages Container */}
      <div className="h-96 overflow-y-auto rounded-ns-lg border border-ns-border bg-ns-bg p-4 space-y-3 scrollbar-thin scrollbar-thumb-ns-accent/30 scrollbar-track-transparent">
        {messages.length === 0 ? (
          <p className="text-center text-ns-ink-muted italic py-8">
            No messages yet. Start the conversation!
          </p>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.senderId === user?.uid ? "justify-end" : "justify-start"
              } animate-in slide-in-from-bottom-2 duration-300`}
            >
              <div
                className={`max-w-[75%] sm:max-w-[65%] p-3 rounded-ns-xl shadow-ns ${
                  message.senderId === user?.uid
                    ? "bg-ns-gradient text-white rounded-br-sm"
                    : "bg-ns-elevated text-ns-ink rounded-bl-sm"
                }`}
              >
                <p
                  className={`text-xs font-semibold mb-1 ${
                    message.senderId === user?.uid
                      ? "text-white/90"
                      : "text-ns-accent"
                  }`}
                >
                  {getMessageSender(message)}
                  {message.hasSpoiler && (
                    <span className="ml-2 text-yellow-500 dark:text-yellow-400">
                      <AlertTriangle size={12} className="inline" />
                    </span>
                  )}
                </p>
                {renderMessageContent(message)}
                <p
                  className={`text-xs mt-1 ${
                    message.senderId === user?.uid
                      ? "text-white/70"
                      : "text-ns-ink-secondary"
                  }`}
                >
                  {message.timestamp?.toDate().toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="space-y-2">
        {errorMessage && (
          <div className="p-3 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 rounded-ns text-sm">
            {errorMessage}
          </div>
        )}
        <form onSubmit={handleSendMessage} className="flex gap-2 sm:gap-3">
          <div className="flex-1 relative">
            <Input
              type="text"
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value);
                setErrorMessage(null);
              }}
              placeholder="Type your message..."
              maxLength={maxMessageLength}
              className="pr-14"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 font-ui text-[10px] text-ns-ink-muted pointer-events-none">
              {newMessage.length}/{maxMessageLength}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsSpoilerDialogOpen(true)}
            className="h-9 w-9 shrink-0 flex items-center justify-center rounded-ns border border-ns-accent/30 bg-ns-accent/10 text-ns-accent hover:bg-ns-accent/20 transition-colors"
            title="Add spoiler"
          >
            <AlertTriangle size={16} />
          </button>
          <Button
            type="submit"
            disabled={
              !newMessage.trim() || newMessage.length > maxMessageLength
            }
            className="gap-2"
          >
            <span className="hidden sm:inline">Send</span>
            <Send size={16} />
          </Button>
        </form>
      </div>

      {/* Spoiler Dialog */}
      <Dialog open={isSpoilerDialogOpen} onOpenChange={setIsSpoilerDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-ns-ink">
              <AlertTriangle className="text-ns-accent" size={20} />
              Add Spoiler Message
            </DialogTitle>
            <DialogDescription className="text-ns-ink-secondary">
              Tag your message with a chapter range to prevent spoilers for
              members who haven't reached that point yet
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {errorMessage && (
              <div className="p-3 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 rounded-ns text-sm">
                {errorMessage}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="spoilerContent" className="text-ns-ink">
                Message *
              </Label>
              <div className="relative">
                <textarea
                  id="spoilerContent"
                  value={spoilerContent}
                  onChange={(e) => {
                    setSpoilerContent(e.target.value);
                    setErrorMessage(null);
                  }}
                  maxLength={maxMessageLength}
                  className="w-full p-3 border border-ns-border rounded-ns bg-ns-surface text-ns-ink min-h-[100px] resize-none focus:outline-none focus:ring-2 focus:ring-ns-accent"
                  placeholder="Enter your spoiler message..."
                />
                <div className="absolute right-2 bottom-2 text-xs text-ns-ink-muted">
                  {spoilerContent.length}/{maxMessageLength}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startChapter" className="text-ns-ink">
                  Start Chapter *
                </Label>
                <Input
                  id="startChapter"
                  type="number"
                  min="1"
                  value={spoilerStartChapter}
                  onChange={(e) =>
                    setSpoilerStartChapter(
                      Math.max(1, parseInt(e.target.value) || 1),
                    )
                  }
                  className="bg-ns-surface text-ns-ink"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endChapter" className="text-ns-ink">
                  End Chapter (Optional)
                </Label>
                <Input
                  id="endChapter"
                  type="number"
                  min="1"
                  value={spoilerEndChapter || ""}
                  onChange={(e) =>
                    setSpoilerEndChapter(
                      e.target.value
                        ? Math.max(1, parseInt(e.target.value) || 1)
                        : undefined,
                    )
                  }
                  className="bg-ns-surface text-ns-ink"
                  placeholder="Leave empty for single chapter"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsSpoilerDialogOpen(false);
                setSpoilerContent("");
                setSpoilerStartChapter(1);
                setSpoilerEndChapter(undefined);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendSpoiler}
              disabled={
                !spoilerContent.trim() ||
                spoilerContent.length > maxMessageLength
              }
              className="bg-ns-accent text-white hover:opacity-90"
            >
              <AlertTriangle size={16} className="mr-2" />
              Send Spoiler
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BookClubChat;
