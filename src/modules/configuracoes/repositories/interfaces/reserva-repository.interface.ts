import { UpdateConfiguracaoDto } from "../../DTO/update-configuracoes.dto";

export interface IConfiguracoesRepository {
  findAll(): Promise<UpdateConfiguracaoDto>;
  updateConfiguracoes(): Promise<UpdateConfiguracaoDto>;
}