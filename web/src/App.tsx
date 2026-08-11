import { Link, NavLink, Route, Routes, useLocation } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Players from "./pages/Players";
import PlayerDetail from "./pages/PlayerDetail";
import Teams from "./pages/Teams";
import TeamDetail from "./pages/TeamDetail";
import Games from "./pages/Games";
import Compare from "./pages/Compare";
import ChartsPage from "./pages/ChartsPage";
import Insights from "./pages/Insights";
import Agent from "./pages/Agent";
import Power from "./pages/Power";
import Sos from "./pages/Sos";
import Projections from "./pages/Projections";
import GameDetail from "./pages/GameDetail";
import DepthCharts from "./pages/DepthCharts";
import Standings from "./pages/Standings";
import Matchups from "./pages/Matchups";
import Injuries from "./pages/Injuries";
import Accuracy from "./pages/Accuracy";
import PropFinder from "./pages/PropFinder";
import NcaaDashboard from "./pages/ncaa/NcaaDashboard";
import NcaaPlayers from "./pages/ncaa/NcaaPlayers";
import NcaaPlayerDetail from "./pages/ncaa/NcaaPlayerDetail";
import NcaaTeams from "./pages/ncaa/NcaaTeams";
import NcaaTeamDetail from "./pages/ncaa/NcaaTeamDetail";
import NcaaGames from "./pages/ncaa/NcaaGames";
import NcaaGameDetail from "./pages/ncaa/NcaaGameDetail";
import NcaaStandings from "./pages/ncaa/NcaaStandings";
import NcaaRosters from "./pages/ncaa/NcaaRosters";
import NcaaProjections from "./pages/ncaa/NcaaProjections";
import NcaaAccuracy from "./pages/ncaa/NcaaAccuracy";
import { loadManifest, seasonsFromManifest } from "./lib/data";
import { loadNcaaManifest } from "./lib/ncaa";
import { useAsync } from "./lib/hooks";
import { ErrorMsg, Loading } from "./components/Pickers";
import Logo from "./components/Logo";
import ThemeIcon from "./components/ThemeIcon";
import { LANG_NAMES, LANGS, useI18n } from "./lib/i18n";
import { useTheme } from "./lib/theme";

const NAV = [
  { to: "/", key: "nav.dashboard" },
  { to: "/players", key: "nav.players" },
  { to: "/teams", key: "nav.teams" },
  { to: "/standings", key: "nav.standings" },
  { to: "/depth", key: "nav.depth" },
  { to: "/games", key: "nav.games" },
  { to: "/matchups", key: "nav.matchups" },
  { to: "/props", key: "nav.props" },
  { to: "/compare", key: "nav.compare" },
  { to: "/charts", key: "nav.charts" },
  { to: "/projections", key: "nav.projections" },
  { to: "/injuries", key: "nav.injuries" },
  { to: "/accuracy", key: "nav.accuracy" },
  { to: "/power", key: "nav.power" },
  { to: "/sos", key: "nav.sos" },
  { to: "/insights", key: "nav.insights" },
  { to: "/agent", key: "nav.agent" },
];

const NCAA_NAV = [
  { to: "/ncaa", key: "nav.dashboard" },
  { to: "/ncaa/players", key: "nav.players" },
  { to: "/ncaa/teams", key: "nav.teams" },
  { to: "/ncaa/standings", key: "nav.standings" },
  { to: "/ncaa/rosters", key: "nav.rosters" },
  { to: "/ncaa/games", key: "nav.games" },
  { to: "/ncaa/power", key: "nav.power" },
  { to: "/ncaa/projections", key: "nav.projections" },
  { to: "/ncaa/accuracy", key: "nav.accuracy" },
];

