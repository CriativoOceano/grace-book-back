import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateReservaDto } from './DTO/create-reserva.dto';
import { UsuariosService } from '../usuarios/usuarios.service';
import { VerificarDisponibilidadeDto } from './DTO/verificar-disponibilidade.dto';
import { Reserva, ReservaModel } from 'src/schemas/reserva.schema';
import { ReservaProcessoService } from 'src/modules/shared/services/reservaProcesso/reserva-processo.service';
import { StatusReserva, TipoReserva } from './reserva.enums';
import { EmailsService } from '../emails/email.service';
import { CalculoReservaService } from '../shared/services/reservaProcesso/calcular-reserva.service';
import { CONFIGURACOES_REPOSITORY } from '../configuracoes/repositories/configuracaoes-repository.provider';
import { IConfiguracoesRepository } from '../configuracoes/repositories/interfaces/reserva-repository.interface';
import { ReservaEmailData } from '../emails/templates/reserva-confirmacao.template';
import { Inject } from '@nestjs/common';
import { DisponibilidadeService } from '../disponibilidade/disponibilidade.service';
import { PagamentosService } from '../pagamentos/pagamentos.service';
import { StatusPagamento } from '../pagamentos/pagamento.enums';

@Injectable()
export class ReservasService {
  private readonly logger = new Logger(ReservasService.name);

  constructor(
    @InjectModel(Reserva.name) private readonly reservaModel: ReservaModel,
    private readonly usuariosService: UsuariosService,
    private readonly emailsService: EmailsService,
    private readonly reservaProcessoService: ReservaProcessoService,
    private readonly calculoReservaService: CalculoReservaService,
    private readonly disponibilidadeService: DisponibilidadeService,
    private readonly pagamentosService: PagamentosService,
    @Inject(CONFIGURACOES_REPOSITORY)
    private readonly configuracoesRepository: IConfiguracoesRepository,
  ) {}

