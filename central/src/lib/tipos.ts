export type Papel = 'admin' | 'gestor' | 'membro' | 'externo';

export type Marca = {
  id: string;
  nome: string;
  slug: string;
  cor: string;
  ativo: boolean;
};

export type Area = {
  id: string;
  nome: string;
  slug: string;
  descricao: string | null;
  ordem: number;
};

export type Perfil = {
  id: string;
  nome: string;
  email: string;
  foto_url: string | null;
  area_id: string | null;
  cargo: string | null;
  papel: Papel;
  ativo: boolean;
};

/** Tudo que uma tela precisa saber sobre quem está logado, lido de uma
 *  vez no servidor em vez de a cada componente. */
export type Sessao = {
  perfil: Perfil;
  area: Area | null;
  marcas: Marca[];
  marcaAtiva: Marca | null;
};

export const NOME_PAPEL: Record<Papel, string> = {
  admin: 'Administrador',
  gestor: 'Gestor',
  membro: 'Membro',
  externo: 'Externo',
};
