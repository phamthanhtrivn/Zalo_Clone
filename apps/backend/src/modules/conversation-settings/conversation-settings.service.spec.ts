import { Test, TestingModule } from '@nestjs/testing';
import { ConversationSettingsService } from './conversation-settings.service';

describe('ConversationSettingsService', () => {
  let service: ConversationSettingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ConversationSettingsService],
    }).compile();

    service = module.get<ConversationSettingsService>(
      ConversationSettingsService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
