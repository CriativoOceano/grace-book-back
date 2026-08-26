import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import {
  getReservaConfirmacaoTemplate,
  ReservaEmailData,
  getReservaCanceladaTemplate,
  ReservaCanceladaEmailData,
} from './templates/reserva-confirmacao.template';
import {
  CORES,
  renderEmailShell,
  renderInfoRow,
  renderInfoCard,
  renderButton,
  renderParagraph,
} from './email-components';

@Injectable()
export class EmailsService {
  private readonly logger = new Logger(EmailsService.name);
  private readonly resend: Resend;
  private readonly fromEmail: string;
  private readonly frontendUrl: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    if (!apiKey) {
      throw new Error(
        'RESEND_API_KEY não configurada. Crie uma em https://resend.com/api-keys e defina a variável de ambiente RESEND_API_KEY.',
      );
    }
    this.resend = new Resend(apiKey);

    const isDevMode =
      this.configService.get<string>('NODE_ENV') !== 'production';
    // Em produção o remetente precisa ser de um domínio verificado no
    // Resend — sem EMAIL_FROM configurado, falha ao subir em vez de
    // silenciosamente usar um remetente que o Resend vai rejeitar. Em dev,
    // cai no remetente de sandbox do próprio Resend (não exige domínio
    // verificado, mas só entrega pro email da conta dona da API key).
    const emailFromConfigurado = this.configService.get<string>('EMAIL_FROM');
    if (!isDevMode && !emailFromConfigurado) {
      throw new Error(
        'EMAIL_FROM não configurado em produção. Configure a variável de ambiente EMAIL_FROM com um remetente do domínio verificado no Resend.',
      );
    }
    this.fromEmail = emailFromConfigurado || 'onboarding@resend.dev';
    this.frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ||
      'http://localhost:4200';

