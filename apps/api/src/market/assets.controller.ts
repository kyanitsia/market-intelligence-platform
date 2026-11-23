import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AssetsService } from './assets.service';
import { parseChartRange } from './dto/market.dto';

@Controller('assets')
@UseGuards(JwtAuthGuard)
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Get('search')
  search(@Query('q') query = '') {
    return this.assetsService.search(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.assetsService.findOne(id);
  }

  @Get(':id/stats')
  stats(@Param('id', ParseUUIDPipe) id: string) {
    return this.assetsService.stats(id);
  }

  @Get(':id/prices')
  prices(@Param('id', ParseUUIDPipe) id: string, @Query('range') range?: string) {
    return this.assetsService.history(id, parseChartRange(range));
  }
}
