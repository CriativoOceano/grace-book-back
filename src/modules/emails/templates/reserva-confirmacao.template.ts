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
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;;
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
          background: ${cores.azulAbissal};
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
          background: ${cores.azulAbissal};
          padding: 24px;
          text-align: center;
          color: #6B5B47;
        }
        .footer h4 {
          color: ${cores.brancoPerola};
          margin: 0 0 16px 0;
          font-size: 18px;
        }
        .contact-info {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 16px;
          color: ${cores.brancoPerola};
        }
        .contact-item {
          font-size: 14px;
          color: ${cores.brancoPerola};
        }
        .contact-item strong {
          color: ${cores.brancoPerola};
        }
        .copyright {
          font-size: 12px;
          opacity: 0.7;
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid rgba(0, 0, 0, 0.1);
          color: ${cores.brancoPerola};
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
          <h1>Sede Campestre</h1>
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
            © ${new Date().getFullYear()} Espaço Sede Campestre. Todos os direitos reservados.
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

export function getReservaCanceladaTemplate(data: ReservaCanceladaEmailData): string {
  const cores = {
    azulAbissal: '#0A2647',
    douradoPresenca: '#CBA135',
    vermelhoCancelamento: '#DC2626',
    brancoPerola: '#FAFAFA',
    cinzaSereno: '#D9D9D9',
    areiaSereno: '#F6EBD9'
  };

  const formatarData = (dataString: string) => {
    const data = new Date(dataString);
    return data.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  };

  const getTipoReservaTexto = (tipo: string) => {
    switch (tipo) {
      case 'diaria': return 'Diária';
      case 'batismo': return 'Batismo';
      case 'chale': return 'Chalé';
      case 'completo': return 'Pacote Completo';
      default: return tipo;
    }
  };

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reserva Cancelada - Sede Campestre</title>
      <style>
        body {
          margin: 0;
          padding: 0;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background-color: #f5f5f5;
          line-height: 1.6;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background-color: ${cores.brancoPerola};
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 8px 32px rgba(10, 38, 71, 0.15);
        }
        .header {
          background: linear-gradient(135deg, ${cores.azulAbissal} 0%, #1e3a5f 100%);
          padding: 40px 30px;
          text-align: center;
          color: ${cores.brancoPerola};
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 700;
          letter-spacing: 1px;
        }
        .header p {
          margin: 8px 0 0 0;
          font-size: 16px;
          font-weight: 300;
          color: ${cores.areiaSereno};
        }
        .content {
          padding: 40px 30px;
        }
        .status-badge {
          display: inline-block;
          background: linear-gradient(135deg, ${cores.vermelhoCancelamento} 0%, #b91c1c 100%);
          color: white;
          padding: 12px 24px;
          border-radius: 25px;
          font-weight: 600;
          font-size: 16px;
          margin-bottom: 30px;
          box-shadow: 0 4px 15px rgba(220, 38, 38, 0.3);
        }
        .title {
          font-size: 24px;
          font-weight: 700;
          color: ${cores.azulAbissal};
          margin-bottom: 20px;
          text-align: center;
        }
        .message {
          font-size: 16px;
          color: #4a5568;
          margin-bottom: 30px;
          text-align: center;
          line-height: 1.8;
        }
        .reserva-info {
          background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
          border-radius: 12px;
          padding: 25px;
          margin-bottom: 30px;
          border-left: 4px solid ${cores.vermelhoCancelamento};
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 0;
          border-bottom: 1px solid #e2e8f0;
        }
        .info-row:last-child {
          border-bottom: none;
        }
        .info-label {
          font-weight: 600;
          color: ${cores.azulAbissal};
          font-size: 14px;
        }
        .info-value {
          font-weight: 500;
          color: #2d3748;
          font-size: 14px;
        }
        .motivo-section {
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 30px;
        }
        .motivo-title {
          font-weight: 600;
          color: ${cores.vermelhoCancelamento};
          margin-bottom: 10px;
        }
        .motivo-text {
          color: #7f1d1d;
          font-size: 14px;
        }
        .next-steps {
          background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
          border-radius: 12px;
          padding: 25px;
          margin-bottom: 30px;
        }
        .next-steps h3 {
          color: ${cores.azulAbissal};
          margin-bottom: 15px;
          font-size: 18px;
        }
        .next-steps ul {
          margin: 0;
          padding-left: 20px;
        }
        .next-steps li {
          color: #1e40af;
          margin-bottom: 8px;
          font-size: 14px;
        }
        .contact-section {
          background: linear-gradient(135deg, ${cores.azulAbissal} 0%, #1e3a5f 100%);
          color: ${cores.brancoPerola};
          padding: 30px;
          text-align: center;
          border-radius: 12px;
        }
        .contact-section h3 {
          margin-bottom: 20px;
          font-size: 20px;
        }
        .contact-info {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-top: 20px;
        }
        .contact-item {
          text-align: center;
        }
        .contact-item strong {
          display: block;
          margin-bottom: 5px;
          color: ${cores.areiaSereno};
        }
        .footer {
          background: #f8fafc;
          padding: 30px;
          text-align: center;
          color: #64748b;
          font-size: 14px;
        }
        @media (max-width: 600px) {
          .container {
            margin: 0;
            border-radius: 0;
          }
          .header, .content, .contact-section, .footer {
            padding: 20px;
          }
          .contact-info {
            grid-template-columns: 1fr;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Sede Campestre</h1>
          <p>Sistema de Reservas</p>
        </div>
        
        <div class="content">
          <div style="text-align: center; margin-bottom: 30px;">
            <div class="status-badge">❌ Reserva Cancelada</div>
          </div>
          
          <h2 class="title">Reserva Cancelada</h2>
          
          <p class="message">
            Sua reserva foi cancelada. Abaixo estão os detalhes da reserva que foi cancelada.
          </p>
          
          <div class="reserva-info">
            <div class="info-row">
              <span class="info-label">Código da Reserva:</span>
              <span class="info-value"><strong>${data.codigoReserva}</strong></span>
            </div>
            <div class="info-row">
              <span class="info-label">Tipo de Reserva:</span>
              <span class="info-value">${getTipoReservaTexto(data.tipo)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Data de Início:</span>
              <span class="info-value">${formatarData(data.dataInicio)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Data de Fim:</span>
              <span class="info-value">${formatarData(data.dataFim)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Quantidade de Pessoas:</span>
              <span class="info-value">${data.quantidadePessoas}</span>
            </div>
            ${data.quantidadeChales > 0 ? `
            <div class="info-row">
              <span class="info-label">Quantidade de Chalés:</span>
              <span class="info-value">${data.quantidadeChales}</span>
            </div>
            ` : ''}
            <div class="info-row">
              <span class="info-label">Valor Total:</span>
              <span class="info-value"><strong>${formatarMoeda(data.valorTotal)}</strong></span>
            </div>
          </div>
          
          ${data.motivoCancelamento ? `
          <div class="motivo-section">
            <div class="motivo-title">Motivo do Cancelamento:</div>
            <div class="motivo-text">${data.motivoCancelamento}</div>
          </div>
          ` : ''}
          
          <div class="next-steps">
            <h3>Próximos Passos</h3>
            <ul>
              <li>Se você cancelou por engano, entre em contato conosco</li>
              <li>Você pode fazer uma nova reserva a qualquer momento</li>
              <li>Em caso de dúvidas, nossa equipe está disponível para ajudar</li>
            </ul>
          </div>
          
          <div class="contact-section">
            <h3>Precisa de Ajuda?</h3>
            <p>Nossa equipe está pronta para ajudá-lo com qualquer dúvida ou para fazer uma nova reserva.</p>
            
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
          </div>
        </div>
        
        <div class="footer">
          <p>© ${new Date().getFullYear()} Sede Campestre. Todos os direitos reservados.</p>
          <p>Este é um email automático, por favor não responda.</p>
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
