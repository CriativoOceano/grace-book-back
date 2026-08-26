import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';

// A dependência transitiva `uuid@13` é ESM-only e o jest deste projeto não
// está configurado para transformar node_modules - mockar evita ter que
// carregar o pacote real só para este teste unitário isolado.
jest.mock('uuid', () => ({ v4: () => 'test-uuid' }));
import { getModelToken, getConnectionToken } from '@nestjs/mongoose';
import { ReservaProcessoService } from './reserva-processo.service';
import { RESERVA_REPOSITORY } from 'src/modules/reservas/repositories/reserva-repository.provider';
import { PAGAMENTO_REPOSITORY } from 'src/modules/pagamentos/repositories/pagamento-repository.provider';
import { CONFIGURACOES_REPOSITORY } from 'src/modules/configuracoes/repositories/configuracaoes-repository.provider';
import { PagamentosService } from 'src/modules/pagamentos/pagamentos.service';
import { CalculoReservaService } from './calcular-reserva.service';
import { ReservaHold } from 'src/schemas/reserva-hold.schema';
import { TipoReserva } from 'src/modules/reservas/reserva.enums';

/**
 * Testa a trava atômica de reserva dupla (ReservaHold) de forma isolada,
 * mockando o Model do Mongoose. O projeto não tem infraestrutura de banco
 * de testes (sem mongodb-memory-server), então este teste verifica
 * diretamente o comportamento de `criarHoldsDeReserva` via
 * `processarNovaReserva`: um erro de chave duplicada (E11000) do
 * `insertMany` - o que o MongoDB realmente lança quando duas reservas
 * concorrentes disputam a mesma noite - deve virar um ConflictException
 * claro para o usuário, e não deixar a reserva "meio criada".
 */
describe('ReservaProcessoService - trava atômica de reserva dupla', () => {
  let service: ReservaProcessoService;
  let insertManyMock: jest.Mock;
  let createReservaMock: jest.Mock;
  let criarCobrancaMock: jest.Mock;

  const dadosReservaBase = {
    tipo: TipoReserva.DIARIA,
    dataInicio: new Date('2026-01-10T00:00:00.000Z'),
    dataFim: new Date('2026-01-11T00:00:00.000Z'),
    quantidadeDiarias: 1,
    quantidadeChales: 0,
  } as any;

  beforeEach(async () => {
    insertManyMock = jest.fn();
    createReservaMock = jest.fn().mockResolvedValue({ _id: 'reserva-1' });
    criarCobrancaMock = jest
      .fn()
      .mockResolvedValue({ linkPagamento: 'https://pagamento.teste' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservaProcessoService,
        {
          provide: RESERVA_REPOSITORY,
          useValue: {
            createReserva: createReservaMock,
            updateReserva: jest.fn().mockResolvedValue({}),
            getHistorico: jest.fn().mockResolvedValue([]),
          },
        },
        { provide: PAGAMENTO_REPOSITORY, useValue: {} },
        { provide: CONFIGURACOES_REPOSITORY, useValue: {} },
        { provide: getConnectionToken(), useValue: {} },
        {
          provide: getModelToken(ReservaHold.name),
          useValue: {
            find: jest.fn().mockReturnValue({
              session: jest.fn().mockReturnThis(),
              lean: jest.fn().mockResolvedValue([]),
            }),
            insertMany: insertManyMock,
            deleteMany: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: PagamentosService,
          useValue: { criarCobranca: criarCobrancaMock },
        },
        { provide: CalculoReservaService, useValue: {} },
      ],
    }).compile();

    service = module.get(ReservaProcessoService);
  });

  it('lança ConflictException quando a diária já foi travada por outra reserva (E11000)', async () => {
    const erroDuplicidade: any = new Error('E11000 duplicate key error');
    erroDuplicidade.code = 11000;
    insertManyMock.mockRejectedValue(erroDuplicidade);

    await expect(
      service.processarNovaReserva({ ...dadosReservaBase }, undefined),
    ).rejects.toBeInstanceOf(ConflictException);

    // A cobrança no ASAAS não deve ser criada se a trava de disponibilidade falhou
    expect(criarCobrancaMock).not.toHaveBeenCalled();
  });

  it('cria a reserva normalmente quando a noite está livre', async () => {
    insertManyMock.mockResolvedValue([{ data: dadosReservaBase.dataInicio, recurso: 'principal' }]);

    const resultado = await service.processarNovaReserva(
      { ...dadosReservaBase },
      undefined,
    );

    expect(resultado.reserva).toEqual({ _id: 'reserva-1' });
    expect(insertManyMock).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          recurso: 'principal',
          reservaId: 'reserva-1',
        }),
      ],
      { session: undefined, ordered: true },
    );
    expect(criarCobrancaMock).toHaveBeenCalledWith(
      'reserva-1',
      dadosReservaBase.dadosPagamento,
    );
  });

  it('propaga um erro inesperado do insertMany sem mascará-lo como conflito', async () => {
    insertManyMock.mockRejectedValue(new Error('falha de rede genérica'));

    await expect(
      service.processarNovaReserva({ ...dadosReservaBase }, undefined),
    ).rejects.toThrow('falha de rede genérica');
  });
});
