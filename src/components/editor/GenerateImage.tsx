import { useState } from "react";
import api from "@/cloudFunctions";

const GenerateImage = () => {
  const [prompt, setprompt] = useState("");
  const [imageData, setImageData] = useState<string | null>(null);
  const handleGenerate = async () => {
    try {
      const response = await api.post<{ image: string }>("/generate", {
        prompt,
      });
      const imageData = response.data.image;
      setImageData(imageData);
      // Handle the response data as needed
    } catch (error) {
      console.error("Error generating text:", error);
    }
  };

  return (
    <div className="mb-4 flex items-center">
      <input
        type="text"
        value={prompt}
        onChange={(e) => setprompt(e.target.value)}
        placeholder="Enter Prompt"
        className="w-full p-2 px-5 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mr-4" // Add margin-right for spacing
      />
      {imageData && (
        <div className="mt-4">
          <h2 className="text-xl font-semibold mb-2">{prompt}</h2>
          <img
            src={`data:image/png;base64,${imageData}`}
            alt="Generated"
            className="border border-gray-300 rounded"
          />
        </div>
      )}
      <button
        onClick={() => handleGenerate()}
        className=" px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
      >
        Generate
      </button>
    </div>
  );
};

export default GenerateImage;
