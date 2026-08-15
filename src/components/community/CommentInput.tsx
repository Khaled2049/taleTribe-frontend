import { IUser } from "@/types/IUser";
import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";

interface CommentInputProps {
  currentUser: IUser;
  onSubmit: (message: string) => Promise<void>;
}

export const CommentInput: React.FC<CommentInputProps> = ({
  currentUser,
  onSubmit,
}) => {
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !message.trim()) return;

    try {
      await onSubmit(message.trim());
      setMessage("");
    } catch (error) {
      console.error("Error adding comment:", error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mb-6 p-4 bg-opacity-50 w-full">
      <Textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={
          currentUser ? "Add a comment..." : "Please login to comment"
        }
        disabled={!currentUser}
        className={`w-full p-3 rounded-lg border transition-all duration-200 resize-none
      bg-white dark:bg-gray-900 
      border-gray-300 dark:border-gray-700 
      text-gray-900 dark:text-gray-200
      placeholder:text-gray-500 dark:placeholder:text-gray-400
      focus:outline-none focus:ring-2 
      focus:ring-dark-green dark:focus:ring-light-green
      disabled:bg-gray-100 dark:disabled:bg-gray-800 
      disabled:cursor-not-allowed
    `}
        rows={3}
      />
      {currentUser && (
        <Button
          type="submit"
          disabled={!message.trim()}
          className={`mt-3 w-full py-2 text-lg font-medium flex items-center justify-center gap-2 transition-all duration-200 
        ${
          !message.trim()
            ? "bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
            : "bg-dark-green dark:bg-light-green text-white dark:text-black hover:bg-light-green dark:hover:bg-dark-green"
        }`}
        >
          <Send className="w-5 h-5" /> Post Comment
        </Button>
      )}
    </form>
  );
};
