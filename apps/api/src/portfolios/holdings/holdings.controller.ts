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

import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../auth/auth.types';
import { CreateHoldingDto } from './dto/create-holding.dto';
import { HoldingsService } from './holdings.service';
import type { HoldingResponse } from './holdings.types';

@Controller('portfolios/:portfolioId/holdings')
@UseGuards(JwtAuthGuard)
export class HoldingsController {
  constructor(private readonly holdingsService: HoldingsService) {}

  @Get()
  list(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('portfolioId', ParseUUIDPipe) portfolioId: string,
  ): Promise<HoldingResponse[]> {
    return this.holdingsService.listForUser(currentUser.id, portfolioId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('portfolioId', ParseUUIDPipe) portfolioId: string,
    @Body() dto: CreateHoldingDto,
  ): Promise<HoldingResponse> {
    return this.holdingsService.createForUser(currentUser.id, portfolioId, dto);
  }
}
