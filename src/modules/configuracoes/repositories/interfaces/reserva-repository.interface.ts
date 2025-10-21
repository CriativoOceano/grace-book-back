import { UpdateConfiguracaoDto } from "../../DTO/update-configuracoes.dto";
import { ConteudoSiteDto } from "../../DTO/update-conteudo-site.dto";
import { Configuracao } from "../../../../schemas/config.schema";

export interface IConfiguracoesRepository {
  findAll(): Promise<Configuracao>;
  getConteudoSite(): Promise<ConteudoSiteDto>;
  updateConfiguracoes(updateConfiguracaoDto: UpdateConfiguracaoDto): Promise<Configuracao>;
  updateConteudoSite(conteudoSite: ConteudoSiteDto): Promise<ConteudoSiteDto>;
}