/** A marca da plataforma. É "Central" mais o nome da marca ativa —
 *  Central Botanika, Central VermeFree — e nunca um nome fixo, porque a
 *  terceira marca entra por cadastro. */
export function Marca({ nome, cor }: { nome?: string | null; cor?: string | null }) {
  return (
    <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
      <span className="text-[15px] font-semibold tracking-[-0.01em] text-tinta">
        Central
      </span>
      {nome ? (
        <span
          className="text-[15px] font-normal tracking-[-0.01em]"
          style={{ color: cor ?? 'var(--tinta-2)' }}
        >
          {nome}
        </span>
      ) : null}
    </span>
  );
}
