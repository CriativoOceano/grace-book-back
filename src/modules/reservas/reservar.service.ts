import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { CreateReservaDto } from './dto/create-reserva.dto';
import { UpdateReservaDto } from './dto/update-reserva.dto';
import { UsuariosService } from '../usuarios/usuarios.service';
import { VerificarDisponibilidadeDto } from './dto/verificar-disponibilidade.dto';
import { ConfiguracoesService } from '../config/config.service';
import { EmailsService } from '../emails/email.service';
import { Reserva, ReservaDocument, ReservaModel, StatusPagamento, TipoReserva } from 'src/schemas/reserva.schema';
import { ReservaRepository } from './repositories/reserva.repository';
import { ReservaProcessoService } from 'src/shared/services/reserva-processo.service';

@Injectable()
export class ReservasService {
  private readonly logger = new Logger(ReservasService.name);

  constructor(
    @InjectModel(Reserva.name) private readonly reservaModel: ReservaModel,
    private readonly usuariosService: UsuariosService,
    private readonly configuracoesService: ConfiguracoesService,
    private readonly emailsService: EmailsService,
    private readonly reservaRepository: ReservaRepository,
    private readonly reservaProcessoService: ReservaProcessoService,
  ) {}

  async create(createReservaDto: CreateReservaDto, userId: string): Promise<{ reserva: Reserva; pagamento: any }> {
    try {
      // Buscar usuário
      const usuario = await this.usuariosService.findById(userId);
      
      // Verificar disponibilidade
      const disponibilidade = await this.verificarDisponibilidade({
        data: createReservaDto.dataInicio,
        tipo: createReservaDto.tipo,
        quantidadeChales: createReservaDto.quantidadeChales
      });
      
      if (!disponibilidade.disponivel) {
        throw new BadRequestException('Não há disponibilidade para esta data ou quantidade de chalés');
      }
      
      // Calcular valor da reserva
      const valorTotal = await this.configuracoesService.obterValorReserva(
        createReservaDto.tipo,
        createReservaDto.quantidadePessoas,
        createReservaDto.quantidadeChales
      );
      
      // Gerar código único para a reserva
      const codigo = await this.reservaModel.gerarCodigoReserva();
      
      // Gerar código de acesso
      const codigoAcesso = this.reservaModel.gerarCodigoAcesso();
      
      // Criar reserva
      const novaReserva = {
        codigo,
        codigoAcesso,
        usuario: usuario,
        tipo: createReservaDto.tipo,
        dataInicio: createReservaDto.dataInicio,
        dataFim: createReservaDto.dataFim || createReservaDto.dataInicio, // Se não informar dataFim, usa a mesma dataInicio
        quantidadePessoas: createReservaDto.quantidadePessoas,
        quantidadeChales: createReservaDto.quantidadeChales,
        valorTotal,
        observacoes: createReservaDto.observacoes,
        historico: [{
          data: new Date(),
          acao: 'Reserva criada',
          detalhes: 'Aguardando pagamento'
        }],
        dataCriacao: new Date(),
        dataAtualizacao: new Date()
      };
      const reservaCriada = await this.reservaProcessoService.processarNovaReserva(novaReserva);
      
      // Enviar email de confirmação
      await this.emailsService.enviarConfirmacaoReserva(
        usuario.email,
        usuario.nome,
        reservaCriada.reserva.codigo,
        reservaCriada.reserva.dataInicio,
        this.obterDescricaoTipo( reservaCriada.reserva.tipo),
        reservaCriada.reserva.valorTotal,
        codigoAcesso
      );
      
      let reserva = reservaCriada.reserva;
      let pagamento = reservaCriada.pagamento;
      return {reserva, pagamento};
    } catch (error) {
      this.logger.error(`Erro ao criar reserva: ${error.message}`);
      throw error;
    }
  }

  async findAll(): Promise<Reserva[]> {
    return this.reservaRepository.findAll();
  }

  async findByUser(userId: string): Promise<Reserva[]> {
    return this.reservaRepository.findByUser(userId);
  }

  async findById(id: string): Promise<ReservaDocument> {
    const reserva = await this.reservaRepository.findById(id);
    
    if (!reserva) {
      throw new NotFoundException(`Reserva com ID "${id}" não encontrada`);
    }
    
    return reserva;
  }

  async findByCodigo(codigo: string): Promise<ReservaDocument> {
    const reserva = await this.reservaRepository.findByCodigo(codigo);
    
    if (!reserva) {
      throw new NotFoundException(`Reserva com código "${codigo}" não encontrada`);
    }
    
    return reserva;
  }

