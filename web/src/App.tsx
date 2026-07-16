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
import Projections from "./pages/Projections";
import GameDetail from "./pages/GameDetail";
import DepthCharts from "./pages/DepthCharts";
import Standings from "./pages/Standings";
import Matchups from "./pages/Matchups";
import Injuries from "./pages/Injuries";
import Accuracy from "./pages/Accuracy";
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

const NAV = [
  { to: "/", label: "Dashboard" },
  { to: "/players", label: "Oyuncular" },
  { to: "/teams", label: "Takımlar" },
  { to: "/standings", label: "Puan Durumu" },
  { to: "/depth", label: "Kadrolar" },
  { to: "/games", label: "Maçlar" },
  { to: "/matchups", label: "Matchuplar" },
  { to: "/compare", label: "Karşılaştır" },
  { to: "/charts", label: "Deep Charts" },
  { to: "/projections", label: "Projeksiyonlar" },
  { to: "/injuries", label: "Sakatlıklar" },
  { to: "/accuracy", label: "Karne" },
  { to: "/insights", label: "Insights" },
];

const NCAA_NAV = [
  { to: "/ncaa", label: "Dashboard" },
  { to: "/ncaa/players", label: "Oyuncular" },
  { to: "/ncaa/teams", label: "Takımlar" },
  { to: "/ncaa/standings", label: "Puan Durumu" },
  { to: "/ncaa/rosters", label: "Kadrolar" },
  { to: "/ncaa/games", label: "Maçlar" },
  { to: "/ncaa/projections", label: "Projeksiyonlar" },
  { to: "/ncaa/accuracy", label: "Karne" },
];

export default function App() {
  const location = useLocation();
  const isNcaa = location.pathname.startsWith("/ncaa");
  const { data: manifest, error, loading } = useAsync(() => loadManifest(), []);
  const seasons = manifest ? seasonsFromManifest(manifest) : [];
  const { data: ncaaManifest } = useAsync(() => loadNcaaManifest(), []);
  const ncaaSeasons = ncaaManifest ? seasonsFromManifest(ncaaManifest) : [];

  return (
    <div className="app">
      <header className="topbar">
        <span className="logo">🏈 {isNcaa ? "NCAA" : "NFL"} Tracker</span>
        <span className="league-switch">
          <Link to="/" className={!isNcaa ? "active" : ""}>NFL</Link>
          <Link to="/ncaa" className={isNcaa ? "active" : ""}>NCAA</Link>
        </span>
        <nav>
          {(isNcaa ? NCAA_NAV : NAV).map(({ to, label }) => (
            <NavLink key={to} to={to} end={to === "/" || to === "/ncaa"}>
              {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main>
        {loading && <Loading />}
        {error && !isNcaa && <ErrorMsg msg={error} />}
        {isNcaa && !ncaaManifest && !loading && (
          <p className="empty">
            NCAA verisi henüz üretilmedi — pipeline'ın ilk koşusunu bekleyin.
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
              <Route path="/injuries" element={<Injuries />} />
              <Route path="/accuracy" element={<Accuracy />} />
              <Route path="/insights" element={<Insights />} />
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
              <Route path="/ncaa/projections" element={<NcaaProjections />} />
              <Route path="/ncaa/accuracy" element={<NcaaAccuracy />} />
            </>
          )}
        </Routes>
      </main>
      <footer>
        Veri: nflverse + ESPN (NCAA) · Her Salı otomatik güncellenir
      </footer>
    </div>
  );
}
