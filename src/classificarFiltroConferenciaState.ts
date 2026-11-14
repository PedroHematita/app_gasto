import {
  MEUS_GASTOS_FILTRO_VAZIO,
  type MeusGastosFiltroConferencia,
} from './lib/meusGastosFiltroConferencia';

/** Filtros de conferência em Classificar — sessão JS, independente de Meus Gastos. */
export const classificarFiltroConferenciaState: MeusGastosFiltroConferencia = {
  instituicoes: [...MEUS_GASTOS_FILTRO_VAZIO.instituicoes],
  tipo: MEUS_GASTOS_FILTRO_VAZIO.tipo,
};

export function setClassificarFiltroConferencia(filtro: MeusGastosFiltroConferencia): void {
  classificarFiltroConferenciaState.instituicoes = [...filtro.instituicoes];
  classificarFiltroConferenciaState.tipo = filtro.tipo;
}

export function limparClassificarFiltroConferencia(): void {
  setClassificarFiltroConferencia(MEUS_GASTOS_FILTRO_VAZIO);
}

export function lerClassificarFiltroConferencia(): MeusGastosFiltroConferencia {
  return {
    instituicoes: [...classificarFiltroConferenciaState.instituicoes],
    tipo: classificarFiltroConferenciaState.tipo,
  };
}
