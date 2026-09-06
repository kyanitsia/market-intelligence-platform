import { Module, forwardRef } from '@nestjs/common';

import { AuthModule } from '../../auth/auth.module';
import { HoldingsController } from './holdings.controller';
import { HoldingsService } from './holdings.service';

@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [HoldingsController],
  providers: [HoldingsService],
})
export class HoldingsModule {}
