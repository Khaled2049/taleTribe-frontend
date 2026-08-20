import React, { useState, useCallback, useRef, useEffect } from "react";
import api from "@/cloudFunctions";
import { useAuthContext } from "@/contexts/AuthContext";
import { rateLimitService } from "@/services/RateLimitService";

interface Book {
  id: string;
  volumeInfo: {
    title: string;
    authors?: string[];
    description?: string;
    imageLinks?: {
      thumbnail: string;
    };
  };
}

interface BookSearchProps {
  onBookSelect: (book: Book) => void;
}

const BookSearch: React.FC<BookSearchProps> = ({ onBookSelect }) => {
  const { user } = useAuthContext();
  const [query, setQuery] = useState("");
  const [books, setBooks] = useState<Book[]>([]);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const searchBooks = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setBooks([]);
      setError(null);
      return;
    }

    // Check rate limits if user is authenticated
    if (user) {
      const rateLimitCheck = await rateLimitService.canSearchBooks(user.uid);
      if (!rateLimitCheck.allowed) {
        setError(rateLimitCheck.message || "Rate limit exceeded");
        setBooks([]);
        return;
      }
    }

    try {
      setIsSearching(true);
      setError(null);
      const response = await api.get<{ error?: string; items?: Book[] }>(
        "/searchBooks",
        {
          params: {
            q: searchQuery,
            maxResults: 3,
          },
        },
      );

      // Check if response contains an error
      if (response.data.error) {
        setError(`Search error: ${response.data.error}`);
        setBooks([]);
        return;
      }

      // Google Books API returns { items: [...] }
      setBooks(response.data.items || []);

      // Increment search count if user is authenticated
      if (user) {
        await rateLimitService.incrementBookSearchCount(user.uid);
      }
    } catch (err: any) {
      console.error("Error fetching books:", err);

      // Provide detailed error messages
      if (err.response) {
        // Server responded with error status
        const errorMessage =
          err.response.data?.error ||
          err.response.statusText ||
          "Unknown error";
        const status = err.response.status;

        if (status === 500) {
          // Most likely BOOKS_API_KEY is not configured
          setError(
            errorMessage.includes("API key")
              ? errorMessage
              : "Server error: Books API key may not be configured. Please contact support.",
          );
        } else {
          setError(`Search failed: ${errorMessage} (Status: ${status})`);
        }
      } else if (err.request) {
        // Request was made but no response received
        setError(
          "Failed to connect to search service. Please check your connection.",
        );
      } else {
        // Something else happened
        setError(`Search error: ${err.message || "Unknown error"}`);
      }
      setBooks([]);
    } finally {
      setIsSearching(false);
    }
  };

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedSearch = useCallback((searchQuery: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      if (searchQuery) {
        searchBooks(searchQuery);
      } else {
        setBooks([]);
      }
    }, 300);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    debouncedSearch(newQuery);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (query) {
      searchBooks(query);
    }
  };

  const handleBookClick = (book: Book) => {
    setSelectedBook(book);
    onBookSelect(book);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="mb-4">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={query}
              onChange={handleInputChange}
              placeholder="Search for books..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-black dark:text-white rounded-lg focus:ring-2 focus:ring-dark-green dark:focus:ring-light-green focus:border-transparent transition-colors placeholder:text-gray-500 dark:placeholder:text-gray-400"
              disabled={isSearching}
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-dark-green dark:border-light-green border-t-transparent"></div>
              </div>
            )}
          </div>
        </div>
      </form>

      {error && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 rounded-lg text-sm">
          {error}
        </div>
      )}

      {selectedBook ? (
        <div className="p-4 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-lg">
          <h3 className="font-bold text-black dark:text-white">
            {selectedBook.volumeInfo.title}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {selectedBook.volumeInfo.authors?.join(", ") || "Unknown Author"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {books.map((book) => (
            <div
              key={book.id}
              className="flex items-center gap-4 p-4 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-lg cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => handleBookClick(book)}
            >
              {book.volumeInfo.imageLinks?.thumbnail && (
                <img
                  src={book.volumeInfo.imageLinks.thumbnail}
                  alt={`${book.volumeInfo.title} cover`}
                  className="w-16 h-24 object-cover"
                />
              )}
              <div>
                <h3 className="font-bold text-black dark:text-white">
                  {book.volumeInfo.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {book.volumeInfo.authors?.join(", ") || "Unknown Author"}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BookSearch;
