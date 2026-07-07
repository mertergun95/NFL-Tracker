import { NavLink, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Players from "./pages/Players";
import PlayerDetail from "./pages/PlayerDetail";
import Teams from "./pages/Teams";
import TeamDetail from "./pages/TeamDetail";
import Games from "./pages/Games";
import Compare from "./pages/Compare";
import ChartsPage from "./pages/ChartsPage";
import Insights from "./pages/Insights";
import { loadManifest, seasonsFromManifest } from "./lib/data";
import { useAsync } from "./lib/hooks";
import { ErrorMsg, Loading } from "./components/Pickers";

const NAV = [
  { to: "/", label: "Dashboard" },
  { to: "/players", label: "Oyuncular" },
  { to: "/teams", label: "Takımlar" },
  { to: "/games", label: "Maçlar" },
  { to: "/compare", label: "Karşılaştır" },
  { to: "/charts", label: "Grafikler" },
  { to: "/insights", label: "Insights" },
];

export default function App() {
  const { data: manifest, error, loading } = useAsync(() => loadManifest(), []);
  const seasons = manifest ? seasonsFromManifest(manifest) : [];

  return (
    <div className="app">
      <header className="topbar">
        <span className="logo">🏈 NFL Tracker</span>
        <nav>
          {NAV.map(({ to, label }) => (
            <NavLink key={to} to={to} end={to === "/"}>{label}</NavLink>
          ))}
        </nav>
      </header>
      <main>
        {loading && <Loading />}
        {error && <ErrorMsg msg={error} />}
        {manifest && seasons.length > 0 && (
          <Routes>
            <Route path="/" element={<Dashboard manifest={manifest} seasons={seasons} />} />
            <Route path="/players" element={<Players seasons={seasons} />} />
            <Route path="/player/:id" element={<PlayerDetail seasons={seasons} />} />
            <Route path="/teams" element={<Teams seasons={seasons} />} />
            <Route path="/team/:abbr" element={<TeamDetail seasons={seasons} />} />
            <Route path="/games" element={<Games seasons={seasons} />} />
            <Route path="/compare" element={<Compare seasons={seasons} />} />
            <Route path="/charts" element={<ChartsPage seasons={seasons} />} />
            <Route path="/insights" element={<Insights />} />
          </Routes>
        )}
      </main>
      <footer>Veri: nflverse · Her Salı otomatik güncellenir</footer>
    </div>
  );
}