  /**
   * Executa operações de criação de reserva com transação para garantir consistência
   */
  private async executeWithTransaction<T>(
    operation: (session: any) => Promise<T>,
  ): Promise<T> {
    const session = await this.reservaModel.db.startSession();

    try {
      let result: T;
      await session.withTransaction(async () => {
        result = await operation(session);
      });
      return result;
    } catch (error) {
      this.logger.error(`❌ Erro na transação:`);
      this.logger.error(`❌ Tipo do erro: ${error.constructor.name}`);
      this.logger.error(`❌ Mensagem: ${error.message}`);
      this.logger.error(`❌ Stack trace: ${error.stack}`);

      // Log específico para erros de email
      if (error.message.includes('Falha ao enviar email')) {
        this.logger.error(`❌ ERRO DE EMAIL detectado na transação`);
        this.logger.error(`❌ Verificar configurações de SMTP e conectividade`);
      }

      // Log específico para erros de pagamento
      if (
        error.message.includes('Erro ao criar cobrança') ||
        error.message.includes('ASAAS')
      ) {
        this.logger.error(`❌ ERRO DE PAGAMENTO detectado na transação`);
        this.logger.error(
          `❌ Verificar conectividade com ASAAS e configurações de API`,
        );
      }

      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * 🔍 VALIDAÇÃO DE CÁLCULO E DISPONIBILIDADE ANTES DE SALVAR
   * Valida apenas cálculo e disponibilidade antes de criar reserva ou pagamento
   */
  private async validarReservaCompleta(
    createReservaDto: CreateReservaDto,
    userId: string,
  ): Promise<void> {
    this.logger.log(`🔍 Iniciando validação de cálculo e disponibilidade`);

    try {
      // 1. VALIDAR E RECALCULAR DADOS DO FRONTEND
      const { dadosValidados } = await this.validarERecalcularDadosFrontend(
        createReservaDto,
        userId,
      );

      // 2. VALIDAR CÁLCULO DE VALORES
      const valorCalculadoBackend =
        await this.calculoReservaService.getValorReserva(dadosValidados);

      // Comparar com o valor enviado pelo frontend
      const valorFrontend = createReservaDto.dadosPagamento?.valorTotal || 0;
      const diferencaPercentual =
        (Math.abs(valorCalculadoBackend.valorTotal - valorFrontend) /
          valorFrontend) *
        100;

      if (diferencaPercentual > 5) {
        // Tolerância de 5%
        this.logger.error(
          `❌ Diferença significativa no cálculo: Frontend=${valorFrontend}, Backend=${valorCalculadoBackend.valorTotal}`,
        );
        throw new BadRequestException(
          `Valor calculado incorretamente. Valor esperado: R$ ${valorCalculadoBackend.valorTotal.toFixed(2)}. ` +
            `Recarregue a página e tente novamente.`,
        );
      }

      // 3. VALIDAR DISPONIBILIDADE
      const disponibilidade = await this.verificarDisponibilidade({
        dataInicio: dadosValidados.dataInicio,
        dataFim: dadosValidados.dataFim,
        tipo: dadosValidados.tipo,
        quantidadeChales: dadosValidados.quantidadeChales,
      });

      if (!disponibilidade) {
        this.logger.error(
          `❌ Indisponibilidade detectada para: ${JSON.stringify({
            dataInicio: dadosValidados.dataInicio,
            dataFim: dadosValidados.dataFim,
            tipo: dadosValidados.tipo,
            quantidadeChales: dadosValidados.quantidadeChales,
          })}`,
        );

        // Mensagens específicas para cada caso de indisponibilidade
        const dataInicio = new Date(dadosValidados.dataInicio);
        const dataFim = new Date(dadosValidados.dataFim);
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        if (dataInicio < hoje) {
          throw new BadRequestException(
            'Não é possível fazer reservas para datas passadas.',
          );
        }

        if (dataInicio.getTime() === dataFim.getTime()) {
          throw new BadRequestException(
            'A data de início deve ser diferente da data de fim.',
          );
        }

        if (dadosValidados.quantidadeChales > 0) {
          throw new BadRequestException(
            `Não há chalés disponíveis para o período selecionado. ` +
              `Tente selecionar um período diferente ou reduzir a quantidade de chalés.`,
          );
        }

        throw new BadRequestException(
          `Não há disponibilidade para o período selecionado (${dataInicio.toLocaleDateString('pt-BR')} a ${dataFim.toLocaleDateString('pt-BR')}). ` +
            `Tente selecionar outro período.`,
        );
      }

      this.logger.log(`✅ Validação de cálculo e disponibilidade bem-sucedida`);
    } catch (error) {
      this.logger.error(`❌ Falha na validação: ${error.message}`);
      throw error; // Re-throw para manter a mensagem original
    }
  }

  async create(
    createReservaDto: CreateReservaDto,
    userId: string,
  ): Promise<{ reserva: Reserva; pagamento: any }> {
    // 🔍 VALIDAÇÃO DE CÁLCULO E DISPONIBILIDADE ANTES DE SALVAR
    await this.validarReservaCompleta(createReservaDto, userId);

    return this.executeWithTransaction(async (session) => {
      // 🔒 VALIDAÇÃO DE SEGURANÇA: Validar e recalcular dados do frontend
      const { dadosValidados, alertasSeguranca } =
        await this.validarERecalcularDadosFrontend(createReservaDto, userId);

      // Se houver alertas de segurança críticos, registrar mas continuar
      if (alertasSeguranca.length > 0) {
        this.logger.warn(
          `🚨 ${alertasSeguranca.length} alerta(s) de segurança detectado(s) para usuário ${userId}`,
        );
      }

      // Buscar usuário
      const usuario = await this.usuariosService.findById(userId);
      if (!usuario) {
        throw new NotFoundException('Usuário não encontrado');
      }

      // ✅ Validação de cálculo e disponibilidade já foi feita
      this.logger.log(
        `✅ Validações de cálculo e disponibilidade já realizadas, prosseguindo com criação da reserva`,
      );

      // Gerar código único para a reserva
      const codigo = await this.reservaModel.gerarCodigoReserva();

      // Gerar código de acesso
      const codigoAcesso = this.reservaModel.gerarCodigoAcesso();

      // ✅ Usar dados validados pelo backend (não os do frontend)
      this.logger.log(
        `🔒 Usando dados validados pelo backend - Quantidade de diárias: ${dadosValidados.quantidadeDiarias}`,
      );

      // Calcular valor da reserva usando dados validados
      const valorTotaldaReserva =
        await this.calculoReservaService.getValorReserva(dadosValidados);

      // Criar reserva com dados validados
      const novaReserva = {
        codigo,
        codigoAcesso,
        usuario: usuario,
        usuarioEmail: usuario.email,
        usuarioNome: usuario.nome,
        tipo: dadosValidados.tipo,
        dataInicio: dadosValidados.dataInicio,
        dataFim: dadosValidados.dataFim || dadosValidados.dataInicio,
        quantidadePessoas: dadosValidados.quantidadePessoas, // ✅ Validado pelo backend
        quantidadeChales: dadosValidados.quantidadeChales, // ✅ Validado pelo backend
        quantidadeDiarias: dadosValidados.quantidadeDiarias, // ✅ Recalculado pelo backend
        observacoes: dadosValidados.observacoes,
        historico: [
          {
            data: new Date(),
            acao: 'Reserva criada',
            detalhes:
              alertasSeguranca.length > 0
                ? `Aguardando pagamento (${alertasSeguranca.length} alerta(s) de segurança)`
                : 'Aguardando pagamento',
          },
        ],
        valorTotal: valorTotaldaReserva.valorTotal,
        dadosPagamento: dadosValidados.dadosPagamento,
        dadosHospede: dadosValidados.dadosHospede,
        dataCriacao: new Date(),
        dataAtualizacao: new Date(),
      };

      const reservaCriada =
        await this.reservaProcessoService.processarNovaReserva(
          novaReserva,
          session,
        );

      const reserva = reservaCriada.reserva;
      const pagamento = reservaCriada.pagamento;

      // Enviar email de confirmação da reserva criada
      try {
        const emailData: ReservaEmailData = {
          nome: reserva.usuarioNome,
          codigoReserva: reserva.codigo,
          dataInicio: reserva.dataInicio.toLocaleDateString('pt-BR'),
          dataFim: reserva.dataFim.toLocaleDateString('pt-BR'),
          tipo: reserva.tipo,
          quantidadePessoas: reserva.quantidadePessoas,
          quantidadeChales: reserva.quantidadeChales,
          quantidadeDiarias: reserva.quantidadeDiarias,
          valorTotal: reserva.valorTotal,
          statusReserva: reserva.statusReserva,
          codigoAcesso: reserva.codigoAcesso,
          linkPagamento: pagamento?.linkPagamento,
          observacoes: reserva.observacoes,
          dadosHospede: reserva.dadosHospede,
        };

        await this.emailsService.enviarEmailReservaCriada(
          emailData,
          pagamento?.linkPagamento,
        );
        this.logger.log(
          `✅ Email de confirmação enviado para ${reserva.usuarioEmail}`,
        );
      } catch (emailError) {
        this.logger.error(`❌ Erro ao enviar email: ${emailError.message}`);
        // Não falhar a criação da reserva por erro de email
      }

      return { reserva, pagamento };
    });
  }

  async createPublico(
    createReservaDto: CreateReservaDto,
  ): Promise<{ reserva: Reserva; pagamento: any }> {
    return this.executeWithTransaction(async (session) => {
      // 🔍 DEBUG: Log dos dados recebidos
      this.logger.log(`🔍 DEBUG - Dados recebidos do frontend:`);
      this.logger.log(
        `📦 createReservaDto: ${JSON.stringify(createReservaDto, null, 2)}`,
      );
      this.logger.log(
        `📦 dadosHospede: ${JSON.stringify(createReservaDto.dadosHospede, null, 2)}`,
      );

      // Validar dados obrigatórios do hóspede
      if (
        !createReservaDto.dadosHospede?.email ||
        !createReservaDto.dadosHospede?.cpf
      ) {
        this.logger.error(`❌ Dados obrigatórios ausentes:`);
        this.logger.error(
          `📧 Email: ${createReservaDto.dadosHospede?.email || 'AUSENTE'}`,
        );
        this.logger.error(
          `🆔 CPF: ${createReservaDto.dadosHospede?.cpf || 'AUSENTE'}`,
        );
        throw new BadRequestException(
          'Email e CPF são obrigatórios para criar uma reserva pública',
        );
      }

      // Criar usuário automaticamente com base nos dados do hóspede
      const usuario = await this.usuariosService.createFromBookingData({
        nome: createReservaDto.dadosHospede.nome || 'Usuário',
        sobrenome: createReservaDto.dadosHospede.sobrenome || '',
        email: createReservaDto.dadosHospede.email,
        cpf: createReservaDto.dadosHospede.cpf,
        telefone: createReservaDto.dadosHospede.telefone || '',
        senha: this.generateRandomPassword(), // Senha temporária
        isAdmin: false,
      });

      // Usar o método create normal com o usuário criado
      return this.create(createReservaDto, (usuario as any)._id.toString());
    });
  }

  private generateRandomPassword(): string {
    // Gerar senha temporária que será alterada no primeiro login
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }

  async verificarDisponibilidade(
    disponibilidadeDTO: VerificarDisponibilidadeDto,
  ): Promise<boolean> {
    this.logger.log(
      `DEBUG: Verificando disponibilidade para: ${JSON.stringify(disponibilidadeDTO)}`,
    );

    // Para facilitar a comparação, vamos trabalhar só com as datas (sem horas)
    const inicioAjustado = new Date(disponibilidadeDTO.dataInicio);
    inicioAjustado.setHours(0, 0, 0, 0);

    const fimAjustado = new Date(disponibilidadeDTO.dataFim);
    fimAjustado.setHours(23, 59, 59, 999);

    this.logger.log(
      `DEBUG: Datas ajustadas - Início: ${inicioAjustado.toISOString()}, Fim: ${fimAjustado.toISOString()}`,
    );

    // Verificar bloqueios administrativos dia a dia (painel de disponibilidade)
    const diaAdmin = new Date(inicioAjustado);
    diaAdmin.setHours(0, 0, 0, 0);
    const ultimoDiaAdmin = new Date(fimAjustado);
    ultimoDiaAdmin.setHours(0, 0, 0, 0);
    while (diaAdmin <= ultimoDiaAdmin) {
      const disponivelAdmin =
        await this.disponibilidadeService.verificarDisponibilidade(
          new Date(diaAdmin),
          disponibilidadeDTO.tipo,
          disponibilidadeDTO.quantidadeChales,
        );
      if (!disponivelAdmin) {
        this.logger.log(
          `DEBUG: Data ${diaAdmin.toISOString()} bloqueada pelo administrador`,
        );
        return false;
      }
      diaAdmin.setDate(diaAdmin.getDate() + 1);
    }

    // Critérios de busca base - períodos que se sobrepõem
    const filtroBase = {
      $or: [
        // Caso 1: A data de início da nova reserva está entre o início e fim de uma reserva existente
        {
          dataInicio: { $lte: inicioAjustado },
          dataFim: { $gte: inicioAjustado },
        },
        // Caso 2: A data de fim da nova reserva está entre o início e fim de uma reserva existente
        {
          dataInicio: { $lte: fimAjustado },
          dataFim: { $gte: fimAjustado },
        },
        // Caso 3: A nova reserva engloba completamente uma reserva existente
        {
          dataInicio: { $gte: inicioAjustado },
          dataFim: { $lte: fimAjustado },
        },
      ],
      // Considerar apenas reservas não canceladas
      statusReserva: { $ne: StatusReserva.CANCELADA },
    };

    switch (disponibilidadeDTO.tipo) {
      case TipoReserva.BATISMO:
        this.logger.log(`DEBUG: Verificando disponibilidade para BATISMO`);

        // Para batismo, não pode haver outro batismo no mesmo dia
        const reservasBatismo = await this.reservaModel.find({
          ...filtroBase,
          tipo: TipoReserva.BATISMO,
        });

        this.logger.log(
          `DEBUG: Reservas de batismo encontradas: ${reservasBatismo.length}`,
        );

        if (reservasBatismo.length > 0) {
          this.logger.log(
            `DEBUG: Batismo indisponível - já existe reserva de batismo no período`,
          );
          return false; // Já existe batismo para o período
        }

        // Verificar se há diárias no período (que impedem o batismo)
        const diariasNoPeriodoBatismo = await this.reservaModel.find({
          ...filtroBase,
          tipo: TipoReserva.DIARIA,
        });

        this.logger.log(
          `DEBUG: Diárias encontradas no período: ${diariasNoPeriodoBatismo.length}`,
        );

        if (diariasNoPeriodoBatismo.length > 0) {
          this.logger.log(
            `DEBUG: Batismo indisponível - há diárias no período`,
          );
          return false; // Há diárias que impedem o batismo
        }

        this.logger.log(`DEBUG: Batismo disponível`);
        return true;

      case TipoReserva.DIARIA:
        this.logger.log(`DEBUG: Verificando disponibilidade para DIARIA`);

        // Verificar se há batismos no período (que impedem diárias)
        const batismosNoPeriodo = await this.reservaModel.find({
          ...filtroBase,
          tipo: TipoReserva.BATISMO,
        });

        this.logger.log(
          `DEBUG: Batismos encontrados no período: ${batismosNoPeriodo.length}`,
        );

        if (batismosNoPeriodo.length > 0) {
          this.logger.log(
            `DEBUG: Diária indisponível - há batismos no período`,
          );
          return false; // Há batismos que impedem a reserva de diária
        }

        // Verificar se já existe uma reserva de diária para o período
        // Como só pode haver uma diária por dia, verificamos se já existe alguma
        const diariasNoPeriodo = await this.reservaModel.find({
          ...filtroBase,
          tipo: TipoReserva.DIARIA,
        });

        this.logger.log(
          `DEBUG: Diárias encontradas no período: ${diariasNoPeriodo.length}`,
        );

        if (diariasNoPeriodo.length > 0) {
          this.logger.log(
            `DEBUG: Diária indisponível - já existe diária no período`,
          );
          return false; // Já existe diária para o período
        }

        // Se a reserva incluir chalés, verificar disponibilidade de chalés
        if (
          disponibilidadeDTO.quantidadeChales &&
          disponibilidadeDTO.quantidadeChales > 0
        ) {
          const maxChalesDisponiveis = 4; // Quantidade fixa de chalés disponíveis

          this.logger.log(
            `Verificando disponibilidade de chalés: solicitados ${disponibilidadeDTO.quantidadeChales}, máximo disponível ${maxChalesDisponiveis}`,
          );

          // Verificar se a quantidade solicitada excede o máximo disponível
          if (disponibilidadeDTO.quantidadeChales > maxChalesDisponiveis) {
            this.logger.warn(
              `Quantidade de chalés solicitada (${disponibilidadeDTO.quantidadeChales}) excede o máximo disponível (${maxChalesDisponiveis})`,
            );
            return false; // Quantidade de chalés solicitada excede o total disponível
          }

          // Verificar chalés já reservados no período
          const filtroChales = {
            ...filtroBase,
            $or: [{ tipo: TipoReserva.CHALE }, { tipo: TipoReserva.COMPLETO }],
            quantidadeChales: { $exists: true, $gt: 0 },
          };

          this.logger.log(
            `Filtro para buscar reservas de chalés: ${JSON.stringify(filtroChales)}`,
          );

          const reservasChalesNoPeriodo =
            await this.reservaModel.find(filtroChales);

          this.logger.log(
            `Reservas de chalés encontradas no período: ${reservasChalesNoPeriodo.length}`,
          );

          // Calcular total de chalés já reservados no período
          let totalChalesReservados = 0;
          for (const reserva of reservasChalesNoPeriodo) {
            totalChalesReservados += reserva.quantidadeChales || 0;
            this.logger.log(
              `Reserva ${reserva.codigo}: ${reserva.quantidadeChales} chalés`,
            );
          }

          // Verificar se há chalés suficientes disponíveis
          const chalésDisponiveis =
            maxChalesDisponiveis - totalChalesReservados;
          this.logger.log(
            `Chalés disponíveis: ${chalésDisponiveis} (total: ${maxChalesDisponiveis}, reservados: ${totalChalesReservados})`,
          );

          if (disponibilidadeDTO.quantidadeChales > chalésDisponiveis) {
            this.logger.warn(
              `Chalés insuficientes: solicitados ${disponibilidadeDTO.quantidadeChales}, disponíveis ${chalésDisponiveis} (total: ${maxChalesDisponiveis}, reservados: ${totalChalesReservados})`,
            );
            return false; // Chalés insuficientes disponíveis
          }
        }

        return true;

      default:
        throw new HttpException(
          `Tipo de reserva '${disponibilidadeDTO.tipo}' não reconhecido`,
          HttpStatus.BAD_REQUEST,
        );
    }
  }
  private obterDescricaoTipo(tipo: string): string {
    const tipos = {
      [TipoReserva.DIARIA]: 'Diária',
      [TipoReserva.CHALE]: 'Chalé(s)',
      [TipoReserva.BATISMO]: 'Cerimônia de Batismo',
      [TipoReserva.COMPLETO]: 'Pacote Completo (Diária + Chalés)',
    };

    return tipos[tipo] || tipo;
  }

  async getQtdDias(dataInicio: Date, dataFim: Date): Promise<number> {
    const inicio = new Date(dataInicio);
    const fim = new Date(dataFim);
    const diferencaMS = fim.getTime() - inicio.getTime();
    const diferencaDias = Math.max(
      1,
      Math.ceil(diferencaMS / (1000 * 60 * 60 * 24)),
    );
    return diferencaDias;
  }

  /**
   * Valida e recalcula dados recebidos do frontend por segurança
   * Garante que o frontend não manipulou informações críticas
   */
  private async validarERecalcularDadosFrontend(
    dadosFrontend: CreateReservaDto,
    userId: string,
  ): Promise<{ dadosValidados: CreateReservaDto; alertasSeguranca: string[] }> {
    const alertasSeguranca: string[] = [];

    // Carregar configurações para validações dinâmicas
    const config = await this.configuracoesRepository.findAll();

    // 1. Recalcular quantidade de diárias baseado nas datas
    const quantidadeDiariasCalculada = await this.getQtdDias(
      dadosFrontend.dataInicio,
      dadosFrontend.dataFim || dadosFrontend.dataInicio,
    );

    // 2. Verificar se a quantidade enviada pelo frontend está correta
    if (
      dadosFrontend.quantidadeDiarias &&
      dadosFrontend.quantidadeDiarias !== quantidadeDiariasCalculada
    ) {
      const alerta = `⚠️ SEGURANÇA: Quantidade de diárias manipulada! Frontend enviou: ${dadosFrontend.quantidadeDiarias}, Calculado pelo backend: ${quantidadeDiariasCalculada}`;
      alertasSeguranca.push(alerta);
      this.logger.warn(alerta);
      this.logger.warn(
        `Usuário: ${userId}, Data início: ${dadosFrontend.dataInicio}, Data fim: ${dadosFrontend.dataFim}`,
      );
    }

    // 3. Validar limites de quantidade de pessoas baseado nas configurações
    if (
      dadosFrontend.quantidadePessoas &&
      (dadosFrontend.quantidadePessoas < 1 ||
        dadosFrontend.quantidadePessoas > config.qtdMaxPessoas)
    ) {
      const alerta = `⚠️ SEGURANÇA: Quantidade de pessoas inválida! Frontend enviou: ${dadosFrontend.quantidadePessoas}, Máximo permitido: ${config.qtdMaxPessoas}`;
      alertasSeguranca.push(alerta);
      this.logger.warn(alerta);
    }

    // 4. Validar limites de quantidade de chalés baseado nas configurações
    if (
      dadosFrontend.quantidadeChales &&
      (dadosFrontend.quantidadeChales < 0 ||
        dadosFrontend.quantidadeChales > config.quantidadeMaximaChales)
    ) {
      const alerta = `⚠️ SEGURANÇA: Quantidade de chalés inválida! Frontend enviou: ${dadosFrontend.quantidadeChales}, Máximo permitido: ${config.quantidadeMaximaChales}`;
      alertasSeguranca.push(alerta);
      this.logger.warn(alerta);
    }

    // 5. Validar datas (não podem ser no passado)
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    if (new Date(dadosFrontend.dataInicio) < hoje) {
      const alerta = `⚠️ SEGURANÇA: Data de início no passado! Frontend enviou: ${dadosFrontend.dataInicio}`;
      alertasSeguranca.push(alerta);
      this.logger.warn(alerta);
    }

    // 6. Validar se data fim é posterior à data início (rejeitar, não apenas alertar)
    if (
      dadosFrontend.dataFim &&
      new Date(dadosFrontend.dataFim) < new Date(dadosFrontend.dataInicio)
    ) {
      this.logger.warn(
        `⚠️ SEGURANÇA: Data fim anterior à data início! Usuário: ${userId}, início ${dadosFrontend.dataInicio}, fim ${dadosFrontend.dataFim}`,
      );
      throw new BadRequestException(
        'A data de término não pode ser anterior à data de início. Verifique as datas selecionadas.',
      );
    }

    // 7. Criar dados validados com valores recalculados pelo backend
    const dadosValidados: CreateReservaDto = {
      ...dadosFrontend,
      quantidadeDiarias: quantidadeDiariasCalculada, // ✅ Sempre usar valor calculado pelo backend
      quantidadePessoas: Math.max(
        1,
        Math.min(200, dadosFrontend.quantidadePessoas || 1),
      ), // ✅ Forçar limites
      quantidadeChales: Math.max(
        0,
        Math.min(4, dadosFrontend.quantidadeChales || 0),
      ), // ✅ Forçar limites
    };

    // 8. Log de segurança para auditoria
    if (alertasSeguranca.length > 0) {
      this.logger.error(`🚨 ALERTA DE SEGURANÇA - Usuário: ${userId}`);
      this.logger.error(
        `📊 Dados originais: ${JSON.stringify(dadosFrontend, null, 2)}`,
      );
      this.logger.error(
        `✅ Dados validados: ${JSON.stringify(dadosValidados, null, 2)}`,
      );
      this.logger.error(`⚠️ Alertas: ${alertasSeguranca.join(', ')}`);
    } else {
      this.logger.log(`✅ Validação de segurança passou - Usuário: ${userId}`);
    }

    return { dadosValidados, alertasSeguranca };
  }

  /**
   * Obter detalhes completos de uma reserva
   */
  async getDetalhesReserva(reservaId: string): Promise<any> {
    try {
      const reserva = await this.reservaModel
        .findById(reservaId)
        .populate('usuario')
        .populate('pagamento')
        .exec();

      if (!reserva) {
        throw new NotFoundException('Reserva não encontrada');
      }

      // Buscar dados do pagamento se existir
      let dadosPagamento = null;
      if (reserva.pagamento) {
        dadosPagamento = {
          id: (reserva.pagamento as any)._id,
          status: reserva.pagamento.status,
          modoPagamento: reserva.pagamento.modoPagamento,
          valor: reserva.pagamento.valorTotal || reserva.pagamento.valor,
          parcelas: reserva.pagamento.qtdParcelas || reserva.pagamento.parcelas,
          valorTotal: reserva.pagamento.valorTotal,
          qtdParcelas: reserva.pagamento.qtdParcelas,
          asaasCheckoutSessionId: reserva.pagamento.asaasCheckoutSessionId,
          asaasInstallmentId: reserva.pagamento.asaasInstallmentId,
          linkPagamento: reserva.pagamento.linkPagamento,
          dataPagamento: reserva.pagamento.dataPagamento,
          estorno: reserva.pagamento.estorno,
        };
      }

      const resultado = {
        // Dados básicos da reserva
        id: reserva._id,
        codigo: reserva.codigo,
        codigoAcesso: reserva.codigoAcesso,
        tipo: reserva.tipo,
        statusReserva: reserva.statusReserva,

        // Datas
        dataInicio: reserva.dataInicio,
        dataFim: reserva.dataFim,
        quantidadeDiarias: reserva.quantidadeDiarias,

        // Capacidade
        quantidadePessoas: reserva.quantidadePessoas,
        quantidadeChales: reserva.quantidadeChales,

        // Valores
        valorTotal: reserva.valorTotal,
        valorDiaria: reserva.valorDiaria,
        valorDiariaComChale: reserva.valorDiariaComChale,

        // Dados do cliente
        usuario: {
          id: (reserva.usuario as any)._id,
          nome: reserva.usuario.nome,
          sobrenome: reserva.usuario.sobrenome,
          email: reserva.usuario.email,
          telefone: reserva.usuario.telefone,
          cpf: reserva.usuario.cpf,
        },

        // Pagamento
        pagamento: dadosPagamento,

        // Histórico
        historico: reserva.historico || [],

        // Observações
        observacoes: reserva.observacoes,

        // Datas de controle
        dataCriacao: reserva.dataCriacao,
        dataAtualizacao: reserva.dataAtualizacao,
        createdAt: (reserva as any).createdAt,
        updatedAt: (reserva as any).updatedAt,
      };

      return resultado;
    } catch (error) {
      this.logger.error(
        `Erro ao obter detalhes da reserva ${reservaId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Cancelar reserva com possibilidade de estorno
   */
  async cancelarReservaComEstorno(
    reservaId: string,
    motivo: string,
    estornarPagamento: boolean = false,
    valorEstorno?: number,
    canceladoPorNome?: string,
  ): Promise<{ reserva: any; estorno?: any; avisos?: any[] }> {
    try {
      // 1. Buscar reserva e pagamento
      const reserva = await this.reservaModel
        .findById(reservaId)
        .populate('usuario')
        .populate('pagamento')
        .exec();

      if (!reserva) {
        throw new NotFoundException('Reserva não encontrada');
      }

      // 2. Verificar se pode ser cancelada
      if (reserva.statusReserva === StatusReserva.CANCELADA) {
        throw new BadRequestException('Reserva já está cancelada');
      }

      if (reserva.statusReserva === StatusReserva.UTILIZADA) {
        throw new BadRequestException(
          'Reserva já foi utilizada e não pode ser cancelada',
        );
      }

      // 3. Processar estorno se solicitado e aplicável. Se o pagamento já
      // foi recebido (PAGO/CONFIRMADO/RECEBIDO), o estorno é obrigatório
      // independente do que foi mandado pelo admin — não pode existir
      // caminho pra cancelar uma reserva já paga e o cliente ficar sem o
      // dinheiro de volta.
      const statusPagoQueExigeEstorno = ['PAGO', 'CONFIRMADO', 'RECEBIDO'];
      const pagamentoJaFoiRecebido =
        reserva.pagamento &&
        statusPagoQueExigeEstorno.includes(
          (reserva.pagamento as any).status,
        );
      const deveEstornar = estornarPagamento || pagamentoJaFoiRecebido;

      let estorno = null;
      if (deveEstornar && reserva.pagamento) {
        try {
          estorno = await this.reservaProcessoService.processarEstornoPagamento(
            (reserva.pagamento as any)._id.toString(),
            valorEstorno,
            `Cancelamento da reserva ${reserva.codigo} - ${motivo}`,
          );
          this.logger.log(
            `✅ Estorno processado para reserva ${reserva.codigo}: R$ ${estorno?.value || 'N/A'}`,
          );
        } catch (estornoError) {
          // Se o erro veio de chamarApiEstorno() ele já carrega um
          // `asaasError` estruturado (endpoint, método, ID real usado,
          // status e resposta do Asaas) — repassamos pro admin em vez de
          // engolir em `.message`. Esse endpoint (:id/cancelar) só é
          // acessível a admin autenticado (JwtAuthGuard+AdminGuard), então
          // não há risco de vazar detalhe técnico pra um cliente final.
          const respostaOriginal =
            typeof estornoError?.getResponse === 'function'
              ? estornoError.getResponse()
              : null;
          const asaasError =
            respostaOriginal && typeof respostaOriginal === 'object'
              ? (respostaOriginal as any).asaasError
              : undefined;
          const mensagemErro =
            (respostaOriginal && typeof respostaOriginal === 'object'
              ? (respostaOriginal as any).message
              : null) || estornoError.message;

          this.logger.error(
            `❌ Erro ao processar estorno para reserva ${reserva.codigo}: ${mensagemErro}`,
          );
          // O pagamento já foi recebido — se o estorno falha, a reserva
          // NÃO pode ser cancelada (nem liberar as datas, nem nada mais
          // abaixo pode rodar). Do contrário o cliente fica sem a reserva
          // E sem o dinheiro de volta. O admin precisa ver o erro e tentar
          // de novo, ou resolver manualmente no painel do Asaas antes de
          // cancelar.
          throw new BadRequestException({
            message: `Não foi possível cancelar: o estorno do pagamento falhou (${mensagemErro}). A reserva continua ativa até o estorno ser concluído com sucesso.`,
            asaasError,
          });
        }
      }

      // 3.5. Se o pagamento ainda está pendente (nada foi pago, não existe
      // "cobrança" no Asaas ainda), tentar cancelar a Checkout Session em
      // vez de deixar o link de pagamento ativo. cancelarCheckoutPendente()
      // chama POST /v3/checkouts/{id}/cancel. Mesmo assim é tratado como
      // best-effort aqui: se falhar (ex.: checkout já expirou ou foi pago
      // numa corrida com este cancelamento), a rede de segurança real é (a)
      // a sessão expirar sozinha em minutesToExpire minutos e (b)
      // recuperarOuEstornarReservaCancelada() detectar e estornar
      // automaticamente se o cliente pagar antes disso.
      let avisos: any[] = [];
      if (
        reserva.pagamento &&
        (reserva.pagamento as any).status === StatusPagamento.PENDENTE
      ) {
        try {
          const resultadoCancelamento =
            await this.pagamentosService.cancelarCheckoutPendente(reservaId);
          avisos = resultadoCancelamento.avisos;
          if (avisos.length > 0) {
            this.logger.warn(
              `⚠️ Checkout pendente da reserva ${reserva.codigo} não pôde ser cancelado no Asaas: ${JSON.stringify(avisos)}`,
            );
          }
        } catch (cancelamentoError) {
          this.logger.error(
            `Erro ao cancelar cobrança pendente no Asaas para reserva ${reserva.codigo}: ${cancelamentoError.message}`,
          );
        }
      }

      // 4. Atualizar status da reserva
      const historicoAtualizado = [
        ...(reserva.historico || []),
        {
          data: new Date(),
          acao: 'CANCELADA',
          detalhes: motivo,
          canceladoPor: canceladoPorNome || null,
          estorno: estorno
            ? {
                valor: estorno.value,
                data: estorno.dateCreated,
                status: estorno.status,
                id: estorno.id,
              }
            : null,
        },
      ];

      const reservaCancelada = await this.reservaModel
        .findByIdAndUpdate(
          reservaId,
          {
            statusReserva: StatusReserva.CANCELADA,
            historico: historicoAtualizado,
            dataAtualizacao: new Date(),
          },
          { new: true },
        )
        .populate('usuario')
        .populate('pagamento')
        .exec();

      // 5. Liberar disponibilidade
      await this.liberarDisponibilidadeReserva(reserva);

      // 6. Enviar email de cancelamento
      try {
        await this.emailsService.enviarEmailCancelamento(
          reserva,
          motivo,
          estorno,
        );
      } catch (emailError) {
        this.logger.error(
          `Erro ao enviar email de cancelamento: ${emailError.message}`,
        );
        // Não falhar o cancelamento por erro de email
      }

      this.logger.log(
        `✅ Reserva ${reserva.codigo} cancelada com sucesso. Motivo: ${motivo}`,
      );

      return {
        reserva: reservaCancelada,
        estorno: estorno || null,
        avisos: avisos.length > 0 ? avisos : undefined,
      };
    } catch (error) {
      this.logger.error(
        `Erro ao cancelar reserva ${reservaId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Liberar disponibilidade de uma reserva cancelada
   */
  private async liberarDisponibilidadeReserva(reserva: any): Promise<void> {
    try {
      this.logger.log(
        `📅 Liberando disponibilidade para reserva ${reserva.codigo}`,
      );

      // Libera as travas de diária (ReservaHold) para que as datas voltem a ficar disponíveis
      await this.reservaProcessoService.liberarHoldsDeReserva(reserva._id);
    } catch (error) {
      this.logger.error(`Erro ao liberar disponibilidade: ${error.message}`);
      // Não falhar o cancelamento por erro na liberação de disponibilidade
    }
  }
}
