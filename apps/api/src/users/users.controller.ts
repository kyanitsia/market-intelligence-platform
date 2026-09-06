import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser, PublicUser } from '../auth/auth.types';
import { UpdateMeDto } from './dto/update-me.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  findMe(@CurrentUser() currentUser: AuthenticatedUser): Promise<PublicUser> {
    return this.usersService.findMe(currentUser.id);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateMe(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: UpdateMeDto,
  ): Promise<PublicUser> {
    return this.usersService.updateMe(currentUser.id, dto);
  }
}
