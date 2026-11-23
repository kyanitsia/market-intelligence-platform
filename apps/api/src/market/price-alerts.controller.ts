import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreatePriceAlertDto, UpdatePriceAlertDto } from './dto/market.dto';
import { PriceAlertsService } from './price-alerts.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class PriceAlertsController {
  constructor(private readonly priceAlertsService: PriceAlertsService) {}

  @Get('alerts/price')
  list(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.priceAlertsService.list(currentUser.id);
  }

  @Post('alerts/price')
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: CreatePriceAlertDto,
  ) {
    return this.priceAlertsService.create(currentUser.id, dto);
  }

  @Patch('alerts/price/:id')
  update(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePriceAlertDto,
  ) {
    return this.priceAlertsService.update(currentUser.id, id, dto);
  }

  @Delete('alerts/price/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.priceAlertsService.remove(currentUser.id, id);
  }

  @Get('notifications')
  notifications(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.priceAlertsService.listNotifications(currentUser.id);
  }

  @Patch('notifications/:id')
  async markRead(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.priceAlertsService.markRead(currentUser.id, id);
  }
}
