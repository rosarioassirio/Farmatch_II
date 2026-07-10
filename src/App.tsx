import {
  BrowserRouter,
  Routes,
  Route,
} from "react-router-dom";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import DashboardPaciente from "./pages/DashboardPaciente";
import DashboardMedico from "./pages/DashboardMedico";
import DashboardFarmacia from "./pages/DashboardFarmacia";
import MisRecetas from "./pages/MisRecetas";
import BuscarMedicamentos from "./pages/BuscarMedicamentos";
import FarmaciasCercanas from "./pages/FarmaciasCercanas";
import MisReservas from "./pages/MisReservas";
import { useEffect } from "react";


function App() {
  useEffect(() => {
    const theme = localStorage.getItem("theme");
    if (theme === "dark") document.documentElement.classList.add("dark");
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/paciente" element={<DashboardPaciente />} />
        <Route path="/medico" element={<DashboardMedico />} />
        <Route path="/farmacia" element={<DashboardFarmacia />} />
        <Route path="/mis-recetas" element={<MisRecetas />} />
        <Route path="/buscar-medicamentos" element={<BuscarMedicamentos />} />
        <Route path="/farmacias-cercanas" element={<FarmaciasCercanas />} />
        <Route path="/mis-reservas" element={<MisReservas />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;