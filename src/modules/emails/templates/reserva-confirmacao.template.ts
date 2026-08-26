import {
  CORES,
  renderEmailShell,
  renderInfoRow,
  renderInfoCard,
  renderButton,
  renderParagraph,
} from '../email-components';

export interface ReservaEmailData {
  nome: string;
  codigoReserva: string;
  dataInicio: string;
  dataFim: string;
  tipo: string;
  quantidadePessoas: number;
  quantidadeChales: number;
  quantidadeDiarias: number;
  valorTotal: number;
  statusReserva: string;
  codigoAcesso: string;
  linkPagamento?: string;
  observacoes?: string;
  dadosHospede?: {
    nome: string;
    sobrenome: string;
    email: string;
    telefone: string;
    cpf: string;
  };
}

export interface ReservaCanceladaEmailData {
  nome: string;
  codigoReserva: string;
  dataInicio: string;
  dataFim: string;
  tipo: string;
  quantidadePessoas: number;
  quantidadeChales: number;
  quantidadeDiarias: number;
  valorTotal: number;
  motivoCancelamento?: string;
  dadosHospede?: {
    nome: string;
    sobrenome: string;
    email: string;
    telefone: string;
    cpf: string;
  };
}

function getTipoDescricao(tipo: string): string {
  const tipos = {
    DIARIA: 'Diária',
    CHALE: 'Chalé(s)',
    BATISMO: 'Cerimônia de Batismo',
    COMPLETO: 'Pacote Completo (Diária + Chalés)',
  };
  return tipos[tipo] || tipo;
}

const formatarMoeda = (valor: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    valor,
  );

export function getReservaConfirmacaoTemplate(
  data: ReservaEmailData,
  tipo: 'criada' | 'confirmada',
  frontendUrl: string,
): string {
  const statusInfo = {
    criada: {
      titulo: 'Reserva Criada com Sucesso!',
      mensagem:
        'Sua reserva foi criada e está aguardando confirmação do pagamento.',
      corStatus: '#B8862E',
      textoStatus: 'Aguardando Pagamento',
    },
    confirmada: {
      titulo: 'Pagamento Confirmado!',
      mensagem: 'Sua reserva foi confirmada e está garantida.',
      corStatus: CORES.verdeMontanha,
      textoStatus: 'Confirmada',
    },
  };

  const info = statusInfo[tipo];

  const linhasReserva = [
    renderInfoRow('Código da Reserva', data.codigoReserva),
    renderInfoRow('Tipo de Reserva', getTipoDescricao(data.tipo)),
    renderInfoRow('Data de Início', data.dataInicio),
    renderInfoRow('Data de Fim', data.dataFim),
    renderInfoRow('Quantidade de Pessoas', String(data.quantidadePessoas)),
    data.quantidadeChales
      ? renderInfoRow('Quantidade de Chalés', String(data.quantidadeChales))
      : '',
    renderInfoRow('Valor Total', formatarMoeda(data.valorTotal)),
  ].join('');

  const cardHospede = data.dadosHospede
    ? renderInfoCard(
        'Dados do Hóspede',
        [
          renderInfoRow(
            'Nome Completo',
            `${data.dadosHospede.nome} ${data.dadosHospede.sobrenome}`,
          ),
          renderInfoRow('Email', data.dadosHospede.email),
          renderInfoRow('Telefone', data.dadosHospede.telefone),
          renderInfoRow('CPF', data.dadosHospede.cpf),
        ].join(''),
      )
    : '';

  const blocoObservacoes = data.observacoes
    ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CORES.areiaSereno}; border:2px solid ${CORES.douradoPresenca}; border-radius:12px; margin:0 0 24px;">
        <tr>
          <td style="padding:24px;">
            <div style="font-size:19px; font-weight:700; color:${CORES.azulAbissal}; margin-bottom:12px;">Observações</div>
            <p style="margin:0; font-size:16px; color:${CORES.textoMuted};">${data.observacoes}</p>
          </td>
        </tr>
      </table>
    `
    : '';

  const avisoPagamento =
    tipo === 'criada'
      ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF3CD; border:1px solid #E6CF9D; border-radius:8px; margin:24px 0;">
        <tr>
          <td style="padding:18px 20px;">
            <p style="margin:0; font-size:16px; color:#856404; line-height:1.5;">
              <strong>Importante:</strong> para garantir sua reserva, efetue o pagamento o mais breve possível.
            </p>
          </td>
        </tr>
      </table>
    `
      : '';

  const avisoConsulta = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CORES.areiaSereno}; border:1px solid ${CORES.douradoPresenca}; border-radius:8px; margin:0 0 24px;">
      <tr>
        <td style="padding:18px 20px;">
          <p style="margin:0; font-size:16px; color:${CORES.azulAbissal}; line-height:1.5;">
            <strong>Guarde estas informações:</strong> para consultar sua reserva a qualquer momento, use o código
            <strong>${data.codigoReserva}</strong> junto com o e-mail <strong>${data.dadosHospede?.email || ''}</strong> na página "Consultar Reserva".
          </p>
        </td>
      </tr>
    </table>
  `;

  const botaoPagar =
    tipo === 'criada' && data.linkPagamento
      ? renderButton({
          label: 'Realizar Pagamento',
          href: data.linkPagamento,
          variant: 'primary',
        })
      : '';

  const bodyHtml = `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      <tr>
        <td style="background:${info.corStatus}; color:${CORES.brancoPerola}; padding:8px 18px; border-radius:20px; font-size:14px; font-weight:700;">
          ${info.textoStatus}
        </td>
      </tr>
    </table>

    ${renderParagraph(`Olá <strong>${data.nome}</strong>,`)}
    ${renderParagraph(info.mensagem)}

    ${renderInfoCard('Detalhes da Reserva', linhasReserva)}
    ${cardHospede}
    ${blocoObservacoes}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          ${botaoPagar}
          ${renderButton({
            label: 'Consultar Reserva',
            href: `${frontendUrl}/consultar-reserva`,
            variant: 'secondary',
          })}
        </td>
      </tr>
    </table>

    ${avisoPagamento}
    ${avisoConsulta}
  `;

  return renderEmailShell({
    title: info.titulo,
    headerSubtitle: info.titulo,
    bodyHtml,
  });
}

export function getReservaCanceladaTemplate(
  data: ReservaCanceladaEmailData,
  frontendUrl: string,
): string {
  const getTipoReservaTexto = (tipo: string) => {
    switch (tipo) {
      case 'diaria':
        return 'Diária';
      case 'batismo':
        return 'Batismo';
      case 'chale':
        return 'Chalé';
      case 'completo':
        return 'Pacote Completo';
      default:
        return tipo;
    }
  };

  const linhas = [
    renderInfoRow('Código da Reserva', data.codigoReserva),
    renderInfoRow('Tipo de Reserva', getTipoReservaTexto(data.tipo)),
    renderInfoRow('Data de Início', data.dataInicio),
    renderInfoRow('Data de Fim', data.dataFim),
    renderInfoRow('Quantidade de Pessoas', String(data.quantidadePessoas)),
    data.quantidadeChales > 0
      ? renderInfoRow('Quantidade de Chalés', String(data.quantidadeChales))
      : '',
    renderInfoRow('Valor Total', formatarMoeda(data.valorTotal)),
  ].join('');

  const blocoMotivo = data.motivoCancelamento
    ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FEF2F2; border:1px solid #FECACA; border-radius:8px; margin:0 0 24px;">
        <tr>
          <td style="padding:18px 20px;">
            <div style="font-weight:700; color:${CORES.vermelhoCancelamento}; margin-bottom:6px; font-size:16px;">Motivo do Cancelamento</div>
            <div style="color:#7F1D1D; font-size:16px;">${data.motivoCancelamento}</div>
          </td>
        </tr>
      </table>
    `
    : '';

  const bodyHtml = `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      <tr>
        <td style="background:${CORES.vermelhoCancelamento}; color:${CORES.brancoPerola}; padding:8px 18px; border-radius:20px; font-size:14px; font-weight:700;">
          Reserva Cancelada
        </td>
      </tr>
    </table>

    ${renderParagraph(`Olá <strong>${data.nome}</strong>,`)}
    ${renderParagraph('Sua reserva foi cancelada. Abaixo estão os detalhes:')}

    ${renderInfoCard('Detalhes da Reserva', linhas)}
    ${blocoMotivo}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F0F9FF; border-radius:12px; margin:0 0 24px;">
      <tr>
        <td style="padding:22px 24px;">
          <div style="font-size:18px; font-weight:700; color:${CORES.azulAbissal}; margin-bottom:12px;">Próximos Passos</div>
          <ul style="margin:0; padding-left:20px; color:#1E40AF; font-size:16px; line-height:1.8;">
            <li>Se você cancelou por engano, entre em contato conosco</li>
            <li>Você pode fazer uma nova reserva a qualquer momento</li>
          </ul>
        </td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          ${renderButton({
            label: 'Fazer Nova Reserva',
            href: `${frontendUrl}/reservar`,
            variant: 'primary',
          })}
        </td>
      </tr>
    </table>
  `;

  return renderEmailShell({
    title: 'Reserva Cancelada',
    headerSubtitle: 'Reserva Cancelada',
    headerGradient: `linear-gradient(135deg, ${CORES.azulAbissal} 0%, #1E3A5F 100%)`,
    bodyHtml,
  });
}
