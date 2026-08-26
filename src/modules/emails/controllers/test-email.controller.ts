import { Controller, Post, Logger, UseGuards } from '@nestjs/common';
import { EmailsService } from '../email.service';
import { ReservaEmailData } from '../templates/reserva-confirmacao.template';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('emails')
export class TestEmailController {
  private readonly logger = new Logger(TestEmailController.name);

  constructor(private readonly emailsService: EmailsService) {}

  @Post('test-admin')
  async testAdminEmail() {
    this.logger.log(
      '🧪 Testando email para administrador com cores azul abissal...',
    );

    const testData: ReservaEmailData = {
      nome: 'João Silva',
      codigoReserva: 'RES-TEST-001',
      dataInicio: '25/12/2024',
      dataFim: '27/12/2024',
      tipo: 'diaria',
      quantidadePessoas: 4,
      quantidadeChales: 2,
      quantidadeDiarias: 2,
      valorTotal: 500.0,
      statusReserva: 'CONFIRMADA',
      codigoAcesso: 'ABC123',
      observacoes: 'Teste de email para administrador com cores azul abissal',
      dadosHospede: {
        nome: 'João',
        sobrenome: 'Silva',
        email: 'joao@teste.com',
        telefone: '(11) 99999-9999',
        cpf: '123.456.789-00',
      },
    };

    try {
      const result =
        await this.emailsService.enviarEmailNotificacaoAdministrador(testData);
      this.logger.log('✅ Email de teste enviado com sucesso!');
      return {
        success: true,
        message:
          'Email de teste enviado para administrador com cores azul abissal',
        messageId: result.messageId,
      };
    } catch (error) {
      this.logger.error(`❌ Erro ao enviar email de teste: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
