import { Navigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuthContext } from "../contexts/AuthContext";
import { storyWorkspaceRepo } from "@novelsync/story-data-client";
import Story from "./Story/Story";

const PrivateRoute = () => {
  const { user } = useAuthContext();
  const { storyId } = useParams();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkOwnership = async () => {
      if (!user || !storyId) {
        setIsAuthorized(false);
        setLoading(false);
        return;
      }

      // Fetch the story by ID
      const story = await getStoryById(storyId);

      if (story) {
        // Check if the story creator ID matches the logged-in user

        if (story.userId === user.uid) {
          setIsAuthorized(true);
        } else {
          setIsAuthorized(false);
        }
      } else {
        setIsAuthorized(false);
      }

      setLoading(false);
    };

    checkOwnership();
  }, [user, storyId]);

  const getStoryById = async (storyId: string) => {
    try {
      const storyData = await storyWorkspaceRepo.getStory(storyId);
      return storyData;
    } catch (error) {
      console.error("Error fetching story:", error);
      return null;
    }
  };

  if (loading) {
    return <div>Loading...</div>; // Optionally show a loader
  }

  return isAuthorized ? <Story /> : <Navigate to="/user-stories" />;
};

export default PrivateRoute;
