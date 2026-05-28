import { Controller, Post, Body } from '@nestjs/common';
import { AiService } from './ai.service';
import { Public } from 'src/common/decorator/is-public.decorator';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('seed')
  @Public()
  async seed(
    @Body() data: { title: string; content: string; category?: string }[],
  ) {
    await this.aiService.seedKnowledge(data);
    return { message: 'Bắt đầu quá trình nạp tri thức...' };
  }

  @Post('translate')
  async translate(
    @Body() body: { text: string; targetLanguage?: string },
  ) {
    const translatedText = await this.aiService.translateText(body.text, body.targetLanguage);
    return { translatedText };
  }
}
