/**
 * Códigos de erro da NFS-e Nacional (SEFAZ).
 * Fonte: Manual de Integração NFS-e Nacional v1.x
 *
 * Classificação:
 *  BUSINESS → erro de negócio, não retentar (status = rejected)
 *  TECHNICAL → erro técnico, retentar com backoff (relança exception)
 */

export type ErrorCategory = 'BUSINESS' | 'TECHNICAL';

export interface NfseErrorDefinition {
  category: ErrorCategory;
  description: string;
  userMessage: string;
}

export const NFSE_ERROR_CODES: Record<string, NfseErrorDefinition> = {
  // ── Autenticação / Autorização ─────────────────────────────────────
  'E001': {
    category: 'TECHNICAL',
    description: 'Token de autenticação inválido ou expirado',
    userMessage: 'Erro de autenticação com a SEFAZ. Tente novamente.',
  },
  'E002': {
    category: 'BUSINESS',
    description: 'Certificado digital inválido',
    userMessage: 'Certificado digital do prestador é inválido ou expirado.',
  },
  'E003': {
    category: 'BUSINESS',
    description: 'CNPJ não habilitado para emissão de NFS-e',
    userMessage: 'O CNPJ do prestador não está habilitado para emitir NFS-e neste município.',
  },
  'E004': {
    category: 'BUSINESS',
    description: 'Competência fiscal encerrada',
    userMessage: 'O período fiscal para emissão nesta competência está encerrado.',
  },

  // ── Dados do Prestador ─────────────────────────────────────────────
  'E100': {
    category: 'BUSINESS',
    description: 'CNPJ do prestador inválido',
    userMessage: 'O CNPJ do prestador de serviços é inválido.',
  },
  'E101': {
    category: 'BUSINESS',
    description: 'Prestador não cadastrado no município',
    userMessage: 'O prestador não possui cadastro no município informado.',
  },
  'E102': {
    category: 'BUSINESS',
    description: 'Regime tributário do prestador incompatível',
    userMessage: 'O regime tributário do prestador não permite emissão deste tipo de NFS-e.',
  },

  // ── Dados do Tomador ───────────────────────────────────────────────
  'E200': {
    category: 'BUSINESS',
    description: 'CPF/CNPJ do tomador inválido',
    userMessage: 'O documento (CPF/CNPJ) do tomador de serviços é inválido.',
  },
  'E201': {
    category: 'BUSINESS',
    description: 'Tomador pessoa física com CNPJ',
    userMessage: 'Tipo de documento incompatível com pessoa física.',
  },
  'E202': {
    category: 'BUSINESS',
    description: 'Endereço do tomador obrigatório para este município',
    userMessage: 'O endereço completo do tomador é obrigatório.',
  },
  'E203': {
    category: 'BUSINESS',
    description: 'Código IBGE do município do tomador inválido',
    userMessage: 'O código do município do tomador não é válido.',
  },

  // ── Dados do Serviço ───────────────────────────────────────────────
  'E300': {
    category: 'BUSINESS',
    description: 'Código de serviço (LC 116/2003) inválido',
    userMessage: 'O código de serviço informado não é válido pela LC 116/2003.',
  },
  'E301': {
    category: 'BUSINESS',
    description: 'Código de serviço não permitido neste município',
    userMessage: 'Este serviço não pode ser emitido no município do prestador.',
  },
  'E302': {
    category: 'BUSINESS',
    description: 'Valor do serviço menor que o mínimo permitido',
    userMessage: 'O valor do serviço está abaixo do mínimo permitido para emissão de NFS-e.',
  },
  'E303': {
    category: 'BUSINESS',
    description: 'Alíquota ISS diverge da tabela municipal',
    userMessage: 'A alíquota de ISS informada não corresponde à tabela do município.',
  },
  'E304': {
    category: 'BUSINESS',
    description: 'Valor do ISS calculado incorretamente',
    userMessage: 'O valor do ISS está inconsistente com a base de cálculo e alíquota informadas.',
  },
  'E305': {
    category: 'BUSINESS',
    description: 'Deduções excedem o valor do serviço',
    userMessage: 'O total de deduções não pode ser maior que o valor do serviço.',
  },

  // ── RPS ───────────────────────────────────────────────────────────
  'E400': {
    category: 'BUSINESS',
    description: 'Número do RPS já utilizado',
    userMessage: 'Já existe uma NFS-e emitida com este número de RPS.',
  },
  'E401': {
    category: 'BUSINESS',
    description: 'Série do RPS inválida',
    userMessage: 'A série do RPS informada não é válida.',
  },
  'E402': {
    category: 'BUSINESS',
    description: 'Número do RPS fora de sequência',
    userMessage: 'O número do RPS deve ser sequencial sem lacunas.',
  },

  // ── NFS-e já emitida / cancelamento ────────────────────────────────
  'E500': {
    category: 'BUSINESS',
    description: 'NFS-e não encontrada',
    userMessage: 'A NFS-e informada não foi encontrada.',
  },
  'E501': {
    category: 'BUSINESS',
    description: 'NFS-e já cancelada',
    userMessage: 'Esta NFS-e já foi cancelada anteriormente.',
  },
  'E502': {
    category: 'BUSINESS',
    description: 'Prazo de cancelamento expirado',
    userMessage: 'O prazo para cancelamento desta NFS-e expirou.',
  },
  'E503': {
    category: 'BUSINESS',
    description: 'Cancelamento não permitido — NFS-e vinculada a declaração',
    userMessage: 'Esta NFS-e está vinculada a uma declaração fiscal e não pode ser cancelada.',
  },

  // ── Municipais específicos ─────────────────────────────────────────
  'E600': {
    category: 'BUSINESS',
    description: 'Município não integrado à NFS-e Nacional',
    userMessage: 'O município do prestador ainda não aderiu ao sistema NFS-e Nacional.',
  },
  'E601': {
    category: 'BUSINESS',
    description: 'Código IBGE do município do prestador inválido',
    userMessage: 'O código IBGE do município do prestador não é válido.',
  },

  // ── Técnicos / Infraestrutura ──────────────────────────────────────
  'E900': {
    category: 'TECHNICAL',
    description: 'Serviço temporariamente indisponível',
    userMessage: 'O serviço da SEFAZ está temporariamente indisponível. Tente novamente.',
  },
  'E901': {
    category: 'TECHNICAL',
    description: 'Timeout na comunicação com a SEFAZ',
    userMessage: 'Timeout na comunicação com a SEFAZ.',
  },
  'E902': {
    category: 'TECHNICAL',
    description: 'Erro interno na SEFAZ',
    userMessage: 'Erro interno no sistema da SEFAZ. Tente novamente em alguns minutos.',
  },
  'E999': {
    category: 'TECHNICAL',
    description: 'Erro desconhecido',
    userMessage: 'Erro inesperado. Contate o suporte.',
  },
};

/**
 * Classifica um código de erro retornado pela SEFAZ.
 * Retorna TECHNICAL como fallback para códigos desconhecidos (retry seguro).
 */
export function classifyNfseError(code: string): NfseErrorDefinition {
  return (
    NFSE_ERROR_CODES[code] ?? {
      category: 'TECHNICAL',
      description: `Unknown error code: ${code}`,
      userMessage: `Erro na comunicação com a SEFAZ (código: ${code}).`,
    }
  );
}

/**
 * Determina se o erro deve ser retentado pelo BullMQ.
 * BUSINESS → false (não retentar — relançar seria inútil e custoso)
 * TECHNICAL → true (retentar com backoff)
 */
export function shouldRetry(code: string): boolean {
  return classifyNfseError(code).category === 'TECHNICAL';
}
