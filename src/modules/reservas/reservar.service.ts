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
import { UpdateReservaDto } from './DTO/update-reserva.dto';
import { UsuariosService } from '../usuarios/usuarios.service';
import { VerificarDisponibilidadeDto } from './DTO/verificar-disponibilidade.dto';
import { Reserva, ReservaModel } from 'src/schemas/reserva.schema';
import { ReservaRepository } from './repositories/reserva.repository';
import { ReservaProcessoService } from 'src/modules/shared/services/reservaProcesso/reserva-processo.service';
import { StatusPagamento } from '../pagamentos/pagamento.enums';
import { StatusReserva, TipoReserva } from './reserva.enums';
import { EmailsService } from '../emails/email.service';
import { CalculoReservaService } from '../shared/services/reservaProcesso/calcular-reserva.service';
import { CONFIGURACOES_REPOSITORY } from '../configuracoes/repositories/configuracaoes-repository.provider';
import { IConfiguracoesRepository } from '../configuracoes/repositories/interfaces/reserva-repository.interface';
import { ReservaEmailData } from '../emails/templates/reserva-confirmacao.template';
import { Inject } from '@nestjs/common';

@Injectable()
export class ReservasService {
  private readonly logger = new Logger(ReservasService.name);

  constructor(
    @InjectModel(Reserva.name) private readonly reservaModel: ReservaModel,
    private readonly usuariosService: UsuariosService,
    private readonly emailsService: EmailsService,
    private readonly reservaProcessoService: ReservaProcessoService,
    private readonly calculoReservaService: CalculoReservaService,
    @Inject(CONFIGURACOES_REPOSITORY)
    private readonly configuracoesRepository: IConfiguracoesRepository,
  ) {}