    this.logger.log(
      `Envio de email via Resend configurado (remetente: ${this.fromEmail})`,
    );
  }

  /**
   * Confere se a API key do Resend está configurada. O SDK não expõe um
   * "verify" de conexão como o nodemailer (é uma chamada HTTP simples por
   * envio, não uma sessão persistente), então aqui só validamos a
   * configuração local.
   */
  async testConnection(): Promise<boolean> {
    return Boolean(this.configService.get<string>('RESEND_API_KEY'));
  }

  async enviarEmail(
    destinatario: string,
    assunto: string,
    texto?: string,
    html?: string,
  ) {
    const startTime = Date.now();
    this.logger.log(
      `📧 Enviando email via Resend para ${destinatario} - Assunto: ${assunto}`,
    );

    const { data, error } = await this.resend.emails.send({
      from: `Sede Campestre <${this.fromEmail}>`,
      to: [destinatario],
      subject: assunto,
      html: html || undefined,
      text: texto || undefined,
    });

    const duration = Date.now() - startTime;

    if (error) {
      this.logger.error(
        `❌ Erro ao enviar email via Resend para ${destinatario} após ${duration}ms: ${error.message}`,
      );
      throw new Error(`Falha ao enviar email via Resend: ${error.message}`);
    }

    this.logger.log(
      `✅ Email enviado via Resend para ${destinatario} em ${duration}ms`,
    );
    this.logger.log(`📧 Message ID: ${data?.id}`);

    return { messageId: data?.id };
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

    const bodyHtml = `
      ${renderParagraph(`Olá <strong>${nome}</strong>, você solicitou um código de acesso para o sistema de reservas.`)}

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CORES.areiaSereno}; border:2px solid ${CORES.douradoPresenca}; border-radius:12px; margin:24px 0;">
        <tr>
          <td style="padding:28px; text-align:center;">
            <div style="font-size:14px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:${CORES.azulAbissal}; margin-bottom:14px;">Seu Código</div>
            <div style="background:${CORES.azulAbissal}; color:${CORES.brancoPerola}; font-size:32px; font-weight:700; letter-spacing:4px; padding:18px; border-radius:8px; font-family:'Courier New', monospace;">${codigo}</div>
          </td>
        </tr>
      </table>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CORES.areiaSereno}; border-left:4px solid ${CORES.verdeMontanha}; border-radius:0 8px 8px 0; margin:0 0 20px;">
        <tr>
          <td style="padding:18px 20px;">
            <p style="margin:0 0 6px; font-size:17px; font-weight:700; color:${CORES.azulAbissal};">Válido por 2 minutos</p>
            <p style="margin:0; font-size:15px; color:${CORES.textoMuted};">Este código expira automaticamente após 2 minutos por motivos de segurança.</p>
          </td>
        </tr>
      </table>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF3CD; border:1px solid #E6CF9D; border-radius:8px;">
        <tr>
          <td style="padding:16px 18px; text-align:center;">
            <p style="margin:0; font-size:15px; color:#856404;">Se você não solicitou este código, por favor ignore este e-mail.</p>
          </td>
        </tr>
      </table>
    `;

    const html = renderEmailShell({
      title: 'Código de Acesso',
      headerSubtitle: 'Código de Acesso',
      bodyHtml,
    });

    return this.enviarEmail(destinatario, assunto, texto, html);
  }

  // Método para enviar notificação de status de pagamento
  async enviarNotificacaoPagamento(
    destinatario: string,
    nome: string,
    codigoReserva: string,
    status: string,
    linkPagamento?: string,
  ) {
    this.logger.log(
      `📧 Iniciando envio de notificação de pagamento - Status: ${status}, Reserva: ${codigoReserva}, Destinatário: ${destinatario}`,
    );

    const estados: Record<
      string,
      { assunto: string; cor: string; titulo: string; mensagemHtml: string }
    > = {
      pago: {
        assunto: `Pagamento Confirmado - Reserva ${codigoReserva}`,
        cor: CORES.verdeMontanha,
        titulo: 'Pagamento Confirmado',
        mensagemHtml: `
          ${renderParagraph('O pagamento da sua reserva foi <strong>confirmado</strong>!')}
          ${renderParagraph('Sua reserva está garantida e você não precisa realizar mais nenhuma ação.', { muted: true })}
        `,
      },
      pendente: {
        assunto: `Pagamento Pendente - Reserva ${codigoReserva}`,
        cor: '#B8862E',
        titulo: 'Pagamento Pendente',
        mensagemHtml: `
          ${renderParagraph('O pagamento da sua reserva está <strong>pendente</strong>.')}
          ${renderParagraph('Para garantir sua reserva, efetue o pagamento o mais breve possível.', { muted: true })}
        `,
      },
      cancelado: {
        assunto: `Pagamento Cancelado - Reserva ${codigoReserva}`,
        cor: CORES.vermelhoCancelamento,
        titulo: 'Pagamento Cancelado',
        mensagemHtml: `
          ${renderParagraph('O pagamento da sua reserva foi <strong>cancelado</strong>.')}
          ${renderParagraph('Se você ainda deseja realizar esta reserva, entre em contato conosco.', { muted: true })}
        `,
      },
      estornado: {
        assunto: `Reserva ${codigoReserva} não pôde ser confirmada - Valor estornado`,
        cor: CORES.vermelhoCancelamento,
        titulo: 'Pagamento Estornado',
        mensagemHtml: `
          ${renderParagraph('Recebemos a confirmação do seu pagamento, mas infelizmente <strong>a data da sua reserva deixou de estar disponível</strong> antes que conseguíssemos confirmá-la.')}
          ${renderParagraph('<strong>O valor pago foi estornado automaticamente</strong> e deve aparecer no seu extrato/fatura em alguns dias, conforme o prazo do seu banco ou operadora de cartão.', { muted: true })}
          ${renderParagraph('Pedimos desculpas pelo transtorno. Se quiser tentar reservar outra data, é só acessar o site novamente.', { muted: true })}
        `,
      },
    };

    const estado = estados[status] || {
      assunto: `Atualização de Pagamento - Reserva ${codigoReserva}`,
      cor: CORES.azulAbissal,
      titulo: 'Atualização de Pagamento',
      mensagemHtml: renderParagraph(
        `Houve uma atualização no status do pagamento da sua reserva. Status atual: <strong>${status}</strong>`,
      ),
    };

    const bodyHtml = `
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
        <tr>
          <td style="background:${estado.cor}; color:${CORES.brancoPerola}; padding:8px 18px; border-radius:20px; font-size:14px; font-weight:700;">
            ${estado.titulo}
          </td>
        </tr>
      </table>

      ${renderParagraph(`Olá <strong>${nome}</strong>,`)}
      ${estado.mensagemHtml}

      ${renderInfoCard('Reserva', renderInfoRow('Código', codigoReserva))}

      ${
        linkPagamento
          ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">${renderButton(
              { label: 'Realizar Pagamento', href: linkPagamento, variant: 'primary' },
            )}</td></tr></table>`
          : ''
      }
    `;

    const html = renderEmailShell({
      title: estado.assunto,
      headerSubtitle: 'Atualização de Pagamento',
      bodyHtml,
    });

    const texto = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

    this.logger.log(
      `📧 Preparando envio de email de notificação de pagamento - Assunto: ${estado.assunto}`,
    );
    return this.enviarEmail(destinatario, estado.assunto, texto, html);
  }

  // Método para enviar email quando reserva é criada
  async enviarEmailReservaCriada(
    reservaData: ReservaEmailData,
    linkPagamento?: string,
  ): Promise<any> {
    const emailData: ReservaEmailData = {
      ...reservaData,
      linkPagamento,
    };

    const assunto = `Reserva ${reservaData.codigoReserva} criada - Aguardando Pagamento`;
    const html = getReservaConfirmacaoTemplate(
      emailData,
      'criada',
      this.frontendUrl,
    );

    // Texto simples para clientes que não suportam HTML
    const texto = `
      Olá ${reservaData.nome},

      Sua reserva foi criada com sucesso!

      Código da Reserva: ${reservaData.codigoReserva}
      Tipo: ${reservaData.tipo}
      Data: ${reservaData.dataInicio} a ${reservaData.dataFim}
      Valor Total: R$ ${reservaData.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}

      Para garantir sua reserva, efetue o pagamento o mais breve possível.

      Guarde estas informações: para consultar sua reserva a qualquer momento, use o código ${reservaData.codigoReserva} junto com o e-mail ${reservaData.dadosHospede?.email || ''}.

      ${linkPagamento ? `Link para pagamento: ${linkPagamento}` : ''}

      Atenciosamente,
      Equipe Sede Campestre
    `;

    return this.enviarEmail(
      reservaData.dadosHospede?.email || '',
      assunto,
      texto,
      html,
    );
  }

  // Método para enviar email quando pagamento é confirmado
  async enviarEmailReservaConfirmada(
    reservaData: ReservaEmailData,
  ): Promise<any> {
    const assunto = `Pagamento Confirmado - Reserva ${reservaData.codigoReserva}`;
    const html = getReservaConfirmacaoTemplate(
      reservaData,
      'confirmada',
      this.frontendUrl,
    );

    // Texto simples para clientes que não suportam HTML
    const texto = `
      Olá ${reservaData.nome},

      Seu pagamento foi confirmado com sucesso!

      Código da Reserva: ${reservaData.codigoReserva}
      Tipo: ${reservaData.tipo}
      Data: ${reservaData.dataInicio} a ${reservaData.dataFim}
      Valor Total: R$ ${reservaData.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}

      Sua reserva está garantida e você não precisa realizar mais nenhuma ação.

      Guarde estas informações: para consultar sua reserva a qualquer momento, use o código ${reservaData.codigoReserva} junto com o e-mail ${reservaData.dadosHospede?.email || ''}.

      Aguardamos sua presença!

      Atenciosamente,
      Equipe Sede Campestre
    `;

    return this.enviarEmail(
      reservaData.dadosHospede?.email || '',
      assunto,
      texto,
      html,
    );
  }

  // Método para enviar email de reserva cancelada
  async enviarReservaCancelada(reservaData: ReservaCanceladaEmailData) {
    const assunto = `Reserva Cancelada - ${reservaData.codigoReserva}`;

    const html = getReservaCanceladaTemplate(reservaData, this.frontendUrl);

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

      Se você cancelou por engano ou precisa de ajuda, entre em contato conosco.

      Atenciosamente,
      Equipe Sede Campestre
    `;

    return this.enviarEmail(
      reservaData.dadosHospede?.email || '',
      assunto,
      texto,
      html,
    );
  }

  // Método para enviar email de cancelamento de reserva
  async enviarEmailCancelamento(reserva: any, motivo: string, estorno?: any) {
    const assunto = `Reserva Cancelada - ${reserva.codigo}`;
    const dataInicioFormatada = new Date(reserva.dataInicio).toLocaleDateString('pt-BR');
    const dataFimFormatada = new Date(reserva.dataFim).toLocaleDateString('pt-BR');

    const html = getReservaCanceladaTemplate(
      {
        codigoReserva: reserva.codigo,
        nome: reserva.usuarioNome,
        tipo: reserva.tipo,
        dataInicio: dataInicioFormatada,
        dataFim: dataFimFormatada,
        quantidadePessoas: reserva.quantidadePessoas,
        quantidadeChales: reserva.quantidadeChales,
        quantidadeDiarias: reserva.quantidadeDiarias || 0,
        valorTotal: reserva.valorTotal,
        motivoCancelamento: motivo,
        dadosHospede: reserva.dadosHospede,
      },
      this.frontendUrl,
    );

    const texto = `
      Reserva Cancelada - ${reserva.codigo}

      Olá ${reserva.usuarioNome},

      Sua reserva foi cancelada. Abaixo estão os detalhes:

      Código da Reserva: ${reserva.codigo}
      Tipo: ${reserva.tipo}
      Data de Início: ${dataInicioFormatada}
      Data de Fim: ${dataFimFormatada}
      Quantidade de Pessoas: ${reserva.quantidadePessoas}
      ${reserva.quantidadeChales > 0 ? `Quantidade de Chalés: ${reserva.quantidadeChales}` : ''}
      Valor Total: R$ ${reserva.valorTotal.toFixed(2)}

      Motivo do Cancelamento: ${motivo}

      ${estorno ? `Valor do Estorno: R$ ${estorno.valor?.toFixed(2) || '0,00'}` : ''}

      Se você cancelou por engano ou precisa de ajuda, entre em contato conosco.

      Atenciosamente,
      Equipe Sede Campestre
    `;

    return this.enviarEmail(reserva.usuarioEmail, assunto, texto, html);
  }

  // Método para enviar email de notificação para o administrador quando uma reserva é confirmada
  async enviarEmailNotificacaoAdministrador(
    reservaData: ReservaEmailData,
  ): Promise<any> {
    this.logger.log(
      `📧 Iniciando envio de email para administrador - Reserva: ${reservaData.codigoReserva}`,
    );

    const assunto = `Nova Reserva Confirmada - ${reservaData.codigoReserva}`;

    const valorFormatado = reservaData.valorTotal.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });

    const statusPagamento =
      reservaData.statusReserva === 'CONFIRMADA'
        ? 'PAGO E CONFIRMADO'
        : 'PENDENTE';

    const linhasReserva = [
      renderInfoRow('Código', reservaData.codigoReserva),
      renderInfoRow('Cliente', reservaData.nome),
      renderInfoRow('Tipo', reservaData.tipo),
      renderInfoRow(
        'Período',
        `${reservaData.dataInicio} a ${reservaData.dataFim}`,
      ),
      renderInfoRow('Pessoas', String(reservaData.quantidadePessoas)),
      reservaData.quantidadeChales > 0
        ? renderInfoRow('Chalés', String(reservaData.quantidadeChales))
        : '',
      renderInfoRow('Diárias', String(reservaData.quantidadeDiarias)),
      renderInfoRow('Valor Total', valorFormatado),
    ].join('');

    const cardHospede = reservaData.dadosHospede
      ? renderInfoCard(
          'Informações do Hóspede',
          [
            reservaData.dadosHospede.nome
              ? renderInfoRow(
                  'Nome',
                  `${reservaData.dadosHospede.nome} ${reservaData.dadosHospede.sobrenome || ''}`,
                )
              : '',
            reservaData.dadosHospede.email
              ? renderInfoRow('Email', reservaData.dadosHospede.email)
              : '',
            reservaData.dadosHospede.telefone
              ? renderInfoRow('Telefone', reservaData.dadosHospede.telefone)
              : '',
            reservaData.dadosHospede.cpf
              ? renderInfoRow('CPF', reservaData.dadosHospede.cpf)
              : '',
          ].join(''),
        )
      : '';

    const blocoObservacoes = reservaData.observacoes
      ? `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF3CD; border:1px solid #E6CF9D; border-radius:8px; margin:0 0 24px;">
          <tr>
            <td style="padding:18px 20px;">
              <div style="font-weight:700; color:${CORES.azulAbissal}; margin-bottom:6px; font-size:16px;">Observações</div>
              <div style="color:${CORES.azulAbissal}; font-size:15px;">${reservaData.observacoes}</div>
            </td>
          </tr>
        </table>
      `
      : '';

    const bodyHtml = `
      ${renderParagraph('Uma nova reserva foi confirmada e está pronta para uso.')}

      ${renderInfoCard('Detalhes da Reserva', linhasReserva)}
      ${cardHospede}
      ${blocoObservacoes}

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CORES.verdeMontanha}; border-radius:12px; margin:0 0 8px;">
        <tr>
          <td style="padding:20px; text-align:center;">
            <div style="color:${CORES.brancoPerola}; font-size:16px; font-weight:700; margin-bottom:10px;">Status do Pagamento</div>
            <div style="background:${CORES.brancoPerola}; color:${CORES.verdeMontanha}; font-size:16px; font-weight:700; padding:12px; border-radius:8px;">${statusPagamento}</div>
          </td>
        </tr>
      </table>
    `;

    const html = renderEmailShell({
      title: assunto,
      headerSubtitle: 'Notificação Administrativa',
      bodyHtml,
    });

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

      ${
        reservaData.dadosHospede
          ? `
      INFORMAÇÕES DO HÓSPEDE:
      ${reservaData.dadosHospede.nome ? `Nome: ${reservaData.dadosHospede.nome} ${reservaData.dadosHospede.sobrenome || ''}` : ''}
      ${reservaData.dadosHospede.email ? `Email: ${reservaData.dadosHospede.email}` : ''}
      ${reservaData.dadosHospede.telefone ? `Telefone: ${reservaData.dadosHospede.telefone}` : ''}
      ${reservaData.dadosHospede.cpf ? `CPF: ${reservaData.dadosHospede.cpf}` : ''}
      `
          : ''
      }

      ${reservaData.observacoes ? `OBSERVAÇÕES: ${reservaData.observacoes}` : ''}

      Sistema de Reservas - Sede Campestre
      Notificação automática enviada em ${new Date().toLocaleString('pt-BR')}
    `;

    return this.enviarEmail(
      'administrativo@oceanodagraca.com',
      assunto,
      texto,
      html,
    );
  }
}
