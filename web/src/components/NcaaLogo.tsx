/** NCAA takım logosu (teams.json'daki ESPN href'i ile). */
export default function NcaaLogo({ src, size = 22 }:
  { src: string | null | undefined; size?: number }) {
  if (!src) return null;
  return (
    <img className="team-logo" src={src} width={size} height={size} alt=""
         loading="lazy"
         onError={(e) => { e.currentTarget.style.display = "none"; }} />
  );
}
