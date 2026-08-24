import { Module } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { QuotationsService } from './quotations.service';
import { ReceiptsService } from './receipts.service';
import { FinanceController } from './finance.controller';
import { PresenceModule } from '../presence/presence.module';

@Module({
  imports: [PresenceModule],
  controllers: [FinanceController],
  providers: [FinanceService, QuotationsService, ReceiptsService],
  exports: [FinanceService, QuotationsService, ReceiptsService],
})
export class FinanceModule {}
