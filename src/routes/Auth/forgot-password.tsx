import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import { useState } from "react";
import { Link } from "react-router-dom";
import { APP_NAME } from "@/config/seo";
import { SEOHead } from "@/components/seo/SEOHead";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  const { forgotPassword } = useFirebaseAuth();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setMessage("");

    if (!email) {
      setError("Please enter your email address.");
      setIsLoading(false);
      return;
    }

    await forgotPassword(email);

    // Here you would add your password reset logic, such as calling an API
    // For now, we'll simulate a delay
    setTimeout(() => {
      setIsLoading(false);
      setMessage(
        "If this email is registered, you will receive a password reset link.",
      );
    }, 2000);
  };

  return (
    <div className="flex flex-col items-center justify-start min-h-screen  dark:bg-black text-black dark:text-white pt-12 transition-colors duration-300">
      <SEOHead
        title={`Forgot Password - ${APP_NAME}`}
        url="/forgot-password"
        noindex={true}
        nofollow={true}
      />
      <div className="flex items-center text-center mb-8 -ml-6">
        <h1 className="text-4xl font-serif text-dark-green dark:text-light-green ml-4 transition-colors duration-300">
          {APP_NAME}
        </h1>
      </div>

      <div className="w-full max-w-md p-8  dark:bg-black rounded-lg shadow-lg border border-black dark:border-white transition-colors duration-300">
        <h2 className="text-3xl font-serif text-black dark:text-white mb-6 transition-colors duration-300">
          Forgot Password
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-black dark:text-white/70 transition-colors duration-300"
            >
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 block w-full px-3 py-2 border border-black/20 dark:border-white/20 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-dark-green dark:focus:ring-light-green focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-black transition-colors duration-300 sm:text-sm"
            />
          </div>

          {error && <div className="text-red-500 text-sm mt-2">{error}</div>}
          {message && (
            <div className="text-dark-green dark:text-light-green text-sm mt-2">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full bg-dark-green dark:bg-light-green text-white py-2 px-4 rounded-md shadow-sm hover:bg-light-green dark:hover:bg-dark-green focus:outline-none focus:ring-2 focus:ring-dark-green dark:focus:ring-light-green focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-black transition-all duration-300 ${
              isLoading ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            {isLoading ? "Sending..." : "Send Reset Link"}
          </button>

          <div className="text-center mt-4">
            <Link
              to="/sign-in"
              className="text-dark-green dark:text-light-green hover:text-light-green dark:hover:text-dark-green transition-colors duration-200"
            >
              Back to Sign In
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ForgotPassword;
