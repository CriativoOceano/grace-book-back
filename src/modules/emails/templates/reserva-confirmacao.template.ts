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

export function getReservaConfirmacaoTemplate(data: ReservaEmailData, tipo: 'criada' | 'confirmada'): string {
  const cores = {
    azulAbissal: '#0A2647',
    douradoPresenca: '#CBA135',
    verdeMontanha: '#4E944F',
    brancoPerola: '#FAFAFA',
    cinzaSereno: '#D9D9D9',
    areiaSereno: '#F6EBD9'
  };

  const statusInfo = {
    criada: {
      titulo: 'Reserva Criada com Sucesso!',
      mensagem: 'Sua reserva foi criada e está aguardando confirmação do pagamento.',
      corStatus: '#F0C929',
      textoStatus: 'Aguardando Pagamento'
    },
    confirmada: {
      titulo: 'Pagamento Confirmado!',
      mensagem: 'Sua reserva foi confirmada e está garantida.',
      corStatus: '#4E944F',
      textoStatus: 'Confirmada'
    }
  };

  const info = statusInfo[tipo];

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${info.titulo}</title>
      <style>
        body {
          font-family: 'Inter', Arial, sans-serif;
          line-height: 1.6;
          color: #0A2647;
          margin: 0;
          padding: 0;
          background-color: #FAFAFA;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 8px 32px rgba(10, 38, 71, 0.15);
        }
        .header {
          background: linear-gradient(135deg, ${cores.azulAbissal} 0%, #25727F 100%);
          color: ${cores.brancoPerola};
          padding: 32px 24px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 700;
          font-family: 'Playfair Display', serif;
        }
        .header p {
          margin: 8px 0 0 0;
          font-size: 16px;
          opacity: 0.9;
        }
        .content {
          padding: 32px 24px;
        }
        .status-badge {
          display: inline-block;
          background: ${info.corStatus};
          color: white;
          padding: 8px 16px;
          border-radius: 20px;
          font-weight: 600;
          font-size: 14px;
          margin-bottom: 24px;
        }
        .info-card {
          background: ${cores.areiaSereno};
          border: 2px solid ${cores.douradoPresenca};
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 24px;
        }
        .info-card h3 {
          color: ${cores.azulAbissal};
          margin: 0 0 16px 0;
          font-size: 20px;
          font-weight: 600;
        }
        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 16px;
        }
        .info-item {
          display: flex;
          flex-direction: column;
        }
        .info-label {
          font-size: 12px;
          color: #6B5B47;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }
        .info-value {
          font-size: 16px;
          color: ${cores.azulAbissal};
          font-weight: 600;
        }
        .valor-total {
          background: ${cores.douradoPresenca};
          color: white;
          padding: 16px;
          border-radius: 8px;
          text-align: center;
          font-size: 24px;
          font-weight: 700;
          margin: 16px 0;
        }
        .action-buttons {
          text-align: center;
          margin: 32px 0;
        }
        .btn {
          display: inline-block;
          padding: 16px 32px;
          border-radius: 8px;
          text-decoration: none;
          font-weight: 600;
          font-size: 16px;
          margin: 8px;
          transition: all 0.3s ease;
        }
        .btn-primary {
          background: ${cores.douradoPresenca};
          color: white;
        }
        .btn-secondary {
          background: transparent;
          color: ${cores.azulAbissal};
          border: 2px solid ${cores.azulAbissal};
        }
        .btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
        }
        .footer {
          background: ${cores.cinzaSereno};
          padding: 24px;
          text-align: center;
          color: #6B5B47;
        }
        .footer h4 {
          color: ${cores.azulAbissal};
          margin: 0 0 16px 0;
          font-size: 18px;
        }
        .contact-info {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 16px;
        }
        .contact-item {
          font-size: 14px;
        }
        .contact-item strong {
          color: ${cores.azulAbissal};
        }
        .copyright {
          font-size: 12px;
          opacity: 0.7;
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid rgba(0, 0, 0, 0.1);
        }
        @media (max-width: 600px) {
          .info-grid {
            grid-template-columns: 1fr;
          }
          .contact-info {
            grid-template-columns: 1fr;
          }
          .btn {
            display: block;
            margin: 8px 0;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <!-- Header -->
        <div class="header">
          <h1>Espaço Fonte da Graça</h1>
          <p>${info.titulo}</p>
        </div>

        <!-- Content -->
        <div class="content">
          <div class="status-badge">${info.textoStatus}</div>
          
          <p>Olá <strong>${data.nome}</strong>,</p>
          <p>${info.mensagem}</p>

          <!-- Informações da Reserva -->
          <div class="info-card">
            <h3>📋 Detalhes da Reserva</h3>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">Código da Reserva</span>
                <span class="info-value">${data.codigoReserva}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Tipo de Reserva</span>
                <span class="info-value">${getTipoDescricao(data.tipo)}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Data de Início</span>
                <span class="info-value">${data.dataInicio}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Data de Fim</span>
                <span class="info-value">${data.dataFim}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Quantidade de Pessoas</span>
                <span class="info-value">${data.quantidadePessoas}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Quantidade de Chalés</span>
                <span class="info-value">${data.quantidadeChales || 0}</span>
              </div>
            </div>
            <div class="valor-total">
              Valor Total: R$ ${data.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <!-- Dados do Hóspede -->
          ${data.dadosHospede ? `
          <div class="info-card">
            <h3>👤 Dados do Hóspede</h3>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">Nome Completo</span>
                <span class="info-value">${data.dadosHospede.nome} ${data.dadosHospede.sobrenome}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Email</span>
                <span class="info-value">${data.dadosHospede.email}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Telefone</span>
                <span class="info-value">${data.dadosHospede.telefone}</span>
              </div>
              <div class="info-item">
                <span class="info-label">CPF</span>
                <span class="info-value">${data.dadosHospede.cpf}</span>
              </div>
            </div>
          </div>
          ` : ''}

          <!-- Observações -->
          ${data.observacoes ? `
          <div class="info-card">
            <h3>📝 Observações</h3>
            <p style="margin: 0; color: #6B5B47;">${data.observacoes}</p>
          </div>
          ` : ''}

          <!-- Botões de Ação -->
          <div class="action-buttons">
            ${tipo === 'criada' && data.linkPagamento ? `
              <a href="${data.linkPagamento}" class="btn btn-primary">
                💳 Realizar Pagamento
              </a>
            ` : ''}
            <a href="https://oceanodagraca.com/consultar-reserva" class="btn btn-secondary">
              🔍 Consultar Reserva
            </a>
          </div>

          ${tipo === 'criada' ? `
          <div style="background: #FFF3CD; border: 1px solid #FFEAA7; border-radius: 8px; padding: 16px; margin: 24px 0;">
            <p style="margin: 0; color: #856404; font-size: 14px;">
              <strong>⚠️ Importante:</strong> Para garantir sua reserva, efetue o pagamento o mais breve possível. 
              Use o código de acesso <strong>${data.codigoAcesso}</strong> para consultar sua reserva a qualquer momento.
            </p>
          </div>
          ` : ''}
        </div>

        <!-- Footer -->
        <div class="footer">
          <h4>Contato</h4>
          <div class="contact-info">
            <div class="contact-item">
              <strong>📞 Telefone:</strong><br>
              (11) 99999-9999
            </div>
            <div class="contact-item">
              <strong>📧 Email:</strong><br>
              contato@oceanodagraca.com
            </div>
            <div class="contact-item">
              <strong>📍 Endereço:</strong><br>
              Águas Lindas de Goiás, GO
            </div>
            <div class="contact-item">
              <strong>🌐 Website:</strong><br>
              oceanodagraca.com
            </div>
          </div>
          <div class="copyright">
            © ${new Date().getFullYear()} Espaço Fonte da Graça. Todos os direitos reservados.
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

function getTipoDescricao(tipo: string): string {
  const tipos = {
    'DIARIA': 'Diária',
    'CHALE': 'Chalé(s)',
    'BATISMO': 'Cerimônia de Batismo',
    'COMPLETO': 'Pacote Completo (Diária + Chalés)'
  };
  return tipos[tipo] || tipo;
}
