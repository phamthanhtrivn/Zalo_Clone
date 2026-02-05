import { Test, TestingModule } from '@nestjs/testing';
import { ConversationSettingsController } from './conversation-settings.controller';

describe('ConversationSettingsController', () => {
  let controller: ConversationSettingsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConversationSettingsController],
    }).compile();

    controller = module.get<ConversationSettingsController>(
      ConversationSettingsController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
