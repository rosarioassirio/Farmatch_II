import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import { useNavigate } from "react-router-dom";
import { FarmatchLogoHorizontal } from "../components/FarmatchLogo";
import ChatIA from "../components/ChatIA";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from "recharts";
import { LogOut, Sun, Moon } from "lucide-react";
import { useDarkMode } from "../hooks/useDarkMode";

const ESTADOS = [
    { key: "pendiente", label: "Pendiente", color: "bg-yellow-100 text-yellow-700", dot: "bg-yellow-400" },
    { key: "preparando", label: "Preparando", color: "bg-blue-100 text-blue-700", dot: "bg-blue-400" },
    { key: "lista", label: "Lista para retirar", color: "bg-green-100 text-green-700", dot: "bg-green-400" },
    { key: "entregada", label: "Entregada", color: "bg-slate-100 text-slate-600", dot: "bg-slate-400" },
    { key: "cancelada", label: "Cancelada", color: "bg-red-100 text-red-700", dot: "bg-red-400" },
];
const SIGUIENTE_ESTADO: Record<string, string> = { pendiente: "preparando", preparando: "lista", lista: "entregada" };
const COLORES = ["#3b82f6", "#60a5fa", "#93c5fd", "#1d4ed8", "#ef4444", "#a5b4fc"];
const LIMITE_STOCK_BAJO = 5;
const AVATAR_COLORES = ["bg-blue-400", "bg-blue-500", "bg-blue-600", "bg-blue-700", "bg-indigo-500", "bg-sky-500"];
type Vista = "pedidos" | "estadisticas" | "stock";

function Avatar({ nombre, apellido }: { nombre: string; apellido: string }) {
    const iniciales = `${nombre?.[0] ?? ""}${apellido?.[0] ?? ""}`.toUpperCase();
    const color = AVATAR_COLORES[(nombre?.charCodeAt(0) ?? 0) % AVATAR_COLORES.length];
    return <div className={`${color} flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white`}>{iniciales}</div>;
}

export default function DashboardFarmacia() {
    const navigate = useNavigate();
    const { dark, toggle } = useDarkMode();
    const [vista, setVista] = useState<Vista>("pedidos");
    const [nombreFarmacia, setNombreFarmacia] = useState("");
    const [idFarmacia, setIdFarmacia] = useState<number | null>(null);
    const [reservas, setReservas] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filtroEstado, setFiltroEstado] = useState("todos");
    const [medsMasBuscados, setMedsMasBuscados] = useState<any[]>([]);
    const [medsFaltantes, setMedsFaltantes] = useState<any[]>([]);
    const [reservasPorDia, setReservasPorDia] = useState<any[]>([]);
    const [estadosPie, setEstadosPie] = useState<any[]>([]);
    const [tiempoPromedio, setTiempoPromedio] = useState<number | null>(null);
    const [loadingStats, setLoadingStats] = useState(true);
    const [stock, setStock] = useState<any[]>([]);
    const [loadingStock, setLoadingStock] = useState(true);
    const [busquedaStock, setBusquedaStock] = useState("");
    const [editando, setEditando] = useState<number | null>(null);
    const [editCantidad, setEditCantidad] = useState("");
    const [editPrecio, setEditPrecio] = useState("");
    const [mostrandoSoloBajos, setMostrandoSoloBajos] = useState(false);
    const [agregando, setAgregando] = useState(false);
    const [nuevoMed, setNuevoMed] = useState("");
    const [nuevaCantidad, setNuevaCantidad] = useState("");
    const [nuevoPrecio, setNuevoPrecio] = useState("");
    const [medicamentosDisponibles, setMedicamentosDisponibles] = useState<any[]>([]);
    const [busquedaPaciente, setBusquedaPaciente] = useState("");
    const [notaAbierta, setNotaAbierta] = useState<number | null>(null);
    const [textoNota, setTextoNota] = useState("");
    const [guardandoNota, setGuardandoNota] = useState(false);

    const card = "rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm";
    const input = "rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-400";

    async function cerrarSesion() { await supabase.auth.signOut(); navigate("/"); }

    useEffect(() => {
        async function cargarDatos() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data: perfil } = await supabase.from("perfiles").select("*").eq("id", user.id).single();
            if (!perfil) return;
            const { data: farmacia } = await supabase.from("farmacias").select("*").eq("id_farmacia", perfil.ficha_id).single();
            if (!farmacia) return;
            setNombreFarmacia(farmacia.nombre);
            setIdFarmacia(farmacia.id_farmacia);
        }
        cargarDatos();
    }, []);

    useEffect(() => {
        if (!idFarmacia) return;
        cargarReservas(); cargarEstadisticas(); cargarStock(); cargarMedicamentosDisponibles();
    }, [idFarmacia]);

    async function cargarMedicamentosDisponibles() {
        const { data } = await supabase.from("medicamentos").select("*").order("nombre_generico");
        if (data) setMedicamentosDisponibles(data);
    }

    async function cargarStock() {
        if (!idFarmacia) return;
        const { data: stockData } = await supabase.from("stock").select("*").eq("id_farmacia", idFarmacia).order("cantidad_disponible", { ascending: true });
        if (!stockData) { setLoadingStock(false); return; }
        const idsMeds = stockData.map((s: any) => s.id_medicamento);
        const { data: medsData } = await supabase.from("medicamentos").select("*").in("id_medicamento", idsMeds);
        setStock(stockData.map((s: any) => ({ ...s, medicamento: medsData?.find((m: any) => m.id_medicamento === s.id_medicamento) })));
        setLoadingStock(false);
    }

    async function guardarEdicion(idStock: number) {
        const { error } = await supabase.from("stock").update({ cantidad_disponible: parseInt(editCantidad), precio: parseFloat(editPrecio), ultima_actualizacion: new Date().toISOString() }).eq("id_stock", idStock);
        if (!error) { setStock((prev: any[]) => prev.map((s) => s.id_stock === idStock ? { ...s, cantidad_disponible: parseInt(editCantidad), precio: parseFloat(editPrecio) } : s)); setEditando(null); }
    }

    async function agregarMedicamento() {
        if (!idFarmacia || !nuevoMed || !nuevaCantidad || !nuevoPrecio) return;
        const { error } = await supabase.from("stock").insert({ id_farmacia: idFarmacia, id_medicamento: parseInt(nuevoMed), cantidad_disponible: parseInt(nuevaCantidad), precio: parseFloat(nuevoPrecio), ultima_actualizacion: new Date().toISOString() });
        if (!error) { setAgregando(false); setNuevoMed(""); setNuevaCantidad(""); setNuevoPrecio(""); cargarStock(); }
    }

    async function eliminarStock(idStock: number) {
        if (!confirm("¿Eliminar este medicamento del stock?")) return;
        const { error } = await supabase.from("stock").delete().eq("id_stock", idStock);
        if (!error) setStock((prev) => prev.filter((s) => s.id_stock !== idStock));
    }

    async function cargarReservas() {
        if (!idFarmacia) return;
        const { data: reservasData } = await supabase.from("reservas").select("*").eq("id_farmacia", idFarmacia).order("fecha", { ascending: false });
        if (!reservasData || reservasData.length === 0) { setLoading(false); return; }
        const idsPacientes = [...new Set(reservasData.map((r) => r.id_paciente))];
        const { data: pacientesData } = await supabase.from("pacientes").select("*").in("id_paciente", idsPacientes);
        setReservas(reservasData.map((r) => ({ ...r, paciente: pacientesData?.find((p) => p.id_paciente === r.id_paciente) })));
        setLoading(false);
    }

    async function cargarEstadisticas() {
        if (!idFarmacia) return;
        const { data: busquedasData } = await supabase.from("busquedas").select("id_medicamento").eq("id_farmacia", idFarmacia);
        if (busquedasData && busquedasData.length > 0) {
            const idsMeds = busquedasData.map((b) => b.id_medicamento).filter(Boolean);
            const conteo: Record<number, number> = {};
            idsMeds.forEach((id) => { conteo[id] = (conteo[id] || 0) + 1; });
            const topIds = Object.entries(conteo).sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, 6).map(([id]) => Number(id));
            const { data: medsData } = await supabase.from("medicamentos").select("*").in("id_medicamento", topIds);
            if (medsData) setMedsMasBuscados(topIds.map((id) => ({ nombre: medsData.find((m) => m.id_medicamento === id)?.nombre_generico ?? id, cantidad: conteo[id] })));
        }
        const { data: faltantesData } = await supabase.from("busquedas").select("id_medicamento").eq("id_farmacia", idFarmacia).eq("resultado", "no_encontrado");
        if (faltantesData && faltantesData.length > 0) {
            const idsMeds = faltantesData.map((b) => b.id_medicamento).filter(Boolean);
            const conteo: Record<number, number> = {};
            idsMeds.forEach((id) => { conteo[id] = (conteo[id] || 0) + 1; });
            const topIds = Object.entries(conteo).sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, 6).map(([id]) => Number(id));
            const { data: medsData } = await supabase.from("medicamentos").select("*").in("id_medicamento", topIds);
            if (medsData) setMedsFaltantes(topIds.map((id) => ({ nombre: medsData.find((m) => m.id_medicamento === id)?.nombre_generico ?? id, oportunidades: conteo[id] })));
        }
        const { data: todasReservas } = await supabase.from("reservas").select("fecha").eq("id_farmacia", idFarmacia);
        if (todasReservas) {
            const hoy = new Date();
            const dias: Record<string, number> = {};
            for (let i = 6; i >= 0; i--) { const d = new Date(hoy); d.setDate(d.getDate() - i); const key = d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", timeZone: "America/Argentina/Buenos_Aires" }); dias[key] = 0; }
            todasReservas.forEach((r) => { const key = new Date(r.fecha).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", timeZone: "America/Argentina/Buenos_Aires" }); if (key in dias) dias[key]++; });
            setReservasPorDia(Object.entries(dias).map(([dia, cantidad]) => ({ dia, cantidad })));
        }
        const { data: reservasEstados } = await supabase.from("reservas").select("estado, fecha").eq("id_farmacia", idFarmacia);
        if (reservasEstados) {
            const conteo: Record<string, number> = { pendiente: 0, preparando: 0, lista: 0, entregada: 0, cancelada: 0 };
            reservasEstados.forEach((r) => { const key = r.estado?.trim().toLowerCase(); if (key in conteo) conteo[key]++; });
            setEstadosPie(Object.entries(conteo).map(([name, value]) => ({ name: ESTADOS.find(e => e.key === name)?.label ?? name, value })).filter(e => e.value > 0));
            const entregadas = reservasEstados.filter(r => r.estado === "entregada");
            if (entregadas.length > 0) {
                const hoy = new Date();
                const promedioHoras = entregadas.reduce((acc, r) => acc + (hoy.getTime() - new Date(r.fecha).getTime()) / (1000 * 60 * 60), 0) / entregadas.length;
                setTiempoPromedio(Math.round(promedioHoras));
            }
        }
        setLoadingStats(false);
    }

    async function avanzarEstado(reserva: any) {
        const siguiente = SIGUIENTE_ESTADO[reserva.estado];
        if (!siguiente) return;
        const { error } = await supabase.from("reservas").update({ estado: siguiente }).eq("id_reserva", reserva.id_reserva);
        if (error) return;
        setReservas((prev) => prev.map((r) => r.id_reserva === reserva.id_reserva ? { ...r, estado: siguiente } : r));
        if (siguiente === "entregada") {
            const { data: reservaItems } = await supabase.from("reserva_items").select("id_item").eq("id_reserva", reserva.id_reserva);
            if (reservaItems && reservaItems.length > 0) {
                const idsItems = reservaItems.map((ri) => ri.id_item);
                await supabase.from("receta_items").update({ entregado: true }).in("id_item", idsItems);
                const { data: itemsData } = await supabase.from("receta_items").select("id_receta, entregado").in("id_item", idsItems);
                if (itemsData) {
                    const idsRecetas = [...new Set(itemsData.map((i) => i.id_receta))];
                    for (const idReceta of idsRecetas) {
                        const { data: todosItems } = await supabase.from("receta_items").select("entregado").eq("id_receta", idReceta);
                        if (todosItems && todosItems.every((i) => i.entregado)) await supabase.from("recetas").update({ estado: "completada" }).eq("id_receta", idReceta);
                    }
                }
            }
        }
    }

    async function cancelarReserva(reserva: any) {
        if (!confirm(`¿Cancelar la reserva de ${reserva.paciente?.nombre} ${reserva.paciente?.apellido}?`)) return;
        const { error } = await supabase.from("reservas").update({ estado: "cancelada" }).eq("id_reserva", reserva.id_reserva);
        if (!error) setReservas((prev) => prev.map((r) => r.id_reserva === reserva.id_reserva ? { ...r, estado: "cancelada" } : r));
    }

    async function guardarNota(idReserva: number) {
        setGuardandoNota(true);
        const { error } = await supabase.from("reservas").update({ nota_interna: textoNota }).eq("id_reserva", idReserva);
        if (!error) { setReservas((prev) => prev.map((r) => r.id_reserva === idReserva ? { ...r, nota_interna: textoNota } : r)); setNotaAbierta(null); setTextoNota(""); }
        setGuardandoNota(false);
    }

    function getEstado(key: string) { return ESTADOS.find((e) => e.key === key) ?? ESTADOS[0]; }
    function formatFecha(fecha: string) { return new Date(fecha).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); }

    const reservasFiltradas = reservas.filter((r) => filtroEstado === "todos" || r.estado === filtroEstado).filter((r) => { if (!busquedaPaciente) return true; const q = busquedaPaciente.toLowerCase(); return r.paciente?.nombre?.toLowerCase().includes(q) || r.paciente?.apellido?.toLowerCase().includes(q) || r.paciente?.dni?.toLowerCase().includes(q); });
    const contadores = { pendiente: reservas.filter((r) => r.estado === "pendiente").length, preparando: reservas.filter((r) => r.estado === "preparando").length, lista: reservas.filter((r) => r.estado === "lista").length, entregada: reservas.filter((r) => r.estado === "entregada").length, cancelada: reservas.filter((r) => r.estado === "cancelada").length };
    const stockFiltrado = stock.filter((s) => mostrandoSoloBajos ? s.cantidad_disponible <= LIMITE_STOCK_BAJO : true).filter((s) => busquedaStock === "" || s.medicamento?.nombre_generico?.toLowerCase().includes(busquedaStock.toLowerCase()));
    const stockBajos = stock.filter((s) => s.cantidad_disponible <= LIMITE_STOCK_BAJO);
    const tooltipStyle = { borderRadius: "12px", border: "none", backgroundColor: dark ? "#1e293b" : "#fff", color: dark ? "#f1f5f9" : "#1e293b" };
    const gridStroke = dark ? "#334155" : "#f1f5f9";

    return (
        <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-900">
            <header className="bg-white dark:bg-slate-800 border-b-2 border-blue-600 shadow-sm">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-8 py-3">
                    <FarmatchLogoHorizontal height={48} />
                    <div className="flex items-center gap-3">
                        <button onClick={toggle} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition">
                            {dark ? <Sun size={18} /> : <Moon size={18} />}
                        </button>
                        <div className="text-right">
                            <p className="font-semibold text-slate-800 dark:text-slate-100">{nombreFarmacia}</p>
                            <p className="text-sm text-slate-400">farmacia</p>
                        </div>
                        <button onClick={cerrarSesion} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-red-500 transition px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
                            <LogOut size={15} /><span>Salir</span>
                        </button>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-5xl p-8">
                <div className="mb-8 flex gap-3 flex-wrap">
                    {[{ key: "pedidos", label: "Pedidos recibidos" }, { key: "estadisticas", label: "Estadísticas" }, { key: "stock", label: "Mi Stock" }].map((tab) => (
                        <button key={tab.key} onClick={() => setVista(tab.key as Vista)} className={`rounded-xl px-6 py-3 font-semibold transition ${vista === tab.key ? "bg-blue-600 text-white shadow-md shadow-blue-200" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700"}`}>
                            {tab.label}
                            {tab.key === "stock" && stockBajos.length > 0 && <span className="ml-2 rounded-full bg-red-500 px-2 py-0.5 text-xs text-white">{stockBajos.length}</span>}
                        </button>
                    ))}
                </div>

                {vista === "pedidos" && (
                    <>
                        <div className="mb-8 grid grid-cols-5 gap-3">
                            {ESTADOS.map((e) => (
                                <div key={e.key} className={`${card} p-4 flex flex-col items-center gap-1`}>
                                    <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{contadores[e.key as keyof typeof contadores]}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium text-center leading-tight">{e.label}</p>
                                </div>
                            ))}
                        </div>
                        <div className="mb-4">
                            <input type="text" placeholder="Buscar por nombre o DNI..." value={busquedaPaciente} onChange={(e) => setBusquedaPaciente(e.target.value)} className={`w-full p-3 text-sm ${input}`} />
                        </div>
                        <div className="mb-6 flex gap-2 flex-wrap">
                            <button onClick={() => setFiltroEstado("todos")} className={`rounded-xl px-4 py-2 text-sm font-medium transition ${filtroEstado === "todos" ? "bg-blue-600 text-white" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700"}`}>Todos ({reservas.length})</button>
                            {ESTADOS.map((e) => (
                                <button key={e.key} onClick={() => setFiltroEstado(e.key)} className={`rounded-xl px-4 py-2 text-sm font-medium transition ${filtroEstado === e.key ? "bg-blue-600 text-white" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700"}`}>
                                    {e.label} ({contadores[e.key as keyof typeof contadores]})
                                </button>
                            ))}
                        </div>
                        {loading ? <p className="text-slate-400">Cargando pedidos...</p> : reservasFiltradas.length === 0 ? (
                            <div className={`${card} p-12 text-center`}><p className="text-lg font-semibold text-slate-600 dark:text-slate-300">{filtroEstado === "todos" ? "No hay pedidos todavía" : `No hay pedidos "${getEstado(filtroEstado).label}"`}</p></div>
                        ) : (
                            <div className="space-y-3">
                                {reservasFiltradas.map((r) => {
                                    const siguiente = SIGUIENTE_ESTADO[r.estado];
                                    const notaEstaAbierta = notaAbierta === r.id_reserva;
                                    return (
                                        <div key={r.id_reserva} className={`${card} p-5 hover:shadow-md transition`}>
                                            <div className="flex items-start gap-4">
                                                <Avatar nombre={r.paciente?.nombre ?? ""} apellido={r.paciente?.apellido ?? ""} />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div>
                                                            <p className="font-bold text-slate-800 dark:text-slate-100">{r.paciente?.nombre} {r.paciente?.apellido}</p>
                                                            <p className="text-sm text-slate-400">DNI {r.paciente?.dni} · {r.paciente?.obra_social} · {formatFecha(r.fecha)}</p>
                                                        </div>
                                                        <div className="flex items-center gap-2 flex-shrink-0">
                                                            {r.estado === "cancelada" ? (
                                                                <span className="rounded-full px-3 py-1 text-xs font-semibold bg-red-100 text-red-700">Cancelada</span>
                                                            ) : r.estado === "entregada" ? (
                                                                <span className="rounded-full px-3 py-1 text-xs font-semibold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">Entregada</span>
                                                            ) : (
                                                                <>
                                                                    {siguiente && <button onClick={() => avanzarEstado(r)} className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs text-white font-medium hover:bg-blue-700 transition">→ {getEstado(siguiente).label}</button>}
                                                                    <button onClick={() => cancelarReserva(r)} className="rounded-xl bg-red-50 px-3 py-1.5 text-xs text-red-600 font-medium hover:bg-red-100 transition">Cancelar</button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {r.estado !== "cancelada" && (
                                                        <div className="mt-3 flex gap-1.5">
                                                            {ESTADOS.filter(e => e.key !== "cancelada").map((e, i) => {
                                                                const idx = ESTADOS.filter(e => e.key !== "cancelada").findIndex((x) => x.key === r.estado);
                                                                const activo = i <= idx; const esActual = i === idx;
                                                                return (
                                                                    <div key={e.key} className="flex-1">
                                                                        <div className={`h-1.5 rounded-full transition-all ${activo ? "bg-blue-500" : "bg-slate-200 dark:bg-slate-600"}`} />
                                                                        <p className={`mt-1 text-xs text-center ${esActual ? "text-blue-600 font-semibold" : activo ? "text-blue-400" : "text-slate-300 dark:text-slate-500"}`}>{e.label}</p>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                    <div className="mt-3">
                                                        {r.nota_interna && !notaEstaAbierta && (
                                                            <p className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-700 rounded-lg px-3 py-2 border border-slate-200 dark:border-slate-600">
                                                                <span className="font-medium text-slate-600 dark:text-slate-300">Nota: </span>{r.nota_interna}
                                                            </p>
                                                        )}
                                                        {notaEstaAbierta ? (
                                                            <div className="flex gap-2 mt-1">
                                                                <input type="text" value={textoNota} onChange={(e) => setTextoNota(e.target.value)} placeholder="Agregar nota interna..." className={`flex-1 px-3 py-2 text-sm ${input}`} autoFocus />
                                                                <button onClick={() => guardarNota(r.id_reserva)} disabled={guardandoNota} className="rounded-xl bg-blue-600 px-3 py-2 text-xs text-white hover:bg-blue-700 disabled:opacity-50">Guardar</button>
                                                                <button onClick={() => { setNotaAbierta(null); setTextoNota(""); }} className="rounded-xl bg-slate-100 dark:bg-slate-700 px-3 py-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600">Cancelar</button>
                                                            </div>
                                                        ) : (
                                                            <button onClick={() => { setNotaAbierta(r.id_reserva); setTextoNota(r.nota_interna ?? ""); }} className="mt-1 text-xs text-slate-400 hover:text-blue-500 transition">
                                                                {r.nota_interna ? "Editar nota" : "+ Agregar nota interna"}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}

                {vista === "estadisticas" && (
                    <div className="space-y-6">
                        {loadingStats ? <p className="text-slate-400">Cargando estadísticas...</p> : (
                            <>
                                {tiempoPromedio !== null && (
                                    <div className={`${card} p-6 flex items-center gap-6`}>
                                        <div>
                                            <p className="text-4xl font-bold text-blue-600">{tiempoPromedio < 48 ? `${tiempoPromedio}h` : `${Math.round(tiempoPromedio / 24)}d`}</p>
                                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mt-1">Tiempo promedio por pedido</p>
                                            <p className="text-xs text-slate-400">Desde que se hace la reserva hasta que se entrega</p>
                                        </div>
                                        <div className="ml-auto text-right">
                                            <p className="text-sm text-slate-500 dark:text-slate-400">{contadores.entregada} pedido{contadores.entregada !== 1 ? "s" : ""} entregado{contadores.entregada !== 1 ? "s" : ""}</p>
                                        </div>
                                    </div>
                                )}
                                <div className={`${card} p-6`}>
                                    <h2 className="mb-1 text-base font-bold text-slate-800 dark:text-slate-100">Reservas últimos 7 días</h2>
                                    <p className="mb-4 text-sm text-slate-400">Actividad de pedidos en tu farmacia</p>
                                    <ResponsiveContainer width="100%" height={200}>
                                        <LineChart data={reservasPorDia}>
                                            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                                            <XAxis dataKey="dia" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                                            <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                                            <Tooltip contentStyle={tooltipStyle} />
                                            <Line type="monotone" dataKey="cantidad" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 4, fill: "#3b82f6" }} name="Reservas" />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="grid md:grid-cols-2 gap-6">
                                    <div className={`${card} p-6`}>
                                        <h2 className="mb-1 text-base font-bold text-slate-800 dark:text-slate-100">Estado de pedidos</h2>
                                        <p className="mb-4 text-sm text-slate-400">Incluye canceladas</p>
                                        {estadosPie.length > 0 ? (
                                            <ResponsiveContainer width="100%" height={200}>
                                                <PieChart>
                                                    <Pie data={estadosPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={false}>
                                                        {estadosPie.map((_, i) => <Cell key={i} fill={COLORES[i % COLORES.length]} />)}
                                                    </Pie>
                                                    <Legend iconSize={10} /><Tooltip contentStyle={tooltipStyle} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        ) : <p className="text-slate-400 text-sm">Sin datos</p>}
                                    </div>
                                    <div className={`${card} p-6`}>
                                        <h2 className="mb-1 text-base font-bold text-slate-800 dark:text-slate-100">Más buscados</h2>
                                        <p className="mb-4 text-sm text-slate-400">Medicamentos con más búsquedas</p>
                                        {medsMasBuscados.length > 0 ? (
                                            <ResponsiveContainer width="100%" height={200}>
                                                <BarChart data={medsMasBuscados} layout="vertical">
                                                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                                                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                                                    <YAxis type="category" dataKey="nombre" width={100} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                                                    <Tooltip contentStyle={tooltipStyle} />
                                                    <Bar dataKey="cantidad" fill="#3b82f6" radius={[0, 6, 6, 0]} name="Búsquedas" />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        ) : <p className="text-slate-400 text-sm">Sin datos</p>}
                                    </div>
                                </div>
                                <div className={`${card} p-6 border-l-4 border-red-400`}>
                                    <h2 className="mb-1 text-base font-bold text-slate-800 dark:text-slate-100">Oportunidades de stock</h2>
                                    <p className="mb-4 text-sm text-slate-400">Medicamentos buscados que no encontraron en tu farmacia</p>
                                    {medsFaltantes.length > 0 ? (
                                        <ResponsiveContainer width="100%" height={200}>
                                            <BarChart data={medsFaltantes} layout="vertical">
                                                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                                                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                                                <YAxis type="category" dataKey="nombre" width={100} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                                                <Tooltip contentStyle={tooltipStyle} />
                                                <Bar dataKey="oportunidades" fill="#ef4444" radius={[0, 6, 6, 0]} name="Veces buscado sin stock" />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    ) : <p className="text-slate-400 text-sm">Sin datos</p>}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {vista === "stock" && (
                    <div>
                        {stockBajos.length > 0 && (
                            <div className="mb-6 rounded-2xl border-l-4 border-red-500 bg-red-50 dark:bg-red-900/20 p-4">
                                <p className="font-semibold text-red-700 dark:text-red-400">{stockBajos.length} medicamento{stockBajos.length > 1 ? "s" : ""} con stock bajo (≤{LIMITE_STOCK_BAJO} unidades)</p>
                                <p className="mt-1 text-sm text-red-500">{stockBajos.map((s) => s.medicamento?.nombre_generico).join(", ")}</p>
                            </div>
                        )}
                        <div className="mb-4 flex gap-3 flex-wrap items-center">
                            <input type="text" placeholder="Buscar medicamento..." value={busquedaStock} onChange={(e) => setBusquedaStock(e.target.value)} className={`flex-1 p-3 min-w-[200px] ${input}`} />
                            <button onClick={() => setMostrandoSoloBajos(!mostrandoSoloBajos)} className={`rounded-xl px-4 py-3 text-sm font-medium transition ${mostrandoSoloBajos ? "bg-red-500 text-white" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600"}`}>
                                {mostrandoSoloBajos ? "Ver todos" : `Ver solo bajos (${stockBajos.length})`}
                            </button>
                            <button onClick={() => setAgregando(true)} className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 transition">+ Agregar medicamento</button>
                        </div>
                        {agregando && (
                            <div className={`mb-6 ${card} p-5 border-blue-200 dark:border-blue-700`}>
                                <h3 className="mb-3 font-semibold text-blue-700 dark:text-blue-400">Agregar medicamento al stock</h3>
                                <div className="flex gap-3 flex-wrap">
                                    <select value={nuevoMed} onChange={(e) => setNuevoMed(e.target.value)} className={`flex-1 p-3 min-w-[200px] ${input}`}>
                                        <option value="">Seleccioná un medicamento</option>
                                        {medicamentosDisponibles.map((m) => <option key={m.id_medicamento} value={m.id_medicamento}>{m.nombre_generico} — {m.nombre_comercial}</option>)}
                                    </select>
                                    <input type="number" placeholder="Cantidad" value={nuevaCantidad} onChange={(e) => setNuevaCantidad(e.target.value)} className={`w-28 p-3 ${input}`} />
                                    <input type="number" placeholder="Precio $" value={nuevoPrecio} onChange={(e) => setNuevoPrecio(e.target.value)} className={`w-32 p-3 ${input}`} />
                                    <button onClick={agregarMedicamento} className="rounded-xl bg-blue-600 px-4 py-3 text-white font-medium hover:bg-blue-700">Guardar</button>
                                    <button onClick={() => setAgregando(false)} className="rounded-xl bg-slate-100 dark:bg-slate-700 px-4 py-3 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-200 dark:hover:bg-slate-600">Cancelar</button>
                                </div>
                            </div>
                        )}
                        {loadingStock ? <p className="text-slate-400">Cargando stock...</p> : stockFiltrado.length === 0 ? (
                            <div className={`${card} p-12 text-center`}><p className="text-slate-500 dark:text-slate-400">No se encontraron medicamentos</p></div>
                        ) : (
                            <div className="space-y-2">
                                {stockFiltrado.map((s) => {
                                    const bajo = s.cantidad_disponible <= LIMITE_STOCK_BAJO;
                                    const editandoEste = editando === s.id_stock;
                                    return (
                                        <div key={s.id_stock} className={`${card} p-4 flex items-center gap-4`}>
                                            <div className="flex-1">
                                                <p className="font-semibold text-slate-800 dark:text-slate-100">{s.medicamento?.nombre_generico}</p>
                                                <p className="text-sm text-slate-400">{s.medicamento?.nombre_comercial}</p>
                                            </div>
                                            {editandoEste ? (
                                                <>
                                                    <input type="number" value={editCantidad} onChange={(e) => setEditCantidad(e.target.value)} className={`w-24 p-2 text-center ${input}`} placeholder="Cantidad" />
                                                    <input type="number" value={editPrecio} onChange={(e) => setEditPrecio(e.target.value)} className={`w-28 p-2 text-center ${input}`} placeholder="Precio" />
                                                    <button onClick={() => guardarEdicion(s.id_stock)} className="rounded-xl bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700">Guardar</button>
                                                    <button onClick={() => setEditando(null)} className="rounded-xl bg-slate-100 dark:bg-slate-700 px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-200">Cancelar</button>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="text-center w-24">
                                                        <p className={`text-xl font-bold ${bajo ? "text-red-500" : "text-blue-600"}`}>{s.cantidad_disponible}</p>
                                                        <p className="text-xs text-slate-400">unidades</p>
                                                        {bajo && <p className="text-xs text-red-500 font-medium">Stock bajo</p>}
                                                    </div>
                                                    <div className="text-center w-28">
                                                        <p className="text-lg font-semibold text-slate-700 dark:text-slate-200">${Number(s.precio).toLocaleString("es-AR")}</p>
                                                        <p className="text-xs text-slate-400">precio</p>
                                                    </div>
                                                    <button onClick={() => { setEditando(s.id_stock); setEditCantidad(String(s.cantidad_disponible)); setEditPrecio(String(s.precio)); }} className="rounded-xl bg-blue-50 dark:bg-blue-900/30 px-3 py-2 text-sm text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition">Editar</button>
                                                    <button onClick={() => eliminarStock(s.id_stock)} className="rounded-xl bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 transition">Eliminar</button>
                                                </>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </main>
            <ChatIA rol="farmacia" />
        </div>
    );
}