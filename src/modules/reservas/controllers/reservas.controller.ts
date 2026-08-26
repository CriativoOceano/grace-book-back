import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { ReservasService } from '../reservar.service';
import { AdminGuard } from 'src/modules/auth/guards/admin.guard';
import { CreateReservaDto } from '../DTO/create-reserva.dto';
import { CotarReservaDto } from '../DTO/cotar-reserva.dto';
import { VerificarDisponibilidadeDto } from '../DTO/verificar-disponibilidade.dto';
import { ReservaRepository } from '../repositories/reserva.repository';
import { CalculoReservaService } from 'src/modules/shared/services/reservaProcesso/calcular-reserva.service';

@Controller('reservas')
export class ReservasController {
  constructor(
    private readonly reservasService: ReservasService,
    private readonly calcularReservaService: CalculoReservaService,
    private readonly reservaRepository: ReservaRepository,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() createReservaDto: CreateReservaDto, @Request() req) {
    return this.reservasService.create(createReservaDto, req.user.id);
  }

  @Post('publico')
  createPublico(@Body() createReservaDto: CreateReservaDto) {
    return this.reservasService.createPublico(createReservaDto);
  }

  // Removida de propósito: POST /reservas/publico-debug expunha
  // ReservasService.createPublicoDebug()/createDebug(), que pula
  // verificação de disponibilidade e validações de segurança — não pode
  // existir como rota pública em produção. Os métodos de serviço
  // correspondentes ficaram órfãos e podem ser removidos de
  // reservar.service.ts.

  @Post('cotar')
  @UseGuards(JwtAuthGuard)
  cotarReserva(@Body() cotarReservaDto: CotarReservaDto, @Request() req) {
    return this.calcularReservaService.getValorReserva(cotarReservaDto);
  }

  @Post('cotar-publico')
  cotarReservaPublico(@Body() cotarReservaDto: CotarReservaDto) {
    return this.calcularReservaService.getValorReserva(cotarReservaDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, AdminGuard)
  findAll() {
    return this.reservaRepository.findAll();
  }

  @Get('minhas')
  @UseGuards(JwtAuthGuard)
  findByUser(@Request() req) {
    return this.reservaRepository.findByUser(req.user.id);
  }

  @Get('confirmadas')
  getReservasConfirmadas() {
    return this.reservaRepository.findReservasConfirmadas();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findById(@Param('id') id: string, @Request() req) {
    const reserva = await this.reservaRepository.findById(id);

    if (!reserva) {
      throw new BadRequestException(`Reserva não encontrada`);
    }

    if (
      reserva.usuario['_id'].toString() !== req.user.id &&
      !req.user.isAdmin
    ) {
      throw new BadRequestException(
        `Você não tem permissão para acessar esta reserva`,
      );
    }

    return reserva;
  }

  // Pública de propósito (usada na tela de retorno do checkout do Asaas,
  // antes de sabermos o e-mail do hóspede) — por isso devolve só um resumo
  // sem dados do hóspede. Ver ReservaRepository.findByCodigoPublico.
  @Get('codigo/:codigo')
  findByCodigo(@Param('codigo') codigo: string) {
    return this.reservaRepository.findByCodigoPublico(codigo);
  }

  @Post('consultar')
  consultarReserva(@Body() body: { codigo: string; email: string }) {
    return this.reservaRepository.findByCodigoAndEmail(body.codigo, body.email);
  }

  @Get(':id/detalhes')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getDetalhesReserva(@Param('id') id: string) {
    return this.reservasService.getDetalhesReserva(id);
  }

  @Post(':id/cancelar')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async cancelarReserva(
    @Param('id') id: string,
    @Body()
    dadosCancelamento: {
      motivo: string;
      estornarPagamento?: boolean;
      valorEstorno?: number;
    },
    @Request() req,
  ) {
    return this.reservasService.cancelarReservaComEstorno(
      id,
      dadosCancelamento.motivo,
      dadosCancelamento.estornarPagamento || false,
      dadosCancelamento.valorEstorno,
      req.user.nome,
    );
  }

  @Post('disponibilidade')
  async verificarDisponibilidade(
    @Body() verificarDto: VerificarDisponibilidadeDto,
  ) {
    const disponivel =
      await this.reservasService.verificarDisponibilidade(verificarDto);
    return {
      disponivel,
      mensagem: disponivel
        ? 'Período disponível!'
        : 'Período indisponível. Tente outras datas.',
    };
  }
}
