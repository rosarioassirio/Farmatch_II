import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Pill, MapPin, Phone, Star, CheckCircle2, XCircle, ChevronDown, CheckCheck, Package, Clock } from "lucide-react";

interface Receta { id_receta: number; id_medico: number; estado: string; fecha_emision: string; }
interface Medico { id_medico: number; nombre: string; apellido: string; }
interface MedAgrupado { id_medicamento: number; nombre_generico: string; nombre_comercial: string | null; cantidad: number; id_items: number[]; }
interface FarmaciaResult { id_farmacia: number; nombre: string; direccion: string; telefono: string; latitud: number; longitud: number; disponibles: number; total: number; precioTotal: number; precioConCobertura: number; medicamentosDisponibles: number[]; distanciaKm: number | null; }
interface ReservaActiva { farmacia: string; estado: string; }

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; const dLat = ((lat2 - lat1) * Math.PI) / 180; const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const ESTADO_LABEL: Record<string, string> = { pendiente: "Pendiente", preparando: "Preparando", lista: "Lista para retirar" };

function Steps({ current }: { current: 1 | 2 | 3 }) {
    const steps = ["Recetas", "Medicamentos", "Farmacias"];
    return (
        <div className="flex items-center gap-0 mb-6">
            {steps.map((label, i) => {
                const n = i + 1; const done = n < current; const active = n === current; const isLast = i === steps.length - 1;
                return (
                    <div key={label} className="flex items-center flex-1">
                        <div className="flex flex-col items-center gap-1">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${done ? "bg-blue-600 border-blue-600 text-white" : active ? "bg-white dark:bg-slate-800 border-blue-600 text-blue-600" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-400"}`}>
                                {done ? <CheckCheck size={13} /> : n}
                            </div>
                            <span className={`text-[10px] font-medium whitespace-nowrap ${active ? "text-blue-600" : done ? "text-blue-400" : "text-slate-400"}`}>{label}</span>
                        </div>
                        {!isLast && <div className={`flex-1 h-0.5 mb-4 mx-1 ${done ? "bg-blue-600" : "bg-slate-200 dark:bg-slate-600"}`} />}
                    </div>
                );
            })}
        </div>
    );
}

export default function BuscarMedicamentos() {
    const navigate = useNavigate();
    const [recetas, setRecetas] = useState<Receta[]>([]);
    const [medicos, setMedicos] = useState<Medico[]>([]);
    const [medsAgrupados, setMedsAgrupados] = useState<MedAgrupado[]>([]);
    const [farmaciasEncontradas, setFarmaciasEncontradas] = useState<FarmaciaResult[]>([]);
    const [recetasSeleccionadas, setRecetasSeleccionadas] = useState<number[]>([]);
    const [medsSeleccionados, setMedsSeleccionados] = useState<number[]>([]);
    const [recetaItemsSeleccionados, setRecetaItemsSeleccionados] = useState<number[]>([]);
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [loadingMeds, setLoadingMeds] = useState(false);
    const [loadingFarmacias, setLoadingFarmacias] = useState(false);
    const [farmaciaAbierta, setFarmaciaAbierta] = useState<number | null>(null);
    const [farmaciaSeleccionada, setFarmaciaSeleccionada] = useState<FarmaciaResult | null>(null);
    const [confirmando, setConfirmando] = useState(false);
    const [reservaConfirmada, setReservaConfirmada] = useState(false);
    const [geoPos, setGeoPos] = useState<{ lat: number; lon: number } | null>(null);
    const [obraSocial, setObraSocial] = useState<string | null>(null);
    const [coberturas, setCoberturas] = useState<Record<number, number>>({});
    const [reservasPorMedicamento, setReservasPorMedicamento] = useState<Record<number, ReservaActiva>>({});

    useEffect(() => {
        async function cargar() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data: paciente } = await supabase.from("pacientes").select("id_paciente, obra_social").eq("email", user.email).single();
            if (!paciente) return;
            setObraSocial(paciente.obra_social);
            const [recetasRes, medicosRes] = await Promise.all([
                supabase.from("recetas").select("id_receta, id_medico, estado, fecha_emision").eq("id_paciente", paciente.id_paciente).eq("estado", "activa"),
                supabase.from("medicos").select("id_medico, nombre, apellido"),
            ]);
            if (recetasRes.data) setRecetas(recetasRes.data);
            if (medicosRes.data) setMedicos(medicosRes.data);
        }
        cargar();
    }, []);

    useEffect(() => {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition((pos) => setGeoPos({ lat: pos.coords.latitude, lon: pos.coords.longitude }), () => { });
    }, []);

    function toggleReceta(id: number) { setRecetasSeleccionadas(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]); }

    async function continuar() {
        if (recetasSeleccionadas.length === 0) return;
        setLoadingMeds(true);
        const { data: items } = await supabase.from("receta_items").select("id_item, id_medicamento, cantidad").in("id_receta", recetasSeleccionadas).eq("entregado", false);
        if (!items || items.length === 0) { setLoadingMeds(false); return; }
        setRecetaItemsSeleccionados(items.map((i: any) => i.id_item));
        const idsMeds = [...new Set(items.map((i: any) => i.id_medicamento))] as number[];
        const { data: meds } = await supabase.from("medicamentos").select("id_medicamento, nombre_generico, nombre_comercial").in("id_medicamento", idsMeds);

        // Buscar si alguno de estos items ya tiene una reserva activa (pendiente/preparando/lista)
        const idsItems = items.map((i: any) => i.id_item);
        const { data: reservaItemsData } = await supabase.from("reserva_items").select("id_item, id_reserva").in("id_item", idsItems);
        const reservasMap: Record<number, ReservaActiva> = {};
        if (reservaItemsData && reservaItemsData.length > 0) {
            const idsReservas = [...new Set(reservaItemsData.map((ri: any) => ri.id_reserva))];
            const { data: reservasData } = await supabase.from("reservas").select("id_reserva, id_farmacia, estado").in("id_reserva", idsReservas).in("estado", ["pendiente", "preparando", "lista"]);
            if (reservasData && reservasData.length > 0) {
                const idsFarmaciasRes = [...new Set(reservasData.map((r: any) => r.id_farmacia))];
                const { data: farmaciasData } = await supabase.from("farmacias").select("id_farmacia, nombre").in("id_farmacia", idsFarmaciasRes);
                reservaItemsData.forEach((ri: any) => {
                    const reserva = reservasData.find((r: any) => r.id_reserva === ri.id_reserva);
                    if (!reserva) return;
                    const item = items.find((i: any) => i.id_item === ri.id_item);
                    if (!item) return;
                    const farmacia = farmaciasData?.find((f: any) => f.id_farmacia === reserva.id_farmacia);
                    reservasMap[item.id_medicamento] = { farmacia: farmacia?.nombre ?? "una farmacia", estado: reserva.estado };
                });
            }
        }
        setReservasPorMedicamento(reservasMap);

        if (meds) {
            const map: Record<string, MedAgrupado> = {};
            meds.forEach((m: any) => {
                const relatedItems = items.filter((i: any) => i.id_medicamento === m.id_medicamento);
                if (!map[m.nombre_generico]) { map[m.nombre_generico] = { ...m, cantidad: relatedItems.reduce((s: number, i: any) => s + (i.cantidad || 1), 0), id_items: relatedItems.map((i: any) => i.id_item) }; }
                else { map[m.nombre_generico].cantidad += relatedItems.reduce((s: number, i: any) => s + (i.cantidad || 1), 0); map[m.nombre_generico].id_items.push(...relatedItems.map((i: any) => i.id_item)); }
            });
            const agrupados = Object.values(map);
            setMedsAgrupados(agrupados);
            // No preseleccionar los que ya tienen reserva activa
            setMedsSeleccionados(agrupados.filter(m => !reservasMap[m.id_medicamento]).map(m => m.id_medicamento));
        }
        setLoadingMeds(false); setStep(2);
    }

    async function buscarFarmacias() {
        if (medsSeleccionados.length === 0) return;
        setLoadingFarmacias(true);
        const { data: stockData } = await supabase.from("stock").select("id_farmacia, id_medicamento, precio").in("id_medicamento", medsSeleccionados);
        if (!stockData) { setLoadingFarmacias(false); return; }
        let coberturaMap: Record<number, number> = {};
        if (obraSocial) {
            const { data: coberturasData } = await supabase.from("coberturas").select("id_medicamento, porcentaje_cobertura").eq("obra_social", obraSocial).in("id_medicamento", medsSeleccionados);
            if (coberturasData) coberturasData.forEach((c: any) => { coberturaMap[c.id_medicamento] = c.porcentaje_cobertura; });
        }
        setCoberturas(coberturaMap);
        const idsFarmacias = [...new Set(stockData.map((s: any) => s.id_farmacia))] as number[];
        const { data: farmacias } = await supabase.from("farmacias").select("id_farmacia, nombre, direccion, telefono, latitud, longitud").in("id_farmacia", idsFarmacias);
        if (!farmacias) { setLoadingFarmacias(false); return; }
        const resultado: FarmaciaResult[] = farmacias.map((f: any) => {
            const stockFarmacia = stockData.filter((s: any) => s.id_farmacia === f.id_farmacia);
            const medicamentosDisponibles = stockFarmacia.map((s: any) => s.id_medicamento);
            const disponibles = medsSeleccionados.filter(id => medicamentosDisponibles.includes(id)).length;
            const itemsRelevantes = stockFarmacia.filter((s: any) => medsSeleccionados.includes(s.id_medicamento));
            const precioTotal = itemsRelevantes.reduce((t: number, s: any) => t + (s.precio || 0), 0);
            const precioConCobertura = itemsRelevantes.reduce((t: number, s: any) => {
                const pct = coberturaMap[s.id_medicamento] ?? 0;
                return t + (s.precio || 0) * (1 - pct / 100);
            }, 0);
            const distanciaKm = geoPos ? haversineKm(geoPos.lat, geoPos.lon, f.latitud, f.longitud) : null;
            return { ...f, disponibles, total: medsSeleccionados.length, medicamentosDisponibles, precioTotal, precioConCobertura, distanciaKm };
        });
        resultado.sort((a, b) => { if (b.disponibles !== a.disponibles) return b.disponibles - a.disponibles; if (a.distanciaKm !== null && b.distanciaKm !== null) return a.distanciaKm - b.distanciaKm; return a.precioTotal - b.precioTotal; });
        setFarmaciasEncontradas(resultado); setLoadingFarmacias(false); setStep(3);
    }

    async function confirmarReserva() {
        if (!farmaciaSeleccionada) return;
        setConfirmando(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setConfirmando(false); return; }
        const { data: paciente } = await supabase.from("pacientes").select("id_paciente").eq("email", user.email).single();
        if (!paciente) { setConfirmando(false); return; }
        const { data: reservaData, error } = await supabase.from("reservas").insert({ id_paciente: paciente.id_paciente, id_farmacia: farmaciaSeleccionada.id_farmacia, fecha: new Date().toISOString(), estado: "pendiente" }).select().single();
        if (error || !reservaData) { setConfirmando(false); return; }
        const itemsAReservar = medsAgrupados.filter(m => medsSeleccionados.includes(m.id_medicamento)).flatMap(m => m.id_items);
        if (itemsAReservar.length > 0) await supabase.from("reserva_items").insert(itemsAReservar.map(id_item => ({ id_reserva: reservaData.id_reserva, id_item })));
        setConfirmando(false); setReservaConfirmada(true);
    }

    function resetear() { setStep(1); setRecetasSeleccionadas([]); setMedsAgrupados([]); setMedsSeleccionados([]); setFarmaciasEncontradas([]); setFarmaciaSeleccionada(null); setReservaConfirmada(false); setReservasPorMedicamento({}); }
    const getMedico = (id: number) => medicos.find(m => m.id_medico === id);

    const card = "rounded-2xl border shadow-sm";
    const cardBase = `${card} bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700`;

    return (
        <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-900">
            <header className="bg-white dark:bg-slate-800 border-b-2 border-blue-600 shadow-sm sticky top-0 z-10">
                <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
                    <button onClick={() => step === 1 ? navigate("/paciente") : setStep(step === 3 ? 2 : 1)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-500 dark:text-slate-400">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Buscar medicamentos</h1>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{step === 1 ? "Selecciona tus recetas activas" : step === 2 ? "Confirma los medicamentos" : "Elegi una farmacia"}</p>
                    </div>
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 py-6">
                <Steps current={step} />

                {step === 1 && (
                    <div className="space-y-4">
                        {recetas.length === 0 ? (
                            <div className={`${cardBase} p-10 text-center`}>
                                <Package size={36} className="text-slate-300 mx-auto mb-3" />
                                <p className="font-medium text-slate-600 dark:text-slate-300">Sin recetas activas</p>
                                <p className="text-sm text-slate-400 mt-1">Tu medico debe emitir una receta digital primero.</p>
                            </div>
                        ) : (
                            <>
                                <p className="text-xs text-slate-400 px-1">Selecciona una o mas recetas para buscar sus medicamentos.</p>
                                <div className="space-y-2">
                                    {recetas.map((receta, i) => {
                                        const sel = recetasSeleccionadas.includes(receta.id_receta);
                                        const med = getMedico(receta.id_medico);
                                        const fecha = new Date(receta.fecha_emision).toLocaleDateString("es-AR", { day: "numeric", month: "short" });
                                        return (
                                            <button key={receta.id_receta} onClick={() => toggleReceta(receta.id_receta)} className={`w-full text-left rounded-2xl border px-4 py-3.5 flex items-center gap-3 transition-all ${sel ? "border-blue-300 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-700 shadow-sm" : "border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm hover:border-slate-200 dark:hover:border-slate-600"}`}>
                                                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${sel ? "bg-blue-600 border-blue-600" : "border-slate-300 dark:border-slate-500"}`}>
                                                    {sel && <CheckCheck size={11} className="text-white" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">Receta #{i + 1}</p>
                                                    {med && <p className="text-xs text-slate-400 mt-0.5">Dr/a. {med.nombre} {med.apellido} - {fecha}</p>}
                                                </div>
                                                {sel && <span className="text-xs font-medium text-blue-600 shrink-0">Seleccionada</span>}
                                            </button>
                                        );
                                    })}
                                </div>
                                <button onClick={continuar} disabled={recetasSeleccionadas.length === 0 || loadingMeds} className="w-full mt-2 py-3 bg-blue-600 text-white font-semibold rounded-2xl hover:bg-blue-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
                                    {loadingMeds ? <><span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />Cargando...</> : <><Search size={16} />Ver medicamentos</>}
                                </button>
                            </>
                        )}
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-4">
                        <p className="text-xs text-slate-400 px-1">Estos son los medicamentos pendientes de entrega. Desmarca los que no queres incluir.</p>
                        <div className="space-y-2">
                            {medsAgrupados.map(med => {
                                const sel = medsSeleccionados.includes(med.id_medicamento);
                                const yaReservado = reservasPorMedicamento[med.id_medicamento];
                                return (
                                    <div key={med.id_medicamento}>
                                        <button onClick={() => setMedsSeleccionados(prev => sel ? prev.filter(id => id !== med.id_medicamento) : [...prev, med.id_medicamento])} className={`w-full text-left rounded-2xl border px-4 py-3.5 flex items-center gap-3 transition-all ${sel ? "border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 shadow-sm" : "border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm opacity-60"}`}>
                                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${sel ? "bg-blue-600 border-blue-600" : "border-slate-300 dark:border-slate-500"}`}>
                                                {sel && <CheckCheck size={11} className="text-white" />}
                                            </div>
                                            <div className={`p-1.5 rounded-lg shrink-0 ${sel ? "bg-blue-100 dark:bg-blue-900/30" : "bg-slate-100 dark:bg-slate-700"}`}>
                                                <Pill size={14} className={sel ? "text-blue-600" : "text-slate-400"} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{med.nombre_generico}</p>
                                                {med.nombre_comercial && <p className="text-xs text-slate-400">{med.nombre_comercial}</p>}
                                            </div>
                                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${sel ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" : "bg-slate-100 dark:bg-slate-700 text-slate-400"}`}>x{med.cantidad}</span>
                                        </button>
                                        {yaReservado && (
                                            <div className="mt-1.5 ml-2 flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400 rounded-lg px-3 py-1.5">
                                                <Clock size={12} />
                                                <span>Ya reservado en <span className="font-medium">{yaReservado.farmacia}</span> ({ESTADO_LABEL[yaReservado.estado] ?? yaReservado.estado})</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        <button onClick={buscarFarmacias} disabled={medsSeleccionados.length === 0 || loadingFarmacias} className="w-full py-3 bg-blue-600 text-white font-semibold rounded-2xl hover:bg-blue-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
                            {loadingFarmacias ? <><span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />Buscando...</> : <><Search size={16} />Buscar farmacias ({medsSeleccionados.length} medicamento{medsSeleccionados.length !== 1 ? "s" : ""})</>}
                        </button>
                    </div>
                )}

                {step === 3 && (
                    <div className="space-y-3">
                        {farmaciasEncontradas.length === 0 ? (
                            <div className={`${cardBase} p-10 text-center`}>
                                <Search size={36} className="text-slate-300 mx-auto mb-3" />
                                <p className="font-medium text-slate-600 dark:text-slate-300">Sin resultados</p>
                                <p className="text-sm text-slate-400 mt-1">Ninguna farmacia tiene stock de los medicamentos seleccionados.</p>
                            </div>
                        ) : (
                            <>
                                <p className="text-xs text-slate-400 px-1">{farmaciasEncontradas.length} farmacia{farmaciasEncontradas.length !== 1 ? "s" : ""} encontrada{farmaciasEncontradas.length !== 1 ? "s" : ""} - ordenadas por disponibilidad{geoPos ? " y cercania" : " y precio"}</p>
                                {farmaciasEncontradas.map((farmacia, index) => {
                                    const completa = farmacia.disponibles === farmacia.total;
                                    const abierta = farmaciaAbierta === farmacia.id_farmacia;
                                    return (
                                        <div key={farmacia.id_farmacia} className={`bg-white dark:bg-slate-800 rounded-2xl border shadow-sm overflow-hidden ${index === 0 ? "border-blue-200 dark:border-blue-700" : "border-slate-100 dark:border-slate-700"}`}>
                                            {index === 0 && <div className="bg-blue-600 px-4 py-1.5 flex items-center gap-1.5"><Star size={11} className="text-blue-200 fill-blue-200" /><span className="text-xs font-semibold text-white">Mejor opcion</span></div>}
                                            <div className="px-4 pt-4 pb-3">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-semibold text-slate-800 dark:text-slate-100">{farmacia.nombre}</p>
                                                        <div className="flex items-center gap-1 text-xs text-slate-400 mt-1"><MapPin size={11} /><span className="truncate">{farmacia.direccion}</span></div>
                                                        {farmacia.distanciaKm !== null && <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"><MapPin size={9} />{farmacia.distanciaKm < 1 ? `${Math.round(farmacia.distanciaKm * 1000)} m` : `${farmacia.distanciaKm.toFixed(1)} km`}</span>}
                                                        {farmacia.telefono && <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5"><Phone size={11} />{farmacia.telefono}</div>}
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        {obraSocial && farmacia.precioConCobertura < farmacia.precioTotal ? (
                                                            <>
                                                                <p className="text-xs text-slate-400 line-through">${farmacia.precioTotal.toLocaleString("es-AR")}</p>
                                                                <p className="text-lg font-bold text-green-600">${Math.round(farmacia.precioConCobertura).toLocaleString("es-AR")}</p>
                                                                <p className="text-xs text-slate-400">con {obraSocial}</p>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <p className="text-lg font-bold text-slate-800 dark:text-slate-100">${farmacia.precioTotal.toLocaleString("es-AR")}</p>
                                                                <p className="text-xs text-slate-400">precio aprox.</p>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="mt-3 flex items-center justify-between">
                                                    <div className="flex items-center gap-1.5">
                                                        {completa ? <CheckCircle2 size={14} className="text-green-600" /> : <XCircle size={14} className="text-amber-500" />}
                                                        <span className={`text-xs font-semibold ${completa ? "text-green-600" : "text-amber-600"}`}>{completa ? "Pedido completo" : `${farmacia.disponibles} de ${farmacia.total} disponibles`}</span>
                                                    </div>
                                                    <a href={`https://www.google.com/maps?q=${farmacia.latitud},${farmacia.longitud}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-xs text-blue-600 font-medium hover:underline flex items-center gap-0.5"><MapPin size={11} />Maps</a>
                                                </div>
                                                <button onClick={() => setFarmaciaAbierta(abierta ? null : farmacia.id_farmacia)} className="mt-2 flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                                                    <ChevronDown size={13} className={`transition-transform ${abierta ? "rotate-180" : ""}`} />
                                                    {abierta ? "Ocultar detalle" : "Ver detalle por medicamento"}
                                                </button>
                                                {abierta && (
                                                    <div className="mt-2 space-y-1">
                                                        {medsAgrupados.filter(m => medsSeleccionados.includes(m.id_medicamento)).map(med => {
                                                            const tiene = farmacia.medicamentosDisponibles.includes(med.id_medicamento);
                                                            return <div key={med.id_medicamento} className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg ${tiene ? "text-green-700 bg-green-50 dark:bg-green-900/20 dark:text-green-400" : "text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400"}`}>{tiene ? <CheckCircle2 size={12} /> : <XCircle size={12} />}<span>{med.nombre_generico}</span></div>;
                                                        })}
                                                    </div>
                                                )}
                                                <button onClick={() => setFarmaciaSeleccionada(farmacia)} className="mt-3 w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors">Reservar en esta farmacia</button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </>
                        )}
                    </div>
                )}
            </main>

            {farmaciaSeleccionada && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
                        {!reservaConfirmada ? (
                            <>
                                <div className="bg-blue-600 px-6 py-4">
                                    <p className="text-xs font-semibold text-blue-200 uppercase tracking-wider">Confirmar reserva</p>
                                    <p className="text-white font-bold text-lg mt-0.5">{farmaciaSeleccionada.nombre}</p>
                                    <p className="text-blue-200 text-xs mt-0.5 flex items-center gap-1"><MapPin size={11} />{farmaciaSeleccionada.direccion}</p>
                                </div>
                                <div className="px-6 py-5 space-y-4">
                                    <div>
                                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Medicamentos</p>
                                        <div className="space-y-1">
                                            {medsAgrupados.filter(m => medsSeleccionados.includes(m.id_medicamento)).map(med => {
                                                const tiene = farmaciaSeleccionada.medicamentosDisponibles.includes(med.id_medicamento);
                                                return <div key={med.id_medicamento} className="flex items-center gap-2 text-sm">{tiene ? <CheckCircle2 size={13} className="text-green-500 shrink-0" /> : <XCircle size={13} className="text-red-400 shrink-0" />}<span className={tiene ? "text-slate-700 dark:text-slate-200" : "text-slate-400 line-through"}>{med.nombre_generico}</span><span className="text-slate-400 text-xs ml-auto">x{med.cantidad}</span></div>;
                                            })}
                                        </div>
                                    </div>
                                    <div className="py-3 border-t border-b border-slate-100 dark:border-slate-700 space-y-1">
                                        {obraSocial && farmaciaSeleccionada.precioConCobertura < farmaciaSeleccionada.precioTotal ? (
                                            <>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm text-slate-500 dark:text-slate-400">Precio de lista</span>
                                                    <span className="text-sm text-slate-400 line-through">${farmaciaSeleccionada.precioTotal.toLocaleString("es-AR")}</span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm text-slate-500 dark:text-slate-400">Con cobertura {obraSocial}</span>
                                                    <span className="text-xl font-bold text-green-600">${Math.round(farmaciaSeleccionada.precioConCobertura).toLocaleString("es-AR")}</span>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-slate-500 dark:text-slate-400">Total aproximado</span>
                                                <span className="text-xl font-bold text-slate-800 dark:text-slate-100">${farmaciaSeleccionada.precioTotal.toLocaleString("es-AR")}</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=farmatch-reserva-${farmaciaSeleccionada.id_farmacia}&color=1e40af&bgcolor=eff6ff`} alt="QR" className="rounded-xl border border-blue-100" width={80} height={80} />
                                        <p className="text-xs text-slate-400 leading-relaxed">Presenta este codigo al retirar tus medicamentos en la farmacia.</p>
                                    </div>
                                    <div className="flex gap-3 pt-1">
                                        <button onClick={() => setFarmaciaSeleccionada(null)} className="flex-1 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">Cancelar</button>
                                        <button onClick={confirmarReserva} disabled={confirmando} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">{confirmando ? <><span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />Reservando...</> : "Confirmar reserva"}</button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="px-6 py-10 text-center">
                                <div className="w-14 h-14 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle2 size={28} className="text-green-600" /></div>
                                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Reserva confirmada</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Tu pedido fue enviado a <span className="font-medium text-slate-700 dark:text-slate-200">{farmaciaSeleccionada.nombre}</span>. Podes seguir el estado en Mis reservas.</p>
                                <div className="flex gap-3 mt-6">
                                    <button onClick={resetear} className="flex-1 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">Nueva busqueda</button>
                                    <button onClick={() => navigate("/mis-reservas")} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700">Mis reservas</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