  async update(id: string, updateReservaDto: UpdateReservaDto, userId: string): Promise<Reserva> {
    // Buscar reserva
    const reserva = await this.findById(id);
    
    // Verificar se o usuário é o dono da reserva ou um admin
    if (reserva.usuario.toString() !== userId && !(await this.usuariosService.findById(userId)).isAdmin) {
      throw new BadRequestException('Você não tem permissão para atualizar esta reserva');
    }
    
    // Verificar se a reserva pode ser atualizada (não cancelada ou já paga)
    if (reserva.pagamento.status === StatusPagamento.CANCELADO) {
      throw new BadRequestException('Esta reserva foi cancelada e não pode ser atualizada');
    }
    
    if (reserva.pagamento.status === StatusPagamento.PAGO) {
      throw new BadRequestException('Esta reserva já foi paga e não pode ser atualizada');
    }
    
    // Verificar disponibilidade se a data foi alterada
    if (updateReservaDto.dataInicio && reserva.dataInicio.toISOString() !== new Date(updateReservaDto.dataInicio).toISOString()) {
      const disponibilidade = await this.verificarDisponibilidade({
        data: updateReservaDto.dataInicio,
        tipo: updateReservaDto.tipo || reserva.tipo,
        quantidadeChales: updateReservaDto.quantidadeChales || reserva.quantidadeChales
      });
      
      if (!disponibilidade.disponivel) {
        throw new BadRequestException('Não há disponibilidade para esta data ou quantidade de chalés');
      }
    }
    
    // Recalcular valor se algum parâmetro relevante foi alterado
    if (
      updateReservaDto.tipo ||
      updateReservaDto.quantidadePessoas ||
      updateReservaDto.quantidadeChales
    ) {
      const valorTotal = await this.configuracoesService.obterValorReserva(
        updateReservaDto.tipo || reserva.tipo,
        updateReservaDto.quantidadePessoas || reserva.quantidadePessoas,
        updateReservaDto.quantidadeChales || reserva.quantidadeChales
      );
      
      reserva.valorTotal = valorTotal;
      reserva.pagamento.valor = valorTotal;
    }
    
    // Atualizar campos
    if (updateReservaDto.tipo) reserva.tipo = updateReservaDto.tipo;
    if (updateReservaDto.dataInicio) reserva.dataInicio = new Date(updateReservaDto.dataInicio);
    if (updateReservaDto.dataFim) reserva.dataFim = new Date(updateReservaDto.dataFim);
    if (updateReservaDto.quantidadePessoas) reserva.quantidadePessoas = updateReservaDto.quantidadePessoas;
    if (updateReservaDto.quantidadeChales) reserva.quantidadeChales = updateReservaDto.quantidadeChales;
    if (updateReservaDto.observacoes) reserva.observacoes = updateReservaDto.observacoes;
    
    // Adicionar ao histórico
    reserva.historico.push({
      data: new Date(),
      acao: 'Reserva atualizada',
      detalhes: 'Detalhes da reserva foram atualizados'
    });
    
    // Salvar reserva
    return reserva.save();
  }

  async cancelar(id: string, userId: string, motivo: string): Promise<Reserva> {
    // Buscar reserva
    const reserva = await this.findById(id);
    
    // Verificar se o usuário é o dono da reserva ou um admin
    if (reserva.usuario.toString() !== userId && !(await this.usuariosService.findById(userId)).isAdmin) {
      throw new BadRequestException('Você não tem permissão para cancelar esta reserva');
    }
    
    // Verificar se a reserva pode ser cancelada (não já cancelada ou já concluída)
    if (reserva.pagamento.status === StatusPagamento.CANCELADO) {
      throw new BadRequestException('Esta reserva já foi cancelada');
    }
    
    // Se já estiver paga, apenas administradores podem cancelar
    if (reserva.pagamento.status === StatusPagamento.PAGO && !(await this.usuariosService.findById(userId)).isAdmin) {
      throw new BadRequestException('Esta reserva já foi paga e só pode ser cancelada por um administrador');
    }
    
    // Atualizar status para cancelado
    reserva.pagamento.status = StatusPagamento.CANCELADO;
    
    // Adicionar ao histórico
    reserva.historico.push({
      data: new Date(),
      acao: 'Reserva cancelada',
      detalhes: motivo || 'Cancelada pelo usuário'
    });
    
    // Salvar reserva
    const reservaAtualizada = await reserva.save();
    
    // Enviar email de cancelamento
    const usuario = await this.usuariosService.findById(reserva.usuario.toString());
    await this.emailsService.enviarNotificacaoPagamento(
      usuario.email,
      usuario.nome,
      reserva.codigo,
      'cancelado'
    );
    
    return reservaAtualizada;
  }

  async verificarDisponibilidade(verificarDto: VerificarDisponibilidadeDto): Promise<{ disponivel: boolean; motivo?: string }> {
    try {
      const { data, tipo, quantidadeChales = 0 } = verificarDto;
      
      // Buscar configurações
      const config = await this.configuracoesService.findAll();
      
      // Verificar se a data é futura e respeita a antecedência mínima
      const hoje = new Date();
      const dataMinima = new Date();
      dataMinima.setDate(hoje.getDate() + config.diasAntecedenciaMinima);
      
      const dataReserva = new Date(data);
      if (dataReserva < dataMinima) {
        return { 
          disponivel: false, 
          motivo: `A reserva deve ser feita com pelo menos ${config.diasAntecedenciaMinima} dias de antecedência` 
        };
      }
      
      // Formatar data para comparação (apenas ano, mês, dia)
      const dataFormatada = dataReserva.toISOString().split('T')[0];
      
      // Verificar se já existe reserva para esta data
      const reservasNaData = await this.reservaRepository.findByData({
        $and: [
          { 
            dataInicio: { 
              $lte: new Date(dataFormatada + 'T23:59:59.999Z')
            } 
          },
          { 
            dataFim: { 
              $gte: new Date(dataFormatada + 'T00:00:00.000Z')
            } 
          }
        ],
        'pagamento.status': { $ne: StatusPagamento.CANCELADO }
      });
      
      if (reservasNaData.length > 0) {
        // Se for reserva apenas de chalés, verificar disponibilidade
        if (tipo === TipoReserva.CHALE) {
          const chalesOcupados = reservasNaData.reduce((total, r) => {
            // Só contar chalés de reservas que sejam do tipo CHALE ou COMPLETO
            if (r.tipo === TipoReserva.CHALE || r.tipo === TipoReserva.COMPLETO) {
              return total + (r.quantidadeChales || 0);
            }
            return total;
          }, 0);
          
          if (chalesOcupados + quantidadeChales > config.quantidadeMaximaChales) {
            return { 
              disponivel: false, 
              motivo: `Não há ${quantidadeChales} chalés disponíveis para esta data. Restam ${config.quantidadeMaximaChales - chalesOcupados}` 
            };
          }
          
          return { disponivel: true };
        } else if (tipo === TipoReserva.BATISMO && reservasNaData.every(r => r.tipo !== TipoReserva.DIARIA && r.tipo !== TipoReserva.COMPLETO)) {
          // Permitir reserva de batismo se não houver diária na data
          return { disponivel: true };
        } else {
          // Para outros tipos, verificar se já existe reserva que ocupe o espaço todo
          const temReservaExclusiva = reservasNaData.some(r => 
            r.tipo === TipoReserva.DIARIA || r.tipo === TipoReserva.COMPLETO
          );
          
          if (temReservaExclusiva) {
            return { 
              disponivel: false, 
              motivo: 'Esta data já possui uma reserva exclusiva da chácara' 
            };
          }
          
          // Se for tipo COMPLETO, verificar disponibilidade de chalés
          if (tipo === TipoReserva.COMPLETO && quantidadeChales > 0) {
            const chalesOcupados = reservasNaData.reduce((total, r) => {
              if (r.tipo === TipoReserva.CHALE || r.tipo === TipoReserva.COMPLETO) {
                return total + (r.quantidadeChales || 0);
              }
              return total;
            }, 0);
            
            if (chalesOcupados + quantidadeChales > config.quantidadeMaximaChales) {
              return { 
                disponivel: false, 
                motivo: `Não há ${quantidadeChales} chalés disponíveis para esta data. Restam ${config.quantidadeMaximaChales - chalesOcupados}` 
              };
            }
          }
          
          return { disponivel: true };
        }
      }
      
      return { disponivel: true };
    } catch (error) {
      this.logger.error(`Erro ao verificar disponibilidade: ${error.message}`);
      throw error;
    }
  }

  private obterDescricaoTipo(tipo: string): string {
    const tipos = {
      [TipoReserva.DIARIA]: 'Diária',
      [TipoReserva.CHALE]: 'Chalé(s)',
      [TipoReserva.BATISMO]: 'Cerimônia de Batismo',
      [TipoReserva.COMPLETO]: 'Pacote Completo (Diária + Chalés)'
    };
    
    return tipos[tipo] || tipo;
  }

}