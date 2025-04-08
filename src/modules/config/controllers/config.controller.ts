import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ConfiguracoesService } from '../config.service';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { AdminGuard } from 'src/modules/auth/guards/admin.guard';
import { UpdateConfiguracaoDto } from '../DTO/update-config.dto';

@Controller('configuracoes')
export class ConfiguracoesController {
  constructor(private readonly configuracoesService: ConfiguracoesService) {}

  @Get()
  findAll() {
    return this.configuracoesService.findAll();
  }

  @Patch()
  @UseGuards(JwtAuthGuard, AdminGuard)
  update(@Body() updateConfiguracaoDto: UpdateConfiguracaoDto) {
    return this.configuracoesService.update(updateConfiguracaoDto);
  }
}