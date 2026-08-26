import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import {
  CodigoAcesso,
  CodigoAcessoDocument,
} from 'src/schemas/codigo-acesso.schema';
import { ConfiguracoesService } from '../configuracoes/configuracoes.service';

// Nome usado para atribuir o código que já existia no banco antes dessa
// funcionalidade existir. Só é usado uma vez, na migração automática
// abaixo — depois disso o dono pode gerar um código novo pelo próprio
// painel e revogar este, se preferir.
const NOME_TITULAR_CODIGO_ORIGINAL = 'Admin Master';

@Injectable()
export class CodigosAcessoService {
  private readonly logger = new Logger(CodigosAcessoService.name);

  constructor(
    @InjectModel(CodigoAcesso.name)
    private readonly codigoAcessoModel: Model<CodigoAcessoDocument>,
    private readonly configuracoesService: ConfiguracoesService,
  ) {
    this.migrarCodigoOriginalSeNecessario();
  }

  // Roda toda vez que o app sobe; só faz alguma coisa na primeira vez (ou
  // em qualquer ambiente/banco onde essa coleção ainda esteja vazia).
  // Pega o hash do código único que já existia em Configuracao.adminAccessCode
  // e vira o primeiro CodigoAcesso, atribuído ao dono — sem precisar saber o
  // código em texto puro (só copia o hash) e sem exigir acesso manual ao banco.
  private async migrarCodigoOriginalSeNecessario(): Promise<void> {
    try {
      const existeAlgum = await this.codigoAcessoModel.exists({});
      if (existeAlgum) return;

      const config = await this.configuracoesService.findAll();
      if (!config?.adminAccessCode) return;

      await this.codigoAcessoModel.create({
        nome: NOME_TITULAR_CODIGO_ORIGINAL,
        codigoHash: config.adminAccessCode,
        ativo: true,
        criadoPorNome: 'Migração automática',
      });

      this.logger.log(
        `Código de acesso original migrado e atribuído a "${NOME_TITULAR_CODIGO_ORIGINAL}".`,
      );
    } catch (error) {
      this.logger.error(
        `Falha ao migrar código de acesso original: ${error.message}`,
      );
    }
  }

  // Compara o código informado contra todos os códigos ativos. São poucos
  // (um punhado de administradores, não milhares), então dá pra comparar um
  // por um com bcrypt sem preocupação de performance — e não dá pra fazer
  // busca direta por hash, já que bcrypt gera um hash diferente a cada vez
  // mesmo pro mesmo valor de entrada.
  async validarCodigo(codigo: string): Promise<CodigoAcessoDocument | null> {
    const codigosAtivos = await this.codigoAcessoModel.find({ ativo: true });

    for (const codigoAcesso of codigosAtivos) {
      const confere = await bcrypt.compare(codigo, codigoAcesso.codigoHash);
      if (confere) {
        codigoAcesso.ultimoUso = new Date();
        await codigoAcesso.save();
        return codigoAcesso;
      }
    }

    return null;
  }

  async listar(): Promise<Partial<CodigoAcesso>[]> {
    // codigoHash nunca sai daqui.
    return this.codigoAcessoModel
      .find({}, { codigoHash: 0 })
      .sort({ createdAt: -1 })
      .lean();
  }

  async criar(
    nome: string,
    criadoPorNome: string,
  ): Promise<{ id: string; nome: string; codigo: string }> {
    const codigo = this.gerarCodigoNumerico();
    const codigoHash = await bcrypt.hash(codigo, 10);

    const criado = await this.codigoAcessoModel.create({
      nome,
      codigoHash,
      ativo: true,
      criadoPorNome,
    });

    // O código em texto puro só existe aqui, no retorno desta chamada — não
    // fica salvo em lugar nenhum. Se a pessoa perder, só gerando outro.
    return { id: criado._id.toString(), nome: criado.nome, codigo };
  }

  async revogar(id: string, revogadoPorNome: string): Promise<void> {
    const codigo = await this.codigoAcessoModel.findById(id);
    if (!codigo || !codigo.ativo) return;

    const outrosAtivos = await this.codigoAcessoModel.countDocuments({
      ativo: true,
      _id: { $ne: id },
    });

    if (outrosAtivos === 0) {
      throw new BadRequestException(
        'Não é possível revogar o último código de acesso ativo. Isso bloquearia o acesso ao painel administrativo. Gere um novo código antes de revogar este.',
      );
    }

    codigo.ativo = false;
    codigo.revogadoEm = new Date();
    codigo.revogadoPorNome = revogadoPorNome;
    await codigo.save();
  }

  private gerarCodigoNumerico(): string {
    // 6 dígitos, gerado com CSPRNG (não Math.random). Combinado com o
    // rate-limit já aplicado nas rotas de auth, é uma margem razoável para
    // um código memorizável digitado manualmente.
    const numero = crypto.randomInt(0, 1_000_000);
    return numero.toString().padStart(6, '0');
  }
}
