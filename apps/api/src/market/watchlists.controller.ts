import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AddWatchlistItemDto } from './dto/market.dto';
import { WatchlistsService } from './watchlists.service';

@Controller('watchlists')
@UseGuards(JwtAuthGuard)
export class WatchlistsController {
  constructor(private readonly watchlistsService: WatchlistsService) {}

  @Get()
  list(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.watchlistsService.listForUser(currentUser.id);
  }

  @Post(':id/items')
  @HttpCode(HttpStatus.CREATED)
  addItem(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddWatchlistItemDto,
  ) {
    return this.watchlistsService.addItem(currentUser.id, id, dto.assetId);
  }

  @Delete(':id/items/:assetId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeItem(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('assetId', ParseUUIDPipe) assetId: string,
  ): Promise<void> {
    await this.watchlistsService.removeItem(currentUser.id, id, assetId);
  }
}
