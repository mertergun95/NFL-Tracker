import { Link } from "react-router-dom";

/** İsmin sağ altında küçük pozisyon rozeti. */
export function PosTag({ pos }: { pos: string | null | undefined }) {
  if (!pos) return null;
  return <sub className="pos-tag">{String(pos)}</sub>;
}

/** Oyuncu adı + pozisyon alt-simgesi (id verilirse profil linki). */
export default function PName({ name, pos, id, base = "/player" }:
  { name: string | null | undefined; pos?: string | null; id?: string | null;
    base?: string }) {
  const inner = (
    <>
      {String(name ?? "—")}
      <PosTag pos={pos} />
    </>
  );
  return id ? <Link to={`${base}/${id}`}>{inner}</Link> : <span>{inner}</span>;
}
