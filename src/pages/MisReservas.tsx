import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabase";
import { ArrowLeft, Clock, CheckCircle, Package, XCircle, AlertTriangle, QrCode } from "lucide-react";

type EstadoReserva = "pendiente" | "preparando" | "lista" | "entregada" | "cancelada";

interface Reserva {
    id_reserva: number; id_farmacia: number; fecha: string; estado: EstadoReserva; nota_interna: string | null;
    farmacias: { nombre: string; direccion: string };
    reserva_items: { id: number; receta_items: { id_receta: number; medicamentos: { nombre_generico: string; nombre_comercial: string | null }; cantidad: number; indicaciones: string | null } }[];
}

const ESTADOS: EstadoReserva[] = ["pendiente", "preparando", "lista", "entregada"];
const ESTADO_CONFIG: Record<EstadoReserva, { label: string; color: string; bg: string }> = {
    pendiente: { label: "Pendiente", color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
    preparando: { label: "Preparando", color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
    lista: { label: "Lista", color: "text-green-700", bg: "bg-green-50 border-green-200" },
    entregada: { label: "Entregada", color: "text-slate-600", bg: "bg-slate-50 border-slate-200" },
    cancelada: { label: "Cancelada", color: "text-red-700", bg: "bg-red-50 border-red-200" },
};

function ProgressBar({ estado }: { estado: EstadoReserva }) {
    if (estado === "cancelada") return (
        <div className="flex items-center gap-2 text-sm text-red-600 mt-3">
            <XCircle size={15} /><span>Reserva cancelada</span>
        </div>
    );
    const activeIndex = ESTADOS.indexOf(estado);
    return (
        <div className="mt-3">
            <div className="flex items-center gap-0">
                {ESTADOS.map((e, i) => {
                    const done = i <= activeIndex; const isLast = i === ESTADOS.length - 1;
                    return (
                        <div key={e} className="flex items-center flex-1">
                            <div className="flex flex-col items-center gap-1">
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center border-2 transition-all ${done ? "bg-blue-600 border-blue-600" : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600"}`}>
                                    {done && <div className="w-2 h-2 rounded-full bg-white" />}
                                </div>
                                <span className={`text-[10px] font-medium whitespace-nowrap ${done ? "text-blue-600" : "text-slate-400"}`}>{ESTADO_CONFIG[e].label}</span>
                            </div>
                            {!isLast && <div className={`flex-1 h-0.5 mb-4 mx-1 ${i < activeIndex ? "bg-blue-600" : "bg-slate-200 dark:bg-slate-600"}`} />}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default function MisReservas() {
    const navigate = useNavigate();
    const [reservas, setReservas] = useState<Reserva[]>([]);
    const [loading, setLoading] = useState(true);
    const [cancelando, setCancelando] = useState<number | null>(null);
    const [confirmarCancelar, setConfirmarCancelar] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => { fetchReservas(); }, []);

    async function fetchReservas() {
        setLoading(true); setError(null);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { navigate("/login"); return; }
            const { data: perfil } = await supabase.from("perfiles").select("ficha_id").eq("id", user.id).single();
            if (!perfil) throw new Error("Perfil no encontrado");
            const { data: reservasData, error: err } = await supabase.from("reservas").select("id_reserva, id_farmacia, fecha, estado, nota_interna").eq("id_paciente", perfil.ficha_id).order("fecha", { ascending: false });
            if (err) throw err;
            if (!reservasData || reservasData.length === 0) { setReservas([]); return; }
            const ids_farmacia = [...new Set(reservasData.map((r: any) => r.id_farmacia))];
            const ids_reserva = reservasData.map((r: any) => r.id_reserva);
            const { data: farmaciasData } = await supabase.from("farmacias").select("id_farmacia, nombre, direccion").in("id_farmacia", ids_farmacia);
            const { data: reservaItemsData } = await supabase.from("reserva_items").select("id, id_reserva, id_item").in("id_reserva", ids_reserva);
            const ids_item = (reservaItemsData || []).map((ri: any) => ri.id_item).filter(Boolean);
            const { data: recetaItemsData } = ids_item.length > 0 ? await supabase.from("receta_items").select("id_item, id_receta, cantidad, indicaciones, id_medicamento").in("id_item", ids_item) : { data: [] as any[] };
            const ids_medicamento = [...new Set((recetaItemsData || []).map((ri: any) => ri.id_medicamento))];
            const { data: medicamentosData } = ids_medicamento.length > 0 ? await supabase.from("medicamentos").select("id_medicamento, nombre_generico, nombre_comercial").in("id_medicamento", ids_medicamento) : { data: [] as any[] };
            const farmaciasMap: Record<number, any> = {}; (farmaciasData || []).forEach((f: any) => { farmaciasMap[f.id_farmacia] = f; });
            const medMap: Record<number, any> = {}; (medicamentosData || []).forEach((m: any) => { medMap[m.id_medicamento] = m; });
            const recetaItemsMap: Record<number, any> = {}; (recetaItemsData || []).forEach((ri: any) => { recetaItemsMap[ri.id_item] = { id_receta: ri.id_receta, cantidad: ri.cantidad, indicaciones: ri.indicaciones, medicamentos: medMap[ri.id_medicamento] || { nombre_generico: "Medicamento", nombre_comercial: null } }; });
            const itemsByReserva: Record<number, any[]> = {}; (reservaItemsData || []).forEach((ri: any) => { if (!itemsByReserva[ri.id_reserva]) itemsByReserva[ri.id_reserva] = []; itemsByReserva[ri.id_reserva].push({ id: ri.id, receta_items: recetaItemsMap[ri.id_item] || { id_receta: 0, cantidad: 1, indicaciones: null, medicamentos: { nombre_generico: "Medicamento", nombre_comercial: null } } }); });
            setReservas(reservasData.map((r: any) => ({ ...r, farmacias: farmaciasMap[r.id_farmacia] || { nombre: "Farmacia", direccion: "" }, reserva_items: itemsByReserva[r.id_reserva] || [] })));
        } catch (e: any) { setError(e.message || "Error al cargar reservas"); }
        finally { setLoading(false); }
    }

    async function cancelarReserva(id_reserva: number) {
        setCancelando(id_reserva); setError(null);
        try {
            const { error: err } = await supabase.from("reservas").update({ estado: "cancelada" }).eq("id_reserva", id_reserva);
            if (err) throw err;
            setReservas(prev => prev.map(r => r.id_reserva === id_reserva ? { ...r, estado: "cancelada" } : r));
        } catch { setError("No se pudo cancelar la reserva. Intenta de nuevo."); }
        finally { setCancelando(null); setConfirmarCancelar(null); }
    }

    const activas = reservas.filter(r => !["entregada", "cancelada"].includes(r.estado));
    const historial = reservas.filter(r => ["entregada", "cancelada"].includes(r.estado));

    return (
        <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-900">
            <header className="bg-white dark:bg-slate-800 border-b-2 border-blue-600 shadow-sm sticky top-0 z-10">
                <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
                    <button onClick={() => navigate("/paciente")} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-500 dark:text-slate-400">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Mis reservas</h1>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{activas.length} activa{activas.length !== 1 ? "s" : ""}</p>
                    </div>
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
                {error && <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-2xl px-4 py-3 text-sm"><AlertTriangle size={16} className="shrink-0" />{error}</div>}

                {loading ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-4 animate-pulse">
                                <div className="h-4 bg-slate-100 dark:bg-slate-700 rounded w-1/2 mb-2" />
                                <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded w-1/3" />
                            </div>
                        ))}
                    </div>
                ) : reservas.length === 0 ? (
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-10 text-center">
                        <Package size={36} className="text-slate-300 mx-auto mb-3" />
                        <p className="font-medium text-slate-600 dark:text-slate-300">Sin reservas aun</p>
                        <p className="text-sm text-slate-400 mt-1">Busca un medicamento para hacer tu primera reserva.</p>
                        <button onClick={() => navigate("/buscar-medicamentos")} className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors">Buscar medicamento</button>
                    </div>
                ) : (
                    <>
                        {activas.length > 0 && (
                            <section className="space-y-3">
                                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">Activas</h2>
                                {activas.map(reserva => <ReservaCard key={reserva.id_reserva} reserva={reserva} onCancelar={() => setConfirmarCancelar(reserva.id_reserva)} cancelando={cancelando === reserva.id_reserva} />)}
                            </section>
                        )}
                        {historial.length > 0 && (
                            <section className="space-y-3">
                                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">Historial</h2>
                                {historial.map(reserva => <ReservaCard key={reserva.id_reserva} reserva={reserva} onCancelar={() => { }} cancelando={false} />)}
                            </section>
                        )}
                    </>
                )}
            </main>

            {confirmarCancelar !== null && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-xl"><XCircle size={22} className="text-red-600" /></div>
                            <div>
                                <h3 className="font-semibold text-slate-800 dark:text-slate-100">Cancelar reserva</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Esta accion no se puede deshacer.</p>
                            </div>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-300">La farmacia sera notificada. Podes hacer una nueva reserva en cualquier momento.</p>
                        <div className="flex gap-3 pt-1">
                            <button onClick={() => setConfirmarCancelar(null)} className="flex-1 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">Volver</button>
                            <button onClick={() => cancelarReserva(confirmarCancelar)} disabled={cancelando !== null} className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-60">{cancelando !== null ? "Cancelando..." : "Si, cancelar"}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function ReservaCard({ reserva, onCancelar, cancelando }: { reserva: Reserva; onCancelar: () => void; cancelando: boolean }) {
    const [expandida, setExpandida] = useState(false);
    const [qrVisible, setQrVisible] = useState(false);
    const cfg = ESTADO_CONFIG[reserva.estado];
    const esPendiente = reserva.estado === "pendiente";
    const esCancelada = reserva.estado === "cancelada";
    const esEntregada = reserva.estado === "entregada";
    const fecha = new Date(reserva.fecha).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });
    const idsRecetas = [...new Set(reserva.reserva_items.map(item => item.receta_items.id_receta).filter(Boolean))];

    return (
        <div className={`bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden ${esCancelada ? "opacity-70" : ""}`}>
            <button className="w-full text-left px-4 pt-4 pb-3" onClick={() => setExpandida(v => !v)}>
                <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">{reserva.farmacias.nombre}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{reserva.farmacias.direccion}</p>
                    </div>
                    <span className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full border ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                    <div className="flex items-center gap-1"><Clock size={11} />{fecha}</div>
                    <span>-</span>
                    <span>{reserva.reserva_items.length} medicamento{reserva.reserva_items.length !== 1 ? "s" : ""}</span>
                    <span className="ml-auto text-blue-500 font-medium">{expandida ? "Ocultar" : "Ver detalle"}</span>
                </div>
                <ProgressBar estado={reserva.estado} />
            </button>

            {expandida && (
                <div className="border-t border-slate-100 dark:border-slate-700 px-4 py-3 space-y-2 bg-slate-50/50 dark:bg-slate-900/30">
                    {reserva.reserva_items.length === 0 ? (
                        <p className="text-sm text-slate-400">Sin medicamentos registrados.</p>
                    ) : (
                        reserva.reserva_items.map(item => (
                            <div key={item.id} className="text-sm">
                                <span className="font-medium text-slate-700 dark:text-slate-200">{item.receta_items.medicamentos.nombre_generico}</span>
                                {item.receta_items.medicamentos.nombre_comercial && <span className="text-slate-400"> - {item.receta_items.medicamentos.nombre_comercial}</span>}
                                <span className="text-slate-400"> - {item.receta_items.cantidad} unid.</span>
                                {item.receta_items.indicaciones && <p className="text-xs text-slate-400 mt-0.5">{item.receta_items.indicaciones}</p>}
                            </div>
                        ))
                    )}
                    {reserva.nota_interna && (
                        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                            <p className="text-xs text-slate-500 dark:text-slate-400"><span className="font-medium">Nota de farmacia:</span> {reserva.nota_interna}</p>
                        </div>
                    )}
                    {esEntregada && (
                        <div className="flex items-center gap-1.5 text-xs text-green-600 pt-1">
                            <CheckCircle size={13} />Medicamentos marcados como entregados en tu receta.
                        </div>
                    )}
                    {!esCancelada && idsRecetas.length > 0 && (
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                            <button onClick={e => { e.stopPropagation(); setQrVisible(v => !v); }} className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors">
                                <QrCode size={16} />
                                {qrVisible ? "Ocultar QR de validacion" : "Mostrar QR de validacion"}
                            </button>
                            {qrVisible && (
                                <div className="mt-3 flex flex-wrap gap-4">
                                    {idsRecetas.map(idReceta => (
                                        <div key={idReceta} className="flex items-start gap-3">
                                            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=farmatch-receta-${idReceta}&color=1e40af&bgcolor=f0f9ff`} alt={`QR receta ${idReceta}`} className="rounded-xl border border-blue-100 shadow-sm" width={110} height={110} />
                                            <div className="text-xs text-slate-400 space-y-1 pt-1">
                                                <p className="font-medium text-slate-600 dark:text-slate-300">Receta #{idReceta}</p>
                                                <p className="text-slate-300 dark:text-slate-600">ID: farmatch-receta-{idReceta}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                    {esPendiente && (
                        <div className="pt-2">
                            <button onClick={e => { e.stopPropagation(); onCancelar(); }} disabled={cancelando} className="w-full py-2 border border-red-200 text-red-600 text-sm font-medium rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50">
                                {cancelando ? "Cancelando..." : "Cancelar reserva"}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
