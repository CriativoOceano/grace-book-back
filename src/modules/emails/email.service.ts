import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailsService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(EmailsService.name);

  constructor(private readonly configService: ConfigService) {
    // Inicializar o transporter
    this.initializeTransporter();
  }

  private async initializeTransporter() {
    const host = this.configService.get<string>('EMAIL_HOST');
    const port = this.configService.get<number>('EMAIL_PORT');
    const user = this.configService.get<string>('EMAIL_USER');
    const pass = this.configService.get<string>('EMAIL_PASS');
    const fromEmail = this.configService.get<string>('EMAIL_FROM') || 'anderson.asp.si@gmail.com';

    // Verificar se estamos em ambiente de desenvolvimento
    const isDevMode = this.configService.get<string>('NODE_ENV') !== 'production';

    if (isDevMode) {
      // Em desenvolvimento, use um servidor de testes
      
      this.transporter = nodemailer.createTransport({
        host: 'sandbox.smtp.mailtrap.io',
        port: 587,
        secure: false,
        auth: {
          user: '7924bed52ed853',
          pass: '9d689c921d8c3a',
        },
      });

      this.logger.log('Usando servidor de email de teste (Ethereal)');
    } else if (host && port && user && pass) {
      // Em produção, use as configurações reais
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: {
          user,
          pass,
        },
      });

      this.logger.log('Servidor de email configurado para produção');
    } else {
      this.logger.warn('Configurações de email não encontradas, usando console para log de emails');
      
      // Transporter "fake" que apenas loga as mensagens
      this.transporter = {
        sendMail: async (mailOptions) => {
          this.logger.log('Email que seria enviado:');
          this.logger.log(`De: ${mailOptions.from}`);
          this.logger.log(`Para: ${mailOptions.to}`);
          this.logger.log(`Assunto: ${mailOptions.subject}`);
          this.logger.log(`Conteúdo: ${mailOptions.text || mailOptions.html}`);
          
          return {
            messageId: `fake-${Date.now()}`,
            accepted: [mailOptions.to],
            rejected: [],
            pending: [],
            response: 'Email simulado apenas para log'
          };
        },
      } as any;
    }
  }

  async enviarEmail(destinatario: string, assunto: string, texto?: string, html?: string) {
    try {
      const fromEmail = this.configService.get<string>('EMAIL_FROM') || 'reservas@chacaradaigreja.com.br';
      
      const mailOptions: nodemailer.SendMailOptions = {
        from: `"Espaço Fonte da graça" <${fromEmail}>`,
        to: destinatario,
        subject: assunto,
        text: texto,
        html: html,
      };

      // const info = await this.transporter.sendMail(mailOptions);
      const info = null;
      
      // Se estiver usando Ethereal (ambiente de desenvolvimento)
      // if (info.messageId && info.messageId.includes('ethereal')) {
      //   this.logger.log(`Email de teste enviado para ${destinatario}`);
      //   this.logger.log(`URL para visualização: ${nodemailer.getTestMessageUrl(info)}`);
      // } else {
      //   this.logger.log(`Email enviado para ${destinatario}`);
      // }
      
      return info;
    } catch (error) {
      this.logger.error(`Erro ao enviar email para ${destinatario}: ${error.message}`);
      throw new Error(`Falha ao enviar email: ${error.message}`);
    }
  }

  // Método específico para enviar código de acesso
  async enviarCodigoAcesso(destinatario: string, nome: string, codigo: string) {
    const assunto = 'Seu código de acesso - Espaço Fonte da graça';
    
    const texto = `
      Olá ${nome},
      
      Você solicitou um código de acesso para o sistema de reservas do espaço Fonte da graça.
      
      Seu código: ${codigo}
      
      Este código é válido por 2 minutos.
      
      Se você não solicitou este código, por favor ignore este email.
      
      Atenciosamente,
      Equipe Fonte da graça
    `;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #3a7d44; text-align: center;">Código de Acesso</h2>
        <p>Olá <strong>${nome}</strong>,</p>
        <p>Você solicitou um código de acesso para o sistema de reservas do espaço Fonte da graça.</p>
        <div style="background-color: #f9f9f9; padding: 15px; text-align: center; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin: 0; color: #333; font-size: 24px;">${codigo}</h3>
        </div>
        <p>Este código é válido por <strong>2 minutos</strong>.</p>
        <p style="color: #777; font-size: 12px;">Se você não solicitou este código, por favor ignore este email.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="text-align: center; color: #777; font-size: 12px;">
          Atenciosamente,<br>
          Equipe Fonte da graça
        </p>
      </div>
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
      Equipe Fonte da graça
    `;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #3a7d44; text-align: center;">Reserva Confirmada!</h2>
        <p>Olá <strong>${nome}</strong>,</p>
        <p>Sua reserva foi criada com sucesso!</p>
        
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Código da Reserva:</strong> ${codigoReserva}</p>
          <p><strong>Data:</strong> ${dataFormatada}</p>
          <p><strong>Tipo:</strong> ${tipo}</p>
          <p><strong>Valor Total:</strong> ${valorFormatado}</p>
        </div>
        
        <p>Para acessar sua reserva, utilize o código: <strong>${codigoAcesso}</strong></p>
        <p>Aguardamos seu pagamento para confirmar a reserva.</p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="text-align: center; color: #777; font-size: 12px;">
          Atenciosamente,<br>
          Equipe Fonte da graça
        </p>
      </div>
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
          ${linkPagamento ? `<p><a href="${linkPagamento}" style="background-color: #3a7d44; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px; display: inline-block;">Realizar Pagamento</a></p>` : ''}
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
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #3a7d44; text-align: center;">Atualização de Pagamento</h2>
        <p>Olá <strong>${nome}</strong>,</p>
        ${mensagem}
        <p>Código da Reserva: <strong>${codigoReserva}</strong></p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="text-align: center; color: #777; font-size: 12px;">
          Atenciosamente,<br>
          Equipe Fonte da graça
        </p>
      </div>
    `;

    const texto = html.replace(/<[^>]*>/g, '');

    return this.enviarEmail(destinatario, assunto, texto, html);
  }
}