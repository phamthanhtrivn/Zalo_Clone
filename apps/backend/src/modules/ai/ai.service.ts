import {
  BadGatewayException,
  forwardRef,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { ChatGateway } from '../chat/chat.gateway';
import { Knowledge } from './schema/knowledge.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class AiService {
  private openai: OpenAI;

  constructor(
    private configService: ConfigService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
    @InjectModel(Knowledge.name) private knowledgeModel: Model<Knowledge>,
  ) {
    this.openai = new OpenAI({
      apiKey: this.configService.get('ai.api_key'),
      baseURL: this.configService.get('ai.base_url'),
      // Mấy cái này OpenRouter nó bắt buộc để định danh app
      defaultHeaders: {
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Zola Zola', //
      },
    });
  }

  async chatStreamAndEmit(
    prompt: string,
    targetId: string,
    history?: { role: 'user' | 'assistant'; content: string }[],
  ): Promise<string> {
    try {
      const stream = await this.chatStream(prompt, history);

      let fullResponse = '';
      let isFirstChunk = true;

      for await (const chunk of stream) {
        const contentChunk = chunk.choices[0]?.delta?.content || '';
        if (!contentChunk) continue;

        if (isFirstChunk) {
          await this.chatGateway.emitAiStatus(targetId, 'typing');
          isFirstChunk = false;
        }

        fullResponse += contentChunk;
        //gửi từng đoạn tin nhắn của AI xuống fe để stream ra.
        await this.chatGateway.emitAiChunk(targetId, contentChunk, false);
      }
      //gửi sự kiện kết thúc
      await this.chatGateway.emitAiChunk(targetId, '', true);
      return fullResponse;
    } catch (error) {
      console.error('Lỗi AiService:', error);
      await this.chatGateway.emitAiStatus(targetId, null);
      throw error;
    }
  }

  async chatStream(
    prompt: string,
    history?: { role: 'user' | 'assistant'; content: string }[],
  ) {
    try {
      return await this.openai.chat.completions.create({
        model: this.configService.get<string>('ai.model')!,
        temperature: 0.4,
        max_tokens: 600,
        messages: [
          {
            role: 'system',
            content: `Bạn là Zola AI - trợ lý thông minh và thân thiện trong ứng dụng Zola. 
            Nhiệm vụ của bạn là hỗ trợ người dùng dựa trên các thông tin hệ thống được cung cấp.
            - Nếu thông tin được cung cấp có câu trả lời, hãy trả lời dựa trên đó một cách tự nhiên.
            - Nếu không có trong tài liệu, hãy dùng kiến thức chung của bạn nhưng vẫn giữ giọng điệu bạn bè.
            - Tuyệt đối không dùng bảng biểu, hãy dùng văn bản trôi chảy.
            - Xưng hô gần gũi (mình - bạn, hoặc cậu - tớ).`,
          },
          ...(history?.length ? history : []),
          { role: 'user', content: prompt },
        ],
        stream: true,
      });
    } catch (error) {
      console.error('Lỗi stream:', error);
      throw new BadGatewayException('Máy chủ Ai tạm thời không thể truy cập.');
    }
  }

  async getEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: this.configService.get<string>('ai.embeddingModel')!,
        input: text,
        encoding_format: 'float',
      });
      return response.data[0].embedding;
    } catch (error) {
      console.error('Lỗi lấy Embedding:', error);
      throw new Error('Không thể tạo Vector cho văn bản');
    }
  }

  async findRelevantContext(query: string): Promise<string> {
    const queryVector = await this.getEmbedding(query);

    const result = await this.knowledgeModel.aggregate([
      {
        $vectorSearch: {
          index: 'knowledge_index',
          path: 'embedding',
          queryVector: queryVector,
          numCandidates: 100,
          limit: 3,
        },
      },
      {
        $project: {
          content: 1,
          score: { $meta: 'vectorSearchScore' },
        },
      },
    ] as any);

    return result.map((doc) => doc.content).join('\n\n');
  }

  async translateText(
    text: string,
    targetLanguage = 'Vietnamese',
  ): Promise<string> {
    try {
      const response = await this.openai.chat.completions.create({
        model: this.configService.get<string>('ai.model')!,
        temperature: 0.3,
        max_tokens: 500,
        messages: [
          {
            role: 'system',
            content: `You are an expert translator. Translate the user's chat message.
            - If targetLanguage is "Vietnamese", determine the source language of the text. If it is NOT Vietnamese, translate it to Vietnamese. If it is ALREADY Vietnamese, translate it to English.
            - Keep the translation natural and matching the context of a casual chat message.
            - Retain emojis, slang, and text formatting (like newlines) if appropriate.
            - Output ONLY the translated text, do not include any quotes, markdown styling around the whole response, explanation, or notes.`,
          },
          {
            role: 'user',
            content: `targetLanguage: ${targetLanguage}\n\ntext: ${text}`,
          },
        ],
      });
      return response.choices[0]?.message?.content?.trim() || '';
    } catch (error) {
      console.error('Lỗi dịch thuật:', error);
      throw new BadGatewayException('Không thể kết nối máy chủ AI để dịch thuật.');
    }
  }

  async seedKnowledge(
    data: { title: string; content: string; category?: string }[],
  ) {
    for (const item of data) {
      // 1. Tạo vector từ nội dung
      const vector = await this.getEmbedding(item.content);

      // 2. Lưu vào DB
      await this.knowledgeModel.create({
        title: item.title,
        content: item.content,
        embedding: vector, // Đây là thứ để MongoDB Vector Search tìm kiếm
        category: item.category || 'zalo_doc',
      });
    }
    console.log('Đã nạp xong tri thức cho Zola!');
  }
}