  /**
   * Executa operações de criação de reserva com transação para garantir consistência
   */
  private async executeWithTransaction<T>(
    operation: (session: any) => Promise<T>
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
      if (error.message.includes('Erro ao criar cobrança') || error.message.includes('ASAAS')) {
        this.logger.error(`❌ ERRO DE PAGAMENTO detectado na transação`);
        this.logger.error(`❌ Verificar conectividade com ASAAS e configurações de API`);
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
        userId
      );

      // 2. VALIDAR CÁLCULO DE VALORES
      const valorCalculadoBackend = await this.calculoReservaService.getValorReserva(dadosValidados);
      
      // Comparar com o valor enviado pelo frontend
      const valorFrontend = createReservaDto.dadosPagamento?.valorTotal || 0;
      const diferencaPercentual = Math.abs(valorCalculadoBackend.valorTotal - valorFrontend) / valorFrontend * 100;
      
      if (diferencaPercentual > 5) { // Tolerância de 5%
        this.logger.error(`❌ Diferença significativa no cálculo: Frontend=${valorFrontend}, Backend=${valorCalculadoBackend.valorTotal}`);
        throw new BadRequestException(
          `Valor calculado incorretamente. Valor esperado: R$ ${valorCalculadoBackend.valorTotal.toFixed(2)}. ` +
          `Recarregue a página e tente novamente.`
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
        this.logger.error(`❌ Indisponibilidade detectada para: ${JSON.stringify({
          dataInicio: dadosValidados.dataInicio,
          dataFim: dadosValidados.dataFim,
          tipo: dadosValidados.tipo,
          quantidadeChales: dadosValidados.quantidadeChales,
        })}`);
        
        // Mensagens específicas para cada caso de indisponibilidade
        const dataInicio = new Date(dadosValidados.dataInicio);
        const dataFim = new Date(dadosValidados.dataFim);
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        
        if (dataInicio < hoje) {
          throw new BadRequestException('Não é possível fazer reservas para datas passadas.');
        }
        
        if (dataInicio.getTime() === dataFim.getTime()) {
          throw new BadRequestException('A data de início deve ser diferente da data de fim.');
        }
        
        if (dadosValidados.quantidadeChales > 0) {
          throw new BadRequestException(
            `Não há chalés disponíveis para o período selecionado. ` +
            `Tente selecionar um período diferente ou reduzir a quantidade de chalés.`
          );
        }
        
        throw new BadRequestException(
          `Não há disponibilidade para o período selecionado (${dataInicio.toLocaleDateString('pt-BR')} a ${dataFim.toLocaleDateString('pt-BR')}). ` +
          `Tente selecionar outro período.`
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
      const { dadosValidados, alertasSeguranca } = await this.validarERecalcularDadosFrontend(
        createReservaDto,
        userId
      );
      
      // Se houver alertas de segurança críticos, registrar mas continuar
      if (alertasSeguranca.length > 0) {
        this.logger.warn(`🚨 ${alertasSeguranca.length} alerta(s) de segurança detectado(s) para usuário ${userId}`);
      }

      // Buscar usuário
      const usuario = await this.usuariosService.findById(userId);
      if (!usuario) {
        throw new NotFoundException('Usuário não encontrado');
      }

      // ✅ Validação de cálculo e disponibilidade já foi feita
      this.logger.log(`✅ Validações de cálculo e disponibilidade já realizadas, prosseguindo com criação da reserva`);
      
      // Gerar código único para a reserva
      const codigo = await this.reservaModel.gerarCodigoReserva();

      // Gerar código de acesso
      const codigoAcesso = this.reservaModel.gerarCodigoAcesso();

      // ✅ Usar dados validados pelo backend (não os do frontend)
      this.logger.log(`🔒 Usando dados validados pelo backend - Quantidade de diárias: ${dadosValidados.quantidadeDiarias}`);
      
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
            detalhes: alertasSeguranca.length > 0 
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
        await this.reservaProcessoService.processarNovaReserva(novaReserva);

      let reserva = reservaCriada.reserva;
      let pagamento = reservaCriada.pagamento;

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
          dadosHospede: reserva.dadosHospede
        };

        await this.emailsService.enviarEmailReservaCriada(emailData, pagamento?.linkPagamento);
        this.logger.log(`✅ Email de confirmação enviado para ${reserva.usuarioEmail}`);
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
      this.logger.log(`📦 createReservaDto: ${JSON.stringify(createReservaDto, null, 2)}`);
      this.logger.log(`📦 dadosHospede: ${JSON.stringify(createReservaDto.dadosHospede, null, 2)}`);
      
      // Validar dados obrigatórios do hóspede
      if (!createReservaDto.dadosHospede?.email || !createReservaDto.dadosHospede?.cpf) {
        this.logger.error(`❌ Dados obrigatórios ausentes:`);
        this.logger.error(`📧 Email: ${createReservaDto.dadosHospede?.email || 'AUSENTE'}`);
        this.logger.error(`🆔 CPF: ${createReservaDto.dadosHospede?.cpf || 'AUSENTE'}`);
        throw new BadRequestException(
          'Email e CPF são obrigatórios para criar uma reserva pública'
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
        isAdmin: false
      });

      // Usar o método create normal com o usuário criado
      return this.create(createReservaDto, (usuario as any)._id.toString());
    });
  }

  async createPublicoDebug(
    createReservaDto: CreateReservaDto,
  ): Promise<{ reserva: Reserva; pagamento: any }> {
    try {
      this.logger.log(`DEBUG: Criando reserva pública sem verificação de disponibilidade`);
      
      // Validar dados obrigatórios do hóspede
      if (!createReservaDto.dadosHospede?.email || !createReservaDto.dadosHospede?.cpf) {
        throw new BadRequestException(
          'Email e CPF são obrigatórios para criar uma reserva pública'
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
        isAdmin: false
      });

      this.logger.log(`DEBUG: Usuário criado: ${usuario.email}`);

      // Usar o método create normal com o usuário criado, mas sem verificação de disponibilidade
      return this.createDebug(createReservaDto, (usuario as any)._id.toString());
    } catch (error) {
      this.logger.error(`Erro ao criar reserva pública DEBUG: ${error.message}`);
      throw error;
    }
  }

