import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as nodemailer from 'nodemailer';
import { getReservaConfirmacaoTemplate, ReservaEmailData, getReservaCanceladaTemplate, ReservaCanceladaEmailData } from './templates/reserva-confirmacao.template';

@Injectable()
export class EmailsService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(EmailsService.name);
  private readonly brevoApiKey: string;
  private readonly brevoApiUrl = 'https://api.brevo.com/v3/smtp/email';

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService
  ) {
    this.brevoApiKey = this.configService.get<string>('EMAIL_API_BREVO_KEY');
    // Inicializar o transporter
    this.initializeTransporter();
  }

  private initializeTransporter() {
    // Verificar se estamos em ambiente de desenvolvimento
    const isDevMode = this.configService.get<string>('NODE_ENV') !== 'production';

    if (isDevMode) {
      // Em desenvolvimento, use Mailtrap para testes
      this.transporter = nodemailer.createTransport({
        host: 'sandbox.smtp.mailtrap.io',
        port: 587,
        secure: false,
        auth: {
          user: 'cd5430442d5d88',
          pass: '2e19d5f92a71c9',
        },
      });

      this.logger.log('Usando Mailtrap para testes de email em desenvolvimento');
    } else {
      // Em produção, usar API Brevo - não inicializar transporter SMTP
      this.logger.log('Usando API Brevo para envio de emails em produção');
      
      // Verificar se a API key está configurada
      if (!this.brevoApiKey) {
        this.logger.error('❌ ERRO: EMAIL_API_BREVO_KEY não configurada em produção!');
        throw new Error('EMAIL_API_BREVO_KEY não configurada em produção. Configure a variável de ambiente EMAIL_API_BREVO_KEY');
      }
    }
  }

  /**
   * Envia email via API REST da Brevo
   */
  private async enviarEmailViaBrevoAPI(
    destinatario: string,
    assunto: string,
    html: string,
    fromEmail: string
  ): Promise<any> {
    const startTime = Date.now();
    this.logger.log(`📧 Enviando email via API Brevo para ${destinatario}`);
    
    const payload = {
      sender: {
        name: "Sede Campestre",
        email: fromEmail
      },
      to: [{ email: destinatario }],
      subject: assunto,
      htmlContent: html
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post(this.brevoApiUrl, payload, {
          headers: {
            'Content-Type': 'application/json',
            'api-key': this.brevoApiKey
          }
        })
      );

      const duration = Date.now() - startTime;
      this.logger.log(`✅ Email enviado via API Brevo para ${destinatario} em ${duration}ms`);
      this.logger.log(`📧 Message ID: ${response.data.messageId}`);
      
      return response.data;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`❌ Erro ao enviar email via API Brevo para ${destinatario} após ${duration}ms`);
      this.logger.error(`❌ Status: ${error.response?.status}`);
      this.logger.error(`❌ Status Text: ${error.response?.statusText}`);
      this.logger.error(`❌ Data: ${JSON.stringify(error.response?.data)}`);
      this.logger.error(`❌ Message: ${error.message}`);
      
      throw new Error(`Falha ao enviar email via API Brevo: ${error.message}`);
    }
  }

  /**
   * Testa a conexão com o servidor de email (apenas em desenvolvimento)
   */
  async testConnection(): Promise<boolean> {
    const isDevMode = this.configService.get<string>('NODE_ENV') !== 'production';
    
    if (!isDevMode) {
      this.logger.log('Teste de conexão não disponível em produção (usando API Brevo)');
      return true; // Assumir que está funcionando
    }
    
    try {
      await this.transporter.verify();
      this.logger.log('✅ Conexão com servidor de email verificada com sucesso');
      return true;
    } catch (error) {
      this.logger.error('❌ Erro ao verificar conexão com servidor de email:', error.message);
      return false;
    }
  }

  async enviarEmail(destinatario: string, assunto: string, texto?: string, html?: string) {
    const startTime = Date.now();
    this.logger.log(`📧 Iniciando envio de email para ${destinatario} - Assunto: ${assunto}`);
    
    // Verificar se estamos em ambiente de desenvolvimento
    const isDevMode = this.configService.get<string>('NODE_ENV') !== 'production';
    
    // Em produção, usar APENAS variável de ambiente para EMAIL_FROM
    const fromEmail = isDevMode 
      ? this.configService.get<string>('EMAIL_FROM') || 'reservas@chacaradaigreja.com.br'
      : this.configService.get<string>('EMAIL_FROM');
    
    // Em produção, se não tiver EMAIL_FROM configurado, falhar
    if (!isDevMode && !fromEmail) {
      throw new Error('EMAIL_FROM não configurado em produção. Configure a variável de ambiente EMAIL_FROM');
    }
    
    if (!isDevMode) {
      // Usar API Brevo em produção
      this.logger.log(`📧 Usando API Brevo para envio em produção`);
      return this.enviarEmailViaBrevoAPI(destinatario, assunto, html || '', fromEmail);
    } else {
      // Usar SMTP (Mailtrap) em desenvolvimento
      this.logger.log(`📧 Usando SMTP (Mailtrap) para envio em desenvolvimento`);
      
      const mailOptions: nodemailer.SendMailOptions = {
        from: `"Sede Campestre" <${fromEmail}>`,
        to: destinatario,
        subject: assunto,
        text: texto,
        html: html,
      };

      this.logger.log(`📧 Enviando email via transporter...`);
      const info = await this.transporter.sendMail(mailOptions);
      
      const duration = Date.now() - startTime;
      
      // Se estiver usando Mailtrap (ambiente de desenvolvimento)
      if (info.messageId && info.messageId.includes('sandbox')) {
        this.logger.log(`✅ Email de teste enviado para ${destinatario} em ${duration}ms`);
        this.logger.log(`📧 Message ID: ${info.messageId}`);
      } else {
        this.logger.log(`✅ Email enviado para ${destinatario} em ${duration}ms`);
        this.logger.log(`📧 Message ID: ${info.messageId}`);
      }
      
      return info;
    }
  }

  // Método específico para enviar código de acesso
  async enviarCodigoAcesso(destinatario: string, nome: string, codigo: string) {
    const assunto = 'Seu código de acesso - Sede Campestre';
    
    const texto = `
      Olá ${nome},
      
      Você solicitou um código de acesso para o sistema de reservas do espaço Sede Campestre.
      
      Seu código: ${codigo}
      
      Este código é válido por 2 minutos.
      
      Se você não solicitou este código, por favor ignore este email.
      
      Atenciosamente,
      Equipe Sede Campestre
    `;

    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Código de Acesso - Sede Campestre</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #F6EBD9; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #FAFAFA; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 32px rgba(10, 38, 71, 0.15);">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #0A2647 0%, #4E944F 100%); padding: 40px 30px; text-align: center;">
            <h1 style="color: #FAFAFA; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: 1px;">Sede Campestre</h1>
            <p style="color: #F6EBD9; margin: 8px 0 0 0; font-size: 16px; font-weight: 300;">Sistema de Reservas</p>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 30px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="background-color: #CBA135; width: 60px; height: 60px; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                <span style="color: #FAFAFA; font-size: 24px; font-weight: bold;">🔐</span>
              </div>
              <h2 style="color: #0A2647; margin: 0 0 10px 0; font-size: 24px; font-weight: 600;">Código de Acesso</h2>
              <p style="color: #666; margin: 0; font-size: 16px; line-height: 1.5;">Olá <strong style="color: #0A2647;">${nome}</strong>, você solicitou um código de acesso para o sistema de reservas.</p>
            </div>
            
            <!-- Code Box -->
            <div style="background: linear-gradient(135deg, #F6EBD9 0%, #FAFAFA 100%); border: 2px solid #CBA135; border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0;">
              <p style="color: #0A2647; margin: 0 0 15px 0; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Seu Código</p>
              <div style="background-color: #0A2647; color: #FAFAFA; font-size: 32px; font-weight: 700; letter-spacing: 4px; padding: 20px; border-radius: 8px; font-family: 'Courier New', monospace;">${codigo}</div>
            </div>
            
            <!-- Info -->
            <div style="background-color: #F6EBD9; border-left: 4px solid #4E944F; padding: 20px; border-radius: 0 8px 8px 0; margin: 30px 0;">
              <p style="color: #0A2647; margin: 0 0 10px 0; font-size: 16px; font-weight: 600;">⏰ Válido por 2 minutos</p>
              <p style="color: #666; margin: 0; font-size: 14px; line-height: 1.4;">Este código expira automaticamente após 2 minutos por motivos de segurança.</p>
            </div>
            
            <!-- Warning -->
            <div style="background-color: #FFF3CD; border: 1px solid #CBA135; border-radius: 8px; padding: 15px; margin: 20px 0;">
              <p style="color: #856404; margin: 0; font-size: 14px; text-align: center;">⚠️ Se você não solicitou este código, por favor ignore este email.</p>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #0A2647; padding: 30px; text-align: center;">
            <p style="color: #F6EBD9; margin: 0 0 10px 0; font-size: 16px; font-weight: 600;">Equipe Sede Campestre</p>
            <p style="color: #D9D9D9; margin: 0; font-size: 14px;">Atenciosamente, nossa equipe está sempre à sua disposição.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.enviarEmail(destinatario, assunto, texto, html);
  }

  // Método para enviar confirmação de reserva
  async enviarConfirmacaoReserva(
    destinatario: string, 
    nome: string, 
    codigoReserva: string, 
    data: Date, 
    tipo: string,
    valor: number,
    codigoAcesso: string
  ) {
    const assunto = `Reserva ${codigoReserva} criada com sucesso`;
    
    const dataFormatada = new Date(data).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    
    const valorFormatado = valor.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
    
    const texto = `
      Olá ${nome},
      
      Sua reserva foi criada com sucesso!
      
      Código da Reserva: ${codigoReserva}
      Data: ${dataFormatada}
      Tipo: ${tipo}
      Valor Total: ${valorFormatado}
      
      Para acessar sua reserva, utilize o código: ${codigoAcesso}
      
      Aguardamos seu pagamento para confirmar a reserva.
      
      Atenciosamente,
      Equipe Sede Campestre
    `;

    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reserva Confirmada - Sede Campestre</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #F6EBD9; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #FAFAFA; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 32px rgba(10, 38, 71, 0.15);">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #0A2647 0%, #4E944F 100%); padding: 40px 30px; text-align: center;">
            <h1 style="color: #FAFAFA; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: 1px;">Sede Campestre</h1>
            <p style="color: #F6EBD9; margin: 8px 0 0 0; font-size: 16px; font-weight: 300;">Sistema de Reservas</p>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 30px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="background-color: #4E944F; width: 80px; height: 80px; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                <span style="color: #FAFAFA; font-size: 32px;">✅</span>
              </div>
              <h2 style="color: #0A2647; margin: 0 0 10px 0; font-size: 24px; font-weight: 600;">Reserva Confirmada!</h2>
              <p style="color: #666; margin: 0; font-size: 16px; line-height: 1.5;">Olá <strong style="color: #0A2647;">${nome}</strong>, sua reserva foi criada com sucesso!</p>
            </div>
            
            <!-- Reservation Details -->
            <div style="background: linear-gradient(135deg, #F6EBD9 0%, #FAFAFA 100%); border: 2px solid #CBA135; border-radius: 12px; padding: 30px; margin: 30px 0;">
              <h3 style="color: #0A2647; margin: 0 0 20px 0; font-size: 18px; font-weight: 600; text-align: center;">📋 Detalhes da Reserva</h3>
              
              <div style="display: grid; gap: 15px;">
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #D9D9D9;">
                  <span style="color: #666; font-weight: 600;">Código:</span>
                  <span style="color: #0A2647; font-weight: 700; font-family: 'Courier New', monospace;">${codigoReserva}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #D9D9D9;">
                  <span style="color: #666; font-weight: 600;">Data:</span>
                  <span style="color: #0A2647; font-weight: 600;">${dataFormatada}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #D9D9D9;">
                  <span style="color: #666; font-weight: 600;">Tipo:</span>
                  <span style="color: #0A2647; font-weight: 600;">${tipo}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0;">
                  <span style="color: #666; font-weight: 600;">Valor Total:</span>
                  <span style="color: #CBA135; font-weight: 700; font-size: 18px;">${valorFormatado}</span>
                </div>
              </div>
            </div>
            
            <!-- Access Code -->
            <div style="background-color: #0A2647; border-radius: 12px; padding: 25px; text-align: center; margin: 30px 0;">
              <p style="color: #F6EBD9; margin: 0 0 15px 0; font-size: 16px; font-weight: 600;">🔑 Código de Acesso</p>
              <div style="background-color: #FAFAFA; color: #0A2647; font-size: 24px; font-weight: 700; letter-spacing: 2px; padding: 15px; border-radius: 8px; font-family: 'Courier New', monospace;">${codigoAcesso}</div>
              <p style="color: #D9D9D9; margin: 15px 0 0 0; font-size: 14px;">Use este código para consultar sua reserva</p>
            </div>
            
            <!-- Payment Info -->
            <div style="background-color: #FFF3CD; border: 1px solid #CBA135; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <p style="color: #856404; margin: 0; font-size: 16px; font-weight: 600; text-align: center;">💳 Aguardando Pagamento</p>
              <p style="color: #856404; margin: 10px 0 0 0; font-size: 14px; text-align: center;">Para garantir sua reserva, efetue o pagamento o mais breve possível.</p>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #0A2647; padding: 30px; text-align: center;">
            <p style="color: #F6EBD9; margin: 0 0 10px 0; font-size: 16px; font-weight: 600;">Equipe Sede Campestre</p>
            <p style="color: #D9D9D9; margin: 0; font-size: 14px;">Atenciosamente, nossa equipe está sempre à sua disposição.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.enviarEmail(destinatario, assunto, texto, html);
  }

  // Método para enviar notificação de status de pagamento
  async enviarNotificacaoPagamento(
    destinatario: string, 
    nome: string, 
    codigoReserva: string, 
    status: string,
    linkPagamento?: string
  ) {
    this.logger.log(`📧 Iniciando envio de notificação de pagamento - Status: ${status}, Reserva: ${codigoReserva}, Destinatário: ${destinatario}`);
    
    let assunto = '';
    let mensagem = '';
    
    switch (status) {
      case 'pago':
        assunto = `Pagamento Confirmado - Reserva ${codigoReserva}`;
        mensagem = `
          <p>O pagamento da sua reserva foi <strong style="color: #3a7d44;">confirmado</strong>!</p>
          <p>Sua reserva está garantida e você não precisa realizar mais nenhuma ação.</p>
        `;
        break;
      case 'pendente':
        assunto = `Pagamento Pendente - Reserva ${codigoReserva}`;
        mensagem = `
          <p>O pagamento da sua reserva está <strong style="color: #f0c929;">pendente</strong>.</p>
          <p>Para garantir sua reserva, efetue o pagamento o mais breve possível.</p>
          ${linkPagamento ? `<p><a href="${linkPagamento}" style="background: linear-gradient(135deg, #CBA135 0%, #D4A843 100%); color: #FAFAFA; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 15px rgba(203, 161, 53, 0.3); margin-top: 15px;">💳 Realizar Pagamento</a></p>` : ''}
        `;
        break;
      case 'cancelado':
        assunto = `Pagamento Cancelado - Reserva ${codigoReserva}`;
        mensagem = `
          <p>O pagamento da sua reserva foi <strong style="color: #d9534f;">cancelado</strong>.</p>
          <p>Se você ainda deseja realizar esta reserva, entre em contato conosco.</p>
        `;
        break;
      default:
        assunto = `Atualização de Pagamento - Reserva ${codigoReserva}`;
        mensagem = `
          <p>Houve uma atualização no status do pagamento da sua reserva.</p>
          <p>Status atual: <strong>${status}</strong></p>
        `;
    }

    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Atualização de Pagamento - Sede Campestre</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #FAFAFA; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 32px rgba(10, 38, 71, 0.15);">
          
          <!-- Header -->
          <div style="background: #0A2647; padding: 40px 30px; text-align: center;">
            <h1 style="color: #FAFAFA; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: 1px;">Sede Campestre</h1>
            <p style="color: #F6EBD9; margin: 8px 0 0 0; font-size: 16px; font-weight: 300;">Sistema de Reservas</p>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 30px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="background-color: ${status === 'pago' ? '#4E944F' : status === 'pendente' ? '#CBA135' : '#D9534F'}; width: 80px; height: 80px; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                <span style="color: #FAFAFA; font-size: 32px;">${status === 'pago' ? '✅' : status === 'pendente' ? '⏳' : '❌'}</span>
              </div>
              <h2 style="color: #0A2647; margin: 0 0 10px 0; font-size: 24px; font-weight: 600;">Atualização de Pagamento</h2>
              <p style="color: #666; margin: 0; font-size: 16px; line-height: 1.5;">Olá <strong style="color: #0A2647;">${nome}</strong>, houve uma atualização no status do seu pagamento.</p>
            </div>
            
            <!-- Status Card -->
            <div style="background: linear-gradient(135deg, ${status === 'pago' ? '#4E944F' : status === 'pendente' ? '#CBA135' : '#D9534F'} 0%, ${status === 'pago' ? '#5BA85B' : status === 'pendente' ? '#D4A843' : '#E74C3C'} 100%); border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0;">
              <h3 style="color: #FAFAFA; margin: 0 0 15px 0; font-size: 20px; font-weight: 700; text-transform: uppercase;">${status === 'pago' ? 'Pagamento Confirmado' : status === 'pendente' ? 'Pagamento Pendente' : 'Pagamento Cancelado'}</h3>
              <p style="color: #FAFAFA; margin: 0; font-size: 16px; font-weight: 300;">Reserva ${codigoReserva}</p>
            </div>
            
            <!-- Message -->
            <div style="background-color: #F6EBD9; border-left: 4px solid ${status === 'pago' ? '#4E944F' : status === 'pendente' ? '#CBA135' : '#D9534F'}; padding: 25px; border-radius: 0 8px 8px 0; margin: 30px 0;">
              ${mensagem}
            </div>
            
            ${linkPagamento ? `
            <!-- Payment Button -->
            <div style="text-align: center; margin: 30px 0;">
              <a href="${linkPagamento}" style="background: linear-gradient(135deg, #CBA135 0%, #D4A843 100%); color: #FAFAFA; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 15px rgba(203, 161, 53, 0.3);">💳 Realizar Pagamento</a>
            </div>
            ` : ''}
            
            <!-- Reservation Info -->
            <div style="background-color: #0A2647; border-radius: 12px; padding: 25px; text-align: center; margin: 30px 0;">
              <p style="color: #F6EBD9; margin: 0 0 10px 0; font-size: 16px; font-weight: 600;">📋 Código da Reserva</p>
              <div style="background-color: #FAFAFA; color: #0A2647; font-size: 20px; font-weight: 700; letter-spacing: 2px; padding: 12px; border-radius: 8px; font-family: 'Courier New', monospace;">${codigoReserva}</div>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #0A2647; padding: 30px; text-align: center;">
            <p style="color: #F6EBD9; margin: 0 0 10px 0; font-size: 16px; font-weight: 600;">Equipe Sede Campestre</p>
            <p style="color: #D9D9D9; margin: 0; font-size: 14px;">Atenciosamente, nossa equipe está sempre à sua disposição.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const texto = html.replace(/<[^>]*>/g, '');

    this.logger.log(`📧 Preparando envio de email de notificação de pagamento - Assunto: ${assunto}`);
    return this.enviarEmail(destinatario, assunto, texto, html);
  }

  // Método para enviar email quando reserva é criada
  async enviarEmailReservaCriada(reservaData: ReservaEmailData, linkPagamento?: string): Promise<any> {
    const emailData: ReservaEmailData = {
      ...reservaData,
      linkPagamento
    };

    const assunto = `Reserva ${reservaData.codigoReserva} criada - Aguardando Pagamento`;
    const html = getReservaConfirmacaoTemplate(emailData, 'criada');
    
    // Texto simples para clientes que não suportam HTML
    const texto = `
      Olá ${reservaData.nome},
      
      Sua reserva foi criada com sucesso!
      
      Código da Reserva: ${reservaData.codigoReserva}
      Tipo: ${reservaData.tipo}
      Data: ${reservaData.dataInicio} a ${reservaData.dataFim}
      Valor Total: R$ ${reservaData.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
      
      Para garantir sua reserva, efetue o pagamento o mais breve possível.
      Use o código de acesso ${reservaData.codigoAcesso} para consultar sua reserva.
      
      ${linkPagamento ? `Link para pagamento: ${linkPagamento}` : ''}
      
      Atenciosamente,
      Equipe Sede Campestre
    `;

    return this.enviarEmail(reservaData.dadosHospede?.email || '', assunto, texto, html);
  }

  // Método para enviar email quando pagamento é confirmado
  async enviarEmailReservaConfirmada(reservaData: ReservaEmailData): Promise<any> {
    const assunto = `Pagamento Confirmado - Reserva ${reservaData.codigoReserva}`;
    const html = getReservaConfirmacaoTemplate(reservaData, 'confirmada');
    
    // Texto simples para clientes que não suportam HTML
    const texto = `
      Olá ${reservaData.nome},
      
      Seu pagamento foi confirmado com sucesso!
      
      Código da Reserva: ${reservaData.codigoReserva}
      Tipo: ${reservaData.tipo}
      Data: ${reservaData.dataInicio} a ${reservaData.dataFim}
      Valor Total: R$ ${reservaData.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
      
      Sua reserva está garantida e você não precisa realizar mais nenhuma ação.
      Use o código de acesso ${reservaData.codigoAcesso} para consultar sua reserva.
      
      Aguardamos sua presença!
      
      Atenciosamente,
      Equipe Sede Campestre
    `;

    return this.enviarEmail(reservaData.dadosHospede?.email || '', assunto, texto, html);
  }

  // Método para enviar email de reserva cancelada
  async enviarReservaCancelada(reservaData: ReservaCanceladaEmailData) {
    const assunto = `Reserva Cancelada - ${reservaData.codigoReserva}`;
    
    const html = getReservaCanceladaTemplate(reservaData);
    
    const texto = `
      Reserva Cancelada - ${reservaData.codigoReserva}
      
      Olá ${reservaData.nome},
      
      Sua reserva foi cancelada. Abaixo estão os detalhes:
      
      Código da Reserva: ${reservaData.codigoReserva}
      Tipo: ${reservaData.tipo}
      Data de Início: ${reservaData.dataInicio}
      Data de Fim: ${reservaData.dataFim}
      Quantidade de Pessoas: ${reservaData.quantidadePessoas}
      ${reservaData.quantidadeChales > 0 ? `Quantidade de Chalés: ${reservaData.quantidadeChales}` : ''}
      Valor Total: R$ ${reservaData.valorTotal.toFixed(2)}
      
      ${reservaData.motivoCancelamento ? `Motivo do Cancelamento: ${reservaData.motivoCancelamento}` : ''}
      
      Se você cancelou por engano ou precisa de ajuda, entre em contato conosco:
      
      📞 Telefone: (11) 99999-9999
      📧 Email: contato@oceanodagraca.com
      
      Atenciosamente,
      Equipe Sede Campestre
    `;

    return this.enviarEmail(reservaData.dadosHospede?.email || '', assunto, texto, html);
  }

  // Método para enviar email de cancelamento de reserva
  async enviarEmailCancelamento(reserva: any, motivo: string, estorno?: any) {
    const assunto = `Reserva Cancelada - ${reserva.codigo}`;
    
    const html = getReservaCanceladaTemplate({
      codigoReserva: reserva.codigo,
      nome: reserva.usuarioNome,
      tipo: reserva.tipo,
      dataInicio: reserva.dataInicio,
      dataFim: reserva.dataFim,
      quantidadePessoas: reserva.quantidadePessoas,
      quantidadeChales: reserva.quantidadeChales,
      quantidadeDiarias: reserva.quantidadeDiarias || 0,
      valorTotal: reserva.valorTotal,
      motivoCancelamento: motivo,
      dadosHospede: reserva.dadosHospede
    });
    
    const texto = `
      Reserva Cancelada - ${reserva.codigo}
      
      Olá ${reserva.usuarioNome},
      
      Sua reserva foi cancelada. Abaixo estão os detalhes:
      
      Código da Reserva: ${reserva.codigo}
      Tipo: ${reserva.tipo}
      Data de Início: ${reserva.dataInicio}
      Data de Fim: ${reserva.dataFim}
      Quantidade de Pessoas: ${reserva.quantidadePessoas}
      ${reserva.quantidadeChales > 0 ? `Quantidade de Chalés: ${reserva.quantidadeChales}` : ''}
      Valor Total: R$ ${reserva.valorTotal.toFixed(2)}
      
      Motivo do Cancelamento: ${motivo}
      
      ${estorno ? `Valor do Estorno: R$ ${estorno.valor?.toFixed(2) || '0,00'}` : ''}
      
      Se você cancelou por engano ou precisa de ajuda, entre em contato conosco:
      
      📞 Telefone: (11) 99999-9999
      📧 Email: contato@oceanodagraca.com
      
      Atenciosamente,
      Equipe Sede Campestre
    `;

    return this.enviarEmail(reserva.usuarioEmail, assunto, texto, html);
  }

  // Método para enviar email de notificação para o administrador quando uma reserva é confirmada
  async enviarEmailNotificacaoAdministrador(reservaData: ReservaEmailData): Promise<any> {
    this.logger.log(`📧 Iniciando envio de email para administrador - Reserva: ${reservaData.codigoReserva}`);
    
    const assunto = `Nova Reserva Confirmada - ${reservaData.codigoReserva}`;
    
    // Formatar valor para exibição
    const valorFormatado = reservaData.valorTotal.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });

    // Determinar status do pagamento baseado no status da reserva
    const statusPagamento = reservaData.statusReserva === 'CONFIRMADA' ? 'PAGO E CONFIRMADO' : 'PENDENTE';
    
    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Nova Reserva Confirmada - Administração</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #FAFAFA; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 32px rgba(10, 38, 71, 0.15);">
          
          <!-- Header -->
          <div style="background: #0A2647; padding: 40px 30px; text-align: center;">
            <h1 style="color: #FAFAFA; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: 1px;">Oceano da Graça</h1>
            <p style="color: #E6F3FF; margin: 8px 0 0 0; font-size: 16px; font-weight: 300;">Sede Campestre - Notificação Administrativa</p>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 30px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="background: #0A2647; width: 80px; height: 80px; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                <span style="color: #FAFAFA; font-size: 32px;">📋</span>
              </div>
              <h2 style="color: #001122; margin: 0 0 10px 0; font-size: 24px; font-weight: 600;">Nova Reserva Confirmada!</h2>
              <p style="color: #666; margin: 0; font-size: 16px; line-height: 1.5;">Uma nova reserva foi confirmada e está pronta para uso.</p>
            </div>
            
            <!-- Reservation Details -->
            <div style="background: linear-gradient(135deg, #E6F3FF 0%, #F0F8FF 100%); border: 2px solid #001122; border-radius: 12px; padding: 30px; margin: 30px 0;">
              <h3 style="color: #001122; margin: 0 0 20px 0; font-size: 18px; font-weight: 600; text-align: center;">📋 Detalhes da Reserva</h3>
              
              <div style="display: grid; gap: 15px;">
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #D9D9D9;">
                  <span style="color: #666; font-weight: 600;">Código:</span>
                  <span style="color: #001122; font-weight: 700; font-family: 'Courier New', monospace;">${reservaData.codigoReserva}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #D9D9D9;">
                  <span style="color: #666; font-weight: 600;">Cliente:</span>
                  <span style="color: #001122; font-weight: 600;">${reservaData.nome}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #D9D9D9;">
                  <span style="color: #666; font-weight: 600;">Tipo:</span>
                  <span style="color: #001122; font-weight: 600;">${reservaData.tipo}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #D9D9D9;">
                  <span style="color: #666; font-weight: 600;">Período:</span>
                  <span style="color: #001122; font-weight: 600;">${reservaData.dataInicio} a ${reservaData.dataFim}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #D9D9D9;">
                  <span style="color: #666; font-weight: 600;">Pessoas:</span>
                  <span style="color: #001122; font-weight: 600;">${reservaData.quantidadePessoas}</span>
                </div>
                ${reservaData.quantidadeChales > 0 ? `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #D9D9D9;">
                  <span style="color: #666; font-weight: 600;">Chalés:</span>
                  <span style="color: #001122; font-weight: 600;">${reservaData.quantidadeChales}</span>
                </div>
                ` : ''}
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #D9D9D9;">
                  <span style="color: #666; font-weight: 600;">Diárias:</span>
                  <span style="color: #001122; font-weight: 600;">${reservaData.quantidadeDiarias}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0;">
                  <span style="color: #666; font-weight: 600;">Valor Total:</span>
                  <span style="color: #001122; font-weight: 700; font-size: 18px;">${valorFormatado}</span>
                </div>
              </div>
            </div>
            
            <!-- Payment Status -->
            <div style="background: #4E944F; border-radius: 12px; padding: 25px; text-align: center; margin: 30px 0;">
              <h3 style="color: #FAFAFA; margin: 0 0 15px 0; font-size: 18px; font-weight: 600;">💳 Status do Pagamento</h3>
              <div style="background-color: #FAFAFA; color: #4E944F; font-size: 16px; font-weight: 700; padding: 15px; border-radius: 8px;">${statusPagamento}</div>
            </div>
            
            <!-- Guest Information -->
            ${reservaData.dadosHospede ? `
            <div style="background-color: #E6F3FF; border-left: 4px solid #001122; padding: 25px; border-radius: 0 8px 8px 0; margin: 30px 0;">
              <h3 style="color: #001122; margin: 0 0 15px 0; font-size: 16px; font-weight: 600;">👤 Informações do Hóspede</h3>
              <div style="color: #666; font-size: 14px; line-height: 1.6;">
                ${reservaData.dadosHospede.nome ? `<p><strong>Nome:</strong> ${reservaData.dadosHospede.nome} ${reservaData.dadosHospede.sobrenome || ''}</p>` : ''}
                ${reservaData.dadosHospede.email ? `<p><strong>Email:</strong> ${reservaData.dadosHospede.email}</p>` : ''}
                ${reservaData.dadosHospede.telefone ? `<p><strong>Telefone:</strong> ${reservaData.dadosHospede.telefone}</p>` : ''}
                ${reservaData.dadosHospede.cpf ? `<p><strong>CPF:</strong> ${reservaData.dadosHospede.cpf}</p>` : ''}
              </div>
            </div>
            ` : ''}
            
            <!-- Observations -->
            ${reservaData.observacoes ? `
            <div style="background-color: #FFF3CD; border: 1px solid #001122; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #001122; margin: 0 0 10px 0; font-size: 16px; font-weight: 600;">📝 Observações</h3>
              <p style="color: #001122; margin: 0; font-size: 14px; line-height: 1.4;">${reservaData.observacoes}</p>
            </div>
            ` : ''}
            
            <!-- Action Required -->
            <div style="background-color: #E6F3FF; border: 1px solid #001122; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <p style="color: #001122; margin: 0; font-size: 16px; font-weight: 600; text-align: center;">✅ Reserva Confirmada e Pronta para Uso</p>
              <p style="color: #001122; margin: 10px 0 0 0; font-size: 14px; text-align: center;">Esta reserva foi confirmada e o pagamento foi processado com sucesso.</p>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="background: #0A2647; padding: 30px; text-align: center;">
            <p style="color: #FAFAFA; margin: 0 0 10px 0; font-size: 16px; font-weight: 600;">Sistema de Reservas - Oceano da Graça</p>
            <p style="color: #B3D9FF; margin: 0; font-size: 14px;">Notificação automática enviada em ${new Date().toLocaleString('pt-BR')}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Texto simples para clientes que não suportam HTML
    const texto = `
      NOVA RESERVA CONFIRMADA - ${reservaData.codigoReserva}
      
      Uma nova reserva foi confirmada e está pronta para uso.
      
      DETALHES DA RESERVA:
      Código: ${reservaData.codigoReserva}
      Cliente: ${reservaData.nome}
      Tipo: ${reservaData.tipo}
      Período: ${reservaData.dataInicio} a ${reservaData.dataFim}
      Quantidade de Pessoas: ${reservaData.quantidadePessoas}
      ${reservaData.quantidadeChales > 0 ? `Quantidade de Chalés: ${reservaData.quantidadeChales}` : ''}
      Quantidade de Diárias: ${reservaData.quantidadeDiarias}
      Valor Total: ${valorFormatado}
      
      STATUS DO PAGAMENTO: ${statusPagamento}
      
      ${reservaData.dadosHospede ? `
      INFORMAÇÕES DO HÓSPEDE:
      ${reservaData.dadosHospede.nome ? `Nome: ${reservaData.dadosHospede.nome} ${reservaData.dadosHospede.sobrenome || ''}` : ''}
      ${reservaData.dadosHospede.email ? `Email: ${reservaData.dadosHospede.email}` : ''}
      ${reservaData.dadosHospede.telefone ? `Telefone: ${reservaData.dadosHospede.telefone}` : ''}
      ${reservaData.dadosHospede.cpf ? `CPF: ${reservaData.dadosHospede.cpf}` : ''}
      ` : ''}
      
      ${reservaData.observacoes ? `OBSERVAÇÕES: ${reservaData.observacoes}` : ''}
      
      Esta reserva foi confirmada e o pagamento foi processado com sucesso.
      
      Sistema de Reservas - Sede Campestre
      Notificação automática enviada em ${new Date().toLocaleString('pt-BR')}
    `;

    return this.enviarEmail('administrativo@oceanodagraca.com', assunto, texto, html);
  }
}