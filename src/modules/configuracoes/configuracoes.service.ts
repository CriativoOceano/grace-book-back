import { Injectable, Logger, NotFoundException, Inject } from '@nestjs/common';
import { ConfiguracoesRepository, CONFIGURACOES_REPOSITORY } from './repositories/configuracoes.repository';

@Injectable()
export class ConfiguracoesService {
  private readonly logger = new Logger(ConfiguracoesService.name);

  constructor(
    @Inject(CONFIGURACOES_REPOSITORY)
    private readonly configuracoesRepository: ConfiguracoesRepository
  ) {}

  async findAll() {
    return this.configuracoesRepository.findAll();
  }
}