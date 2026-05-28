import { api } from "./api";

export const aiService = {
  translate: async (text: string, targetLanguage?: string) => {
    const response: any = await api.post("/ai/translate", {
      text,
      targetLanguage,
    });
    return response.data;
  },
};