  async createDebug(
    createReservaDto: CreateReservaDto,
    userId: string,
  ): Promise<{ reserva: Reserva; pagamento: any }> {
    try {
      this.logger.log(`DEBUG: Iniciando criação de reserva sem verificação de disponibilidade`);
      
      // Buscar usuário
      const usuario = await this.usuariosService.findById(userId);
      this.logger.log(`DEBUG: Usuário encontrado: ${usuario.email}`);

      // PULAR verificação de disponibilidade para debug
      this.logger.log(`DEBUG: Pulando verificação de disponibilidade`);

      // Gerar código único para a reserva
      const codigo = await this.reservaModel.gerarCodigoReserva();
      this.logger.log(`DEBUG: Código da reserva gerado: ${codigo}`);

      // Gerar código de acesso
      const codigoAcesso = this.reservaModel.gerarCodigoAcesso();

      createReservaDto.quantidadeDiarias = await this.getQtdDias(
        createReservaDto.dataInicio,
        createReservaDto.dataFim || createReservaDto.dataInicio,
      );
      
      this.logger.log(`DEBUG: Quantidade de diárias calculada: ${createReservaDto.quantidadeDiarias}`);
      
      // Calcular valor da reserva
      const valorTotaldaReserva =
        await this.calculoReservaService.getValorReserva(createReservaDto);
      
      this.logger.log(`DEBUG: Valor da reserva calculado: ${JSON.stringify(valorTotaldaReserva)}`);

      // Criar reserva
      const novaReserva = {
        codigo,
        codigoAcesso,
        usuario: usuario,
        usuarioEmail: usuario.email,
        usuarioNome: usuario.nome,
        tipo: createReservaDto.tipo,
        dataInicio: createReservaDto.dataInicio,
        dataFim: createReservaDto.dataFim || createReservaDto.dataInicio,
        quantidadePessoas: createReservaDto.quantidadePessoas,
        quantidadeChales: createReservaDto.quantidadeChales,
        quantidadeDiarias: await this.getQtdDias(
          createReservaDto.dataInicio,
          createReservaDto.dataFim || createReservaDto.dataInicio,
        ),
        observacoes: createReservaDto.observacoes,
        historico: [
          {
            data: new Date(),
            acao: 'Reserva criada (DEBUG)',
            detalhes: 'Aguardando pagamento',
          },
        ],
        valorTotal: valorTotaldaReserva.valorTotal,
        dadosPagamento: createReservaDto.dadosPagamento,
        dataCriacao: new Date(),
        dataAtualizacao: new Date(),
      };

      this.logger.log(`DEBUG: Dados da reserva: ${JSON.stringify(novaReserva)}`);

      const reservaCriada =
        await this.reservaProcessoService.processarNovaReserva(novaReserva);

      let reserva = reservaCriada.reserva;
      let pagamento = reservaCriada.pagamento;
      
      this.logger.log(`DEBUG: Reserva criada com sucesso: ${reserva.codigo}`);
      
      return { reserva, pagamento };
    } catch (error) {
      this.logger.error(`DEBUG: Erro ao criar reserva: ${error.message}`);
      this.logger.error(`DEBUG: Stack trace: ${error.stack}`);
      throw error;
    }
  }

