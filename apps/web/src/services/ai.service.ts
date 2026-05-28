import { apiClient } from "./apiClient";

export const aiService = {
  translate: async (text: string, targetLanguage?: string) => {
    const response = await apiClient.post("/api/ai/translate", {
      text,
      targetLanguage,
    });
    return response.data;
  },
};
