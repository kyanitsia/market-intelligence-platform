import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';

import type { AuthenticatedUser } from '../../auth/auth.types';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SellHoldingDto } from './dto/sell-holding.dto';
import { TransactionsService } from './transactions.service';
import type { SellResponse, TransactionResponse } from './transactions.types';

@Controller('portfolios/:portfolioId')
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get('transactions')
  list(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('portfolioId', ParseUUIDPipe) portfolioId: string,
  ): Promise<TransactionResponse[]> {
    return this.transactionsService.listForUser(currentUser.id, portfolioId);
  }

  @Post('holdings/:holdingId/sell')
  @HttpCode(HttpStatus.CREATED)
  sell(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('portfolioId', ParseUUIDPipe) portfolioId: string,
    @Param('holdingId', ParseUUIDPipe) holdingId: string,
    @Body() dto: SellHoldingDto,
  ): Promise<SellResponse> {
    return this.transactionsService.sellForUser(
      currentUser.id,
      portfolioId,
      holdingId,
      dto,
    );
  }
}
