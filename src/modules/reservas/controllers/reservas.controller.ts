import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { ReservasService } from '../reservar.service';
import { AdminGuard } from 'src/modules/auth/guards/admin.guard';
import { CreateReservaDto } from '../DTO/create-reserva.dto';
import { UpdateReservaDto } from '../DTO/update-reserva.dto';
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

  @Post('publico-debug')
  createPublicoDebug(@Body() createReservaDto: CreateReservaDto) {
    return this.reservasService.createPublicoDebug(createReservaDto);
  }

  @Post('cotar')
  @UseGuards(JwtAuthGuard)
  cotarReserva(@Body() createReservaDto: CreateReservaDto, @Request() req) {
    return this.calcularReservaService.getValorReserva(createReservaDto);
  }

  @Post('cotar-publico')
  cotarReservaPublico(@Body() createReservaDto: CreateReservaDto) {
    return this.calcularReservaService.getValorReserva(createReservaDto);
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

    if (reserva.usuario['_id'].toString() !== req.user.id && !req.user.isAdmin) {
      throw new BadRequestException(
        `Você não tem permissão para acessar esta reserva`,
      );
    }

    return reserva;
  }

  @Get('codigo/:codigo')
  findByCodigo(@Param('codigo') codigo: string) {
    return this.reservaRepository.findByCodigo(codigo);
  }

  @Post('consultar')
  consultarReserva(@Body() body: { codigo: string; email: string }) {
    return this.reservaRepository.findByCodigoAndEmail(body.codigo, body.email);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  update(
    @Param('id') id: string,
    @Body() updateReservaDto: UpdateReservaDto,
    @Request() req,
  ) {
    // return this.reservasService.update(id, updateReservaDto, req.user.id);
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
    @Body() dadosCancelamento: { motivo: string; estornarPagamento?: boolean; valorEstorno?: number },
  ) {
    return this.reservasService.cancelarReservaComEstorno(
      id,
      dadosCancelamento.motivo,
      dadosCancelamento.estornarPagamento || false,
      dadosCancelamento.valorEstorno
    );
  }

  @Post('disponibilidade')
  async verificarDisponibilidade(@Body() verificarDto: VerificarDisponibilidadeDto) {
    const disponivel = await this.reservasService.verificarDisponibilidade(verificarDto);
    return {
      disponivel,
      mensagem: disponivel ? 'Período disponível!' : 'Período indisponível. Tente outras datas.'
    };
  }
}