export default function App() {
  const location = useLocation();
  const { t, lang, setLang } = useI18n();
  const { theme, toggle } = useTheme();
  const isNcaa = location.pathname.startsWith("/ncaa");
  const { data: manifest, error, loading } = useAsync(() => loadManifest(), []);
  const seasons = manifest ? seasonsFromManifest(manifest) : [];
  const { data: ncaaManifest } = useAsync(() => loadNcaaManifest(), []);
  const ncaaSeasons = ncaaManifest ? seasonsFromManifest(ncaaManifest) : [];

  return (
    <div className="app">
      <header className="topbar">
        <Link to={isNcaa ? "/ncaa" : "/"} className="logo">
          <Logo /> {t("app.brand")}
        </Link>
        <span className="league-switch">
          <Link to="/" className={!isNcaa ? "active" : ""}>NFL</Link>
          <Link to="/ncaa" className={isNcaa ? "active" : ""}>NCAA</Link>
        </span>
        <nav>
          {(isNcaa ? NCAA_NAV : NAV).map(({ to, key }) => (
            <NavLink key={to} to={to} end={to === "/" || to === "/ncaa"}>
              {t(key)}
            </NavLink>
          ))}
        </nav>
        <span className="lang-switch" title={t("nav.language")}>
          {LANGS.map((l) => (
            <button key={l} className={l === lang ? "active" : ""}
                    onClick={() => setLang(l)}>{LANG_NAMES[l]}</button>
          ))}
        </span>
        <button className="theme-toggle" onClick={toggle}
                title={t(theme === "dark" ? "nav.themeLight" : "nav.themeDark")}
                aria-label={t(theme === "dark" ? "nav.themeLight" : "nav.themeDark")}>
          <ThemeIcon theme={theme} />
        </button>
      </header>
      <main>
        {loading && <Loading />}
        {error && !isNcaa && <ErrorMsg msg={error} />}
        {isNcaa && !ncaaManifest && !loading && (
          <p className="empty">
            {t("ncaa.notReadyGeneric")}
          </p>
        )}
        <Routes>
          {manifest && seasons.length > 0 && (
            <>
              <Route path="/" element={<Dashboard manifest={manifest} seasons={seasons} />} />
              <Route path="/players" element={<Players seasons={seasons} />} />
              <Route path="/player/:id" element={<PlayerDetail seasons={seasons} />} />
              <Route path="/teams" element={<Teams seasons={seasons} />} />
              <Route path="/team/:abbr" element={<TeamDetail seasons={seasons} />} />
              <Route path="/games" element={<Games seasons={seasons} />} />
              <Route path="/compare" element={<Compare seasons={seasons} />} />
              <Route path="/charts" element={<ChartsPage seasons={seasons} />} />
              <Route path="/projections" element={<Projections />} />
              <Route path="/depth" element={<DepthCharts />} />
              <Route path="/standings" element={<Standings seasons={seasons} />} />
              <Route path="/matchups" element={<Matchups />} />
              <Route path="/props" element={<PropFinder seasons={seasons} />} />
              <Route path="/injuries" element={<Injuries />} />
              <Route path="/accuracy" element={<Accuracy />} />
              <Route path="/insights" element={<Insights />} />
              <Route path="/agent" element={<Agent />} />
              <Route path="/power" element={<Power />} />
              <Route path="/sos" element={<Sos />} />
              <Route path="/game/:season/:gameId" element={<GameDetail />} />
            </>
          )}
          {ncaaManifest && ncaaSeasons.length > 0 && (
            <>
              <Route path="/ncaa" element={<NcaaDashboard seasons={ncaaSeasons} />} />
              <Route path="/ncaa/players" element={<NcaaPlayers seasons={ncaaSeasons} />} />
              <Route path="/ncaa/player/:id" element={<NcaaPlayerDetail seasons={ncaaSeasons} />} />
              <Route path="/ncaa/teams" element={<NcaaTeams seasons={ncaaSeasons} />} />
              <Route path="/ncaa/team/:abbr" element={<NcaaTeamDetail seasons={ncaaSeasons} />} />
              <Route path="/ncaa/games" element={<NcaaGames seasons={ncaaSeasons} />} />
              <Route path="/ncaa/game/:season/:gameId" element={<NcaaGameDetail />} />
              <Route path="/ncaa/standings" element={<NcaaStandings seasons={ncaaSeasons} />} />
              <Route path="/ncaa/rosters" element={<NcaaRosters />} />
              <Route path="/ncaa/power" element={<Power league="ncaa" />} />
              <Route path="/ncaa/projections" element={<NcaaProjections />} />
              <Route path="/ncaa/accuracy" element={<NcaaAccuracy />} />
            </>
          )}
        </Routes>
      </main>
      <footer>
        <p className="foot-src">
          {t("app.footer.data")}:{" "}
          <a href="https://github.com/nflverse/nflverse-data"
             target="_blank" rel="noopener noreferrer">nflverse</a>{" ("}
          <a href="https://creativecommons.org/licenses/by/4.0/"
             target="_blank" rel="noopener noreferrer">CC BY 4.0</a>
          {"), "}{t("app.footer.modified")} · {t("app.footer.ncaa")}:{" "}
          <a href="https://www.espn.com" target="_blank"
             rel="noopener noreferrer">ESPN</a> · {t("app.footer.updated")}
        </p>
        <p className="foot-legal">{t("app.footer.disclaimer")}</p>
      </footer>
    </div>
  );
}