  private generateRandomPassword(): string {
    // Gerar senha temporária que será alterada no primeiro login
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  // async update(
  //   id: string,
  //   updateReservaDto: UpdateReservaDto,
  //   userId: string,
  // ): Promise<Reserva> {
  //   // Buscar reserva
  //   const reserva = await this.reservaRepository.findById(id);

  //   // Verificar se o usuário é o dono da reserva ou um admin
  //   if (
  //     reserva.usuario.toString() !== userId &&
  //     !(await this.usuariosService.findById(userId)).isAdmin
  //   ) {
  //     throw new BadRequestException(
  //       'Você não tem permissão para atualizar esta reserva',
  //     );
  //   }

  //   // Verificar se a reserva pode ser atualizada (não cancelada ou já paga)
  //   if (reserva.pagamento.status === StatusPagamento.CANCELADO) {
  //     throw new BadRequestException(
  //       'Esta reserva foi cancelada e não pode ser atualizada',
  //     );
  //   }

  //   if (reserva.pagamento.status === StatusPagamento.PAGO) {
  //     throw new BadRequestException(
  //       'Esta reserva já foi paga e não pode ser atualizada',
  //     );
  //   }

  //   // Verificar disponibilidade se a data foi alterada
  //   if (
  //     updateReservaDto.dataInicio &&
  //     reserva.dataInicio.toISOString() !==
  //       new Date(updateReservaDto.dataInicio).toISOString()
  //   ) {
  //     const disponibilidade = await this.verificarDisponibilidade({
  //       data: updateReservaDto.dataInicio,
  //       tipo: updateReservaDto.tipo || reserva.tipo,
  //       quantidadeChales:
  //         updateReservaDto.quantidadeChales || reserva.quantidadeChales,
  //     });

  //     if (!disponibilidade.disponivel) {
  //       throw new BadRequestException(
  //         'Não há disponibilidade para esta data ou quantidade de chalés',
  //       );
  //     }
  //   }

  //   // Recalcular valor se algum parâmetro relevante foi alterado
  //   if (
  //     updateReservaDto.tipo ||
  //     updateReservaDto.quantidadePessoas ||
  //     updateReservaDto.quantidadeChales
  //   ) {
  //     const valorTotal = await this.cotarReserva(
  //       updateReservaDto.tipo || reserva.tipo,
  //       updateReservaDto.quantidadePessoas || reserva.quantidadePessoas,
  //       updateReservaDto.quantidadeChales || reserva.quantidadeChales,
  //     );

  //     reserva.valorTotal = valorTotal;
  //     reserva.pagamento.valorTotal = valorTotal;
  //   }

  //   // Atualizar campos
  //   if (updateReservaDto.tipo) reserva.tipo = updateReservaDto.tipo;
  //   if (updateReservaDto.dataInicio)
  //     reserva.dataInicio = new Date(updateReservaDto.dataInicio);
  //   if (updateReservaDto.dataFim)
  //     reserva.dataFim = new Date(updateReservaDto.dataFim);
  //   if (updateReservaDto.quantidadePessoas)
  //     reserva.quantidadePessoas = updateReservaDto.quantidadePessoas;
  //   if (updateReservaDto.quantidadeChales)
  //     reserva.quantidadeChales = updateReservaDto.quantidadeChales;
  //   if (updateReservaDto.observacoes)
  //     reserva.observacoes = updateReservaDto.observacoes;

  //   // Adicionar ao histórico
  //   reserva.historico.push({
  //     data: new Date(),
  //     acao: 'Reserva atualizada',
  //     detalhes: 'Detalhes da reserva foram atualizados',
  //   });

  //   // Salvar reserva
  //   return reserva.save();
  // }

  // async cancelar(id: string, userId: string, motivo: string) {
  //   const reserva = await this.reservaRepository.findById(id);
  //   if (!reserva) {
  //     throw new NotFoundException('Reserva não encontrada');
  //   }
  //   const pagamentos =
  //     await this.reservaProcessoService.getPagamentosByReservaId(id);
  //   if (!pagamentos) {
  //     throw new NotFoundException('Pagamentos não encontrados');
  //   }

  //   if (
  //     reserva.usuario['_id'].toString() !== userId &&
  //     !(await this.usuariosService.findById(userId)).isAdmin
  //   ) {
  //     throw new BadRequestException(
  //       'Você não tem permissão para cancelar esta reserva',
  //     );
  //   }
  //   if (reserva.statusReserva === StatusReserva.CANCELADA) {
  //     throw new BadRequestException('Esta reserva já foi cancelada');
  //   }

  //   for (const pagamento of pagamentos) {
  //     if (
  //       pagamento.status === StatusPagamento.PAGO &&
  //       !(await this.usuariosService.findById(userId)).isAdmin
  //     ) {
  //       throw new BadRequestException(
  //         'Esta reserva já foi paga e só pode ser cancelada por um administrador',
  //       );
  //     }
  //   }

  //   const reservaAtualizada = await this.reservaProcessoService.processarCancelamentoReserva(
  //     reserva._id.toString(),
  //     motivo
  //   );

  //   const usuario = await this.usuariosService.findById(
  //     reserva.usuario['_id'].toString(),
  //   );
  //   await this.emailsService.enviarNotificacaoPagamento(
  //     usuario.email,
  //     usuario.nome,
  //     reserva.codigo,
  //     'cancelado',
  //   );

  //   return reservaAtualizada;
  // }

  async verificarDisponibilidade(
    disponibilidadeDTO: VerificarDisponibilidadeDto,
  ): Promise<boolean> {
    this.logger.log(`DEBUG: Verificando disponibilidade para: ${JSON.stringify(disponibilidadeDTO)}`);
    
    // Para facilitar a comparação, vamos trabalhar só com as datas (sem horas)
    const inicioAjustado = new Date(disponibilidadeDTO.dataInicio);
    inicioAjustado.setHours(0, 0, 0, 0);

    const fimAjustado = new Date(disponibilidadeDTO.dataFim);
    fimAjustado.setHours(23, 59, 59, 999);
    
    this.logger.log(`DEBUG: Datas ajustadas - Início: ${inicioAjustado.toISOString()}, Fim: ${fimAjustado.toISOString()}`);

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

        this.logger.log(`DEBUG: Reservas de batismo encontradas: ${reservasBatismo.length}`);

        if (reservasBatismo.length > 0) {
          this.logger.log(`DEBUG: Batismo indisponível - já existe reserva de batismo no período`);
          return false; // Já existe batismo para o período
        }

        // Verificar se há diárias no período (que impedem o batismo)
        const diariasNoPeriodoBatismo = await this.reservaModel.find({
          ...filtroBase,
          tipo: TipoReserva.DIARIA,
        });

        this.logger.log(`DEBUG: Diárias encontradas no período: ${diariasNoPeriodoBatismo.length}`);

        if (diariasNoPeriodoBatismo.length > 0) {
          this.logger.log(`DEBUG: Batismo indisponível - há diárias no período`);
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

        this.logger.log(`DEBUG: Batismos encontrados no período: ${batismosNoPeriodo.length}`);

        if (batismosNoPeriodo.length > 0) {
          this.logger.log(`DEBUG: Diária indisponível - há batismos no período`);
          return false; // Há batismos que impedem a reserva de diária
        }

        // Verificar se já existe uma reserva de diária para o período
        // Como só pode haver uma diária por dia, verificamos se já existe alguma
        const diariasNoPeriodo = await this.reservaModel.find({
          ...filtroBase,
          tipo: TipoReserva.DIARIA,
        });

        this.logger.log(`DEBUG: Diárias encontradas no período: ${diariasNoPeriodo.length}`);

        if (diariasNoPeriodo.length > 0) {
          this.logger.log(`DEBUG: Diária indisponível - já existe diária no período`);
          return false; // Já existe diária para o período
        }

        // Se a reserva incluir chalés, verificar disponibilidade de chalés
        if (
          disponibilidadeDTO.quantidadeChales &&
          disponibilidadeDTO.quantidadeChales > 0
        ) {
          const maxChalesDisponiveis = 4; // Quantidade fixa de chalés disponíveis
          
          this.logger.log(`Verificando disponibilidade de chalés: solicitados ${disponibilidadeDTO.quantidadeChales}, máximo disponível ${maxChalesDisponiveis}`);

          // Verificar se a quantidade solicitada excede o máximo disponível
          if (disponibilidadeDTO.quantidadeChales > maxChalesDisponiveis) {
            this.logger.warn(`Quantidade de chalés solicitada (${disponibilidadeDTO.quantidadeChales}) excede o máximo disponível (${maxChalesDisponiveis})`);
            return false; // Quantidade de chalés solicitada excede o total disponível
          }

          // Verificar chalés já reservados no período
          const filtroChales = {
            ...filtroBase,
            $or: [
              { tipo: TipoReserva.CHALE },
              { tipo: TipoReserva.COMPLETO }
            ],
            quantidadeChales: { $exists: true, $gt: 0 }
          };
          
          this.logger.log(`Filtro para buscar reservas de chalés: ${JSON.stringify(filtroChales)}`);
          
          const reservasChalesNoPeriodo = await this.reservaModel.find(filtroChales);
          
          this.logger.log(`Reservas de chalés encontradas no período: ${reservasChalesNoPeriodo.length}`);

          // Calcular total de chalés já reservados no período
          let totalChalesReservados = 0;
          for (const reserva of reservasChalesNoPeriodo) {
            totalChalesReservados += reserva.quantidadeChales || 0;
            this.logger.log(`Reserva ${reserva.codigo}: ${reserva.quantidadeChales} chalés`);
          }

          // Verificar se há chalés suficientes disponíveis
          const chalésDisponiveis = maxChalesDisponiveis - totalChalesReservados;
          this.logger.log(`Chalés disponíveis: ${chalésDisponiveis} (total: ${maxChalesDisponiveis}, reservados: ${totalChalesReservados})`);
          
          if (disponibilidadeDTO.quantidadeChales > chalésDisponiveis) {
            this.logger.warn(`Chalés insuficientes: solicitados ${disponibilidadeDTO.quantidadeChales}, disponíveis ${chalésDisponiveis} (total: ${maxChalesDisponiveis}, reservados: ${totalChalesReservados})`);
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
    userId: string
  ): Promise<{ dadosValidados: CreateReservaDto; alertasSeguranca: string[] }> {
    const alertasSeguranca: string[] = [];
    
    // Carregar configurações para validações dinâmicas
    const config = await this.configuracoesRepository.findAll();
    
    // 1. Recalcular quantidade de diárias baseado nas datas
    const quantidadeDiariasCalculada = await this.getQtdDias(
      dadosFrontend.dataInicio,
      dadosFrontend.dataFim || dadosFrontend.dataInicio
    );
    
    // 2. Verificar se a quantidade enviada pelo frontend está correta
    if (dadosFrontend.quantidadeDiarias && dadosFrontend.quantidadeDiarias !== quantidadeDiariasCalculada) {
      const alerta = `⚠️ SEGURANÇA: Quantidade de diárias manipulada! Frontend enviou: ${dadosFrontend.quantidadeDiarias}, Calculado pelo backend: ${quantidadeDiariasCalculada}`;
      alertasSeguranca.push(alerta);
      this.logger.warn(alerta);
      this.logger.warn(`Usuário: ${userId}, Data início: ${dadosFrontend.dataInicio}, Data fim: ${dadosFrontend.dataFim}`);
    }
    
    // 3. Validar limites de quantidade de pessoas baseado nas configurações
    if (dadosFrontend.quantidadePessoas && (dadosFrontend.quantidadePessoas < 1 || dadosFrontend.quantidadePessoas > config.qtdMaxPessoas)) {
      const alerta = `⚠️ SEGURANÇA: Quantidade de pessoas inválida! Frontend enviou: ${dadosFrontend.quantidadePessoas}, Máximo permitido: ${config.qtdMaxPessoas}`;
      alertasSeguranca.push(alerta);
      this.logger.warn(alerta);
    }
    
    // 4. Validar limites de quantidade de chalés baseado nas configurações
    if (dadosFrontend.quantidadeChales && (dadosFrontend.quantidadeChales < 0 || dadosFrontend.quantidadeChales > config.quantidadeMaximaChales)) {
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
    
    // 6. Validar se data fim é posterior à data início
    if (dadosFrontend.dataFim && new Date(dadosFrontend.dataFim) < new Date(dadosFrontend.dataInicio)) {
      const alerta = `⚠️ SEGURANÇA: Data fim anterior à data início! Frontend enviou: início ${dadosFrontend.dataInicio}, fim ${dadosFrontend.dataFim}`;
      alertasSeguranca.push(alerta);
      this.logger.warn(alerta);
    }
    
    // 7. Criar dados validados com valores recalculados pelo backend
    const dadosValidados: CreateReservaDto = {
      ...dadosFrontend,
      quantidadeDiarias: quantidadeDiariasCalculada, // ✅ Sempre usar valor calculado pelo backend
      quantidadePessoas: Math.max(1, Math.min(200, dadosFrontend.quantidadePessoas || 1)), // ✅ Forçar limites
      quantidadeChales: Math.max(0, Math.min(4, dadosFrontend.quantidadeChales || 0)), // ✅ Forçar limites
    };
    
    // 8. Log de segurança para auditoria
    if (alertasSeguranca.length > 0) {
      this.logger.error(`🚨 ALERTA DE SEGURANÇA - Usuário: ${userId}`);
      this.logger.error(`📊 Dados originais: ${JSON.stringify(dadosFrontend, null, 2)}`);
      this.logger.error(`✅ Dados validados: ${JSON.stringify(dadosValidados, null, 2)}`);
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
          asaasPagamentoId: reserva.pagamento.asaasPagamentoId,
          asaasInstallmentId: reserva.pagamento.asaasInstallmentId,
          linkPagamento: reserva.pagamento.linkPagamento,
          dataPagamento: reserva.pagamento.dataPagamento,
          estorno: reserva.pagamento.estorno
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
          cpf: reserva.usuario.cpf
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
        updatedAt: (reserva as any).updatedAt
      };
      
      return resultado;
    } catch (error) {
      this.logger.error(`Erro ao obter detalhes da reserva ${reservaId}: ${error.message}`);
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
    valorEstorno?: number
  ): Promise<{ reserva: any; estorno?: any }> {
    
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
          throw new BadRequestException('Reserva já foi utilizada e não pode ser cancelada');
        }

        // 3. Processar estorno se solicitado e aplicável
        let estorno = null;
        if (estornarPagamento && reserva.pagamento) {
          try {
            estorno = await this.reservaProcessoService.processarEstornoPagamento(
              ((reserva.pagamento as any)._id).toString(),
              valorEstorno,
              `Cancelamento da reserva ${reserva.codigo} - ${motivo}`
            );
            this.logger.log(`✅ Estorno processado para reserva ${reserva.codigo}: R$ ${estorno?.value || 'N/A'}`);
          } catch (estornoError) {
            this.logger.error(`❌ Erro ao processar estorno para reserva ${reserva.codigo}: ${estornoError.message}`);
            // Continuar com cancelamento mesmo se estorno falhar
            estorno = { error: estornoError.message };
          }
        }

        // 4. Atualizar status da reserva
        const historicoAtualizado = [
          ...(reserva.historico || []),
          {
            data: new Date(),
            acao: 'CANCELADA',
            detalhes: motivo,
            estorno: estorno ? {
              valor: estorno.value,
              data: estorno.dateCreated,
              status: estorno.status,
              id: estorno.id
            } : null
          }
        ];

        const reservaCancelada = await this.reservaModel
          .findByIdAndUpdate(
            reservaId,
            {
              statusReserva: StatusReserva.CANCELADA,
              historico: historicoAtualizado,
              dataAtualizacao: new Date()
            },
            { new: true }
          )
          .populate('usuario')
          .populate('pagamento')
          .exec();

        // 5. Liberar disponibilidade
        await this.liberarDisponibilidadeReserva(reserva);

        // 6. Enviar email de cancelamento
        try {
          await this.emailsService.enviarEmailCancelamento(reserva, motivo, estorno);
        } catch (emailError) {
          this.logger.error(`Erro ao enviar email de cancelamento: ${emailError.message}`);
          // Não falhar o cancelamento por erro de email
        }

        this.logger.log(`✅ Reserva ${reserva.codigo} cancelada com sucesso. Motivo: ${motivo}`);

        return { 
          reserva: reservaCancelada, 
          estorno: estorno || null 
        };

    } catch (error) {
      this.logger.error(`Erro ao cancelar reserva ${reservaId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Liberar disponibilidade de uma reserva cancelada
   */
  private async liberarDisponibilidadeReserva(reserva: any): Promise<void> {
    try {
      // Aqui você pode implementar a lógica para liberar a disponibilidade
      // Por exemplo, remover bloqueios de datas ou atualizar configurações
      this.logger.log(`📅 Liberando disponibilidade para reserva ${reserva.codigo}`);
      
      // Implementar lógica específica conforme sua regra de negócio
      // Por enquanto, apenas log
      
    } catch (error) {
      this.logger.error(`Erro ao liberar disponibilidade: ${error.message}`);
      // Não falhar o cancelamento por erro na liberação de disponibilidade
    }
  }
}
