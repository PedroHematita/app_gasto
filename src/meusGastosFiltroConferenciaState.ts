import {
  MEUS_GASTOS_FILTRO_VAZIO,
  type MeusGastosFiltroConferencia,
} from './lib/meusGastosFiltroConferencia';

/** Filtros de conferência em Meus Gastos — sessão JS, zera no reload. */
export const meusGastosFiltroConferenciaState: MeusGastosFiltroConferencia = {
  instituicoes: [...MEUS_GASTOS_FILTRO_VAZIO.instituicoes],
  tipo: MEUS_GASTOS_FILTRO_VAZIO.tipo,
};

export function setMeusGastosFiltroConferencia(filtro: MeusGastosFiltroConferencia): void {
  meusGastosFiltroConferenciaState.instituicoes = [...filtro.instituicoes];
  meusGastosFiltroConferenciaState.tipo = filtro.tipo;
}

export function limparMeusGastosFiltroConferencia(): void {
  setMeusGastosFiltroConferencia(MEUS_GASTOS_FILTRO_VAZIO);
}

export function lerMeusGastosFiltroConferencia(): MeusGastosFiltroConferencia {
  return {
    instituicoes: [...meusGastosFiltroConferenciaState.instituicoes],
    tipo: meusGastosFiltroConferenciaState.tipo,
  };
}
