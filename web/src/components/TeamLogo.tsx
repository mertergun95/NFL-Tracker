import { teamLogoUrl } from "../lib/teams";

/** Takım logosu (ESPN CDN); yüklenemezse görünmez. */
export default function TeamLogo({ abbr, size = 22 }:
  { abbr: string | null; size?: number }) {
  if (!abbr) return null;
  return (
    <img className="team-logo" src={teamLogoUrl(abbr)} alt=""
         width={size} height={size} loading="lazy"
         onError={(e) => { e.currentTarget.style.display = "none"; }} />
  );
}
