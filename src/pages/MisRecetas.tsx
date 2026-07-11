import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import { ArrowLeft, ChevronDown, FileText, Pill, QrCode, CheckCircle2, Clock, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { jsPDF } from "jspdf";

interface Medico { id_medico: number; nombre: string; apellido: string; especialidad?: string; matricula: string; }
interface Medicamento { id_medicamento: number; nombre_generico: string; nombre_comercial: string | null; }
interface RecetaItem { id_item: number; id_receta: number; id_medicamento: number; cantidad: number; indicaciones: string | null; entregado: boolean; }
interface Receta { id_receta: number; id_medico: number; fecha_emision: string; estado: "activa" | "completada" | "vencida"; }

function iniciales(nombre: string, apellido: string) { return `${nombre[0] ?? ""}${apellido[0] ?? ""}`.toUpperCase(); }

function BadgeEstado({ estado, vencida }: { estado: "activa" | "completada" | "vencida"; vencida?: boolean }) {
    if (vencida || estado === "vencida") return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200"><Clock size={11} />Vencida</span>;
    return estado === "activa"
        ? <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200"><Clock size={11} />Activa</span>
        : <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200"><CheckCircle2 size={11} />Completada</span>;
}

function generarPdfReceta(receta: Receta, medico: Medico | undefined, items: RecetaItem[], getMedicamento: (id: number) => Medicamento | undefined) {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("FARMATCH", 14, 20);
    doc.setFontSize(11);
    doc.text("Receta digital", 14, 27);
    doc.setLineWidth(0.5);
    doc.line(14, 32, 196, 32);

    doc.setFontSize(10);
    doc.text(`Receta N°: ${receta.id_receta}`, 14, 42);
    doc.text(`Fecha de emision: ${new Date(receta.fecha_emision).toLocaleDateString("es-AR")}`, 14, 49);
    doc.text(`Estado: ${receta.estado}`, 14, 56);

    if (medico) {
        doc.text(`Medico: Dr/a. ${medico.nombre} ${medico.apellido}`, 14, 66);
        doc.text(`Matricula: ${medico.matricula}`, 14, 73);
    }

    doc.setFontSize(12);
    doc.text("Medicamentos:", 14, 87);
    doc.setFontSize(10);
    let y = 95;
    items.forEach((item, i) => {
        const med = getMedicamento(item.id_medicamento);
        doc.text(`${i + 1}. ${med?.nombre_generico ?? "Medicamento"}${med?.nombre_comercial ? ` (${med.nombre_comercial})` : ""} - Cantidad: ${item.cantidad}`, 14, y);
        y += 6;
        if (item.indicaciones) { doc.text(`   ${item.indicaciones}`, 14, y); y += 6; }
        doc.text(`   Estado: ${item.entregado ? "Entregado" : "Pendiente"}`, 14, y);
        y += 9;
    });

    doc.setFontSize(8);
    doc.text(`ID de validacion: farmatch-receta-${receta.id_receta}`, 14, 285);

    doc.save(`receta-farmatch-${receta.id_receta}.pdf`);
}

export default function MisRecetas() {
    const navigate = useNavigate();
    const [recetas, setRecetas] = useState<Receta[]>([]);
    const [medicos, setMedicos] = useState<Medico[]>([]);
    const [recetaItems, setRecetaItems] = useState<RecetaItem[]>([]);
    const [medicamentos, setMedicamentos] = useState<Medicamento[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandidas, setExpandidas] = useState<Set<number>>(new Set());
    const [qrVisible, setQrVisible] = useState<Set<number>>(new Set());

    useEffect(() => {
        async function cargarRecetas() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data: paciente } = await supabase.from("pacientes").select("id_paciente").eq("email", user.email).single();
            if (!paciente) return;
            const [recetasRes, medicosRes, itemsRes, medsRes] = await Promise.all([
                supabase.from("recetas").select("*").eq("id_paciente", paciente.id_paciente).order("fecha_emision", { ascending: false }),
                supabase.from("medicos").select("id_medico, nombre, apellido, especialidad, matricula"),
                supabase.from("receta_items").select("*"),
                supabase.from("medicamentos").select("id_medicamento, nombre_generico, nombre_comercial"),
            ]);
            if (recetasRes.data) setRecetas(recetasRes.data);
            if (medicosRes.data) setMedicos(medicosRes.data);
            if (itemsRes.data) setRecetaItems(itemsRes.data);
            if (medsRes.data) setMedicamentos(medsRes.data);
            setLoading(false);
        }
        cargarRecetas();
    }, []);

    const getMedico = (id: number) => medicos.find(m => m.id_medico === id);
    const getItems = (id: number) => recetaItems.filter(i => i.id_receta === id);
    const getMedicamento = (id: number) => medicamentos.find(m => m.id_medicamento === id);
    const toggleExpandida = (id: number) => { setExpandidas(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; }); };
    const toggleQr = (id: number, e: React.MouseEvent) => { e.stopPropagation(); setQrVisible(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; }); };

    const activas = recetas.filter(r => r.estado === "activa");
    const completadas = recetas.filter(r => r.estado === "completada");
    const vencidas = recetas.filter(r => r.estado === "vencida");

    return (
        <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-900">
            <header className="bg-white dark:bg-slate-800 border-b-2 border-blue-600 shadow-sm sticky top-0 z-10">
                <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
                    <button onClick={() => navigate("/paciente")} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-500 dark:text-slate-400">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Mis recetas</h1>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{activas.length} activa{activas.length !== 1 ? "s" : ""} · {completadas.length} completada{completadas.length !== 1 ? "s" : ""} · {vencidas.length} vencida{vencidas.length !== 1 ? "s" : ""}</p>
                    </div>
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
                {loading ? (
                    <div className="space-y-3">
                        {[1, 2].map(i => (
                            <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-5 animate-pulse">
                                <div className="h-4 bg-slate-100 dark:bg-slate-700 rounded w-1/3 mb-2" />
                                <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded w-1/2" />
                            </div>
                        ))}
                    </div>
                ) : recetas.length === 0 ? (
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-10 text-center">
                        <FileText size={36} className="text-slate-300 mx-auto mb-3" />
                        <p className="font-medium text-slate-600 dark:text-slate-300">Sin recetas aún</p>
                        <p className="text-sm text-slate-400 mt-1">Tu médico aún no emitió ninguna receta digital.</p>
                    </div>
                ) : (
                    <>
                        {activas.length > 0 && (
                            <section className="space-y-3">
                                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">Activas</h2>
                                {activas.map((receta) => (
                                    <RecetaCard key={receta.id_receta} receta={receta} medico={getMedico(receta.id_medico)} items={getItems(receta.id_receta)} getMedicamento={getMedicamento} expandida={expandidas.has(receta.id_receta)} qrVisible={qrVisible.has(receta.id_receta)} onToggle={() => toggleExpandida(receta.id_receta)} onToggleQr={(e) => toggleQr(receta.id_receta, e)} />
                                ))}
                            </section>
                        )}
                        {completadas.length > 0 && (
                            <section className="space-y-3">
                                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">Completadas</h2>
                                {completadas.map((receta) => (
                                    <RecetaCard key={receta.id_receta} receta={receta} medico={getMedico(receta.id_medico)} items={getItems(receta.id_receta)} getMedicamento={getMedicamento} expandida={expandidas.has(receta.id_receta)} qrVisible={qrVisible.has(receta.id_receta)} onToggle={() => toggleExpandida(receta.id_receta)} onToggleQr={(e) => toggleQr(receta.id_receta, e)} />
                                ))}
                            </section>
                        )}
                        {vencidas.length > 0 && (
                            <section className="space-y-3">
                                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">Vencidas</h2>
                                {vencidas.map((receta) => (
                                    <RecetaCard key={receta.id_receta} receta={receta} medico={getMedico(receta.id_medico)} items={getItems(receta.id_receta)} getMedicamento={getMedicamento} expandida={expandidas.has(receta.id_receta)} qrVisible={qrVisible.has(receta.id_receta)} onToggle={() => toggleExpandida(receta.id_receta)} onToggleQr={(e) => toggleQr(receta.id_receta, e)} />
                                ))}
                            </section>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}

function RecetaCard({ receta, medico, items, getMedicamento, expandida, qrVisible, onToggle, onToggleQr }: {
    receta: Receta; medico: Medico | undefined; items: RecetaItem[];
    getMedicamento: (id: number) => Medicamento | undefined; expandida: boolean; qrVisible: boolean;
    onToggle: () => void; onToggleQr: (e: React.MouseEvent) => void;
}) {
    const pendientes = items.filter(i => !i.entregado).length;
    const fechaVencimiento = new Date(receta.fecha_emision);
    fechaVencimiento.setDate(fechaVencimiento.getDate() + 30);
    const vencida = receta.estado === "activa" && fechaVencimiento < new Date();
    const completada = receta.estado === "completada";
    const vencimiento = fechaVencimiento.toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });
    const emision = new Date(receta.fecha_emision).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });

    return (
        <div className={`bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden transition-opacity ${completada ? "opacity-80" : ""}`}>
            <button className="w-full text-left px-5 py-4" onClick={onToggle}>
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`p-2 rounded-xl shrink-0 ${completada ? "bg-green-50 dark:bg-green-900/20" : "bg-blue-50 dark:bg-blue-900/20"}`}>
                            <FileText size={18} className={completada ? "text-green-600" : "text-blue-600"} />
                        </div>
                        <div className="min-w-0">
                            <p className="font-semibold text-slate-800 dark:text-slate-100">Receta del {emision}</p>
                            {medico && <p className="text-xs text-slate-400 mt-0.5 truncate">Dr/a. {medico.nombre} {medico.apellido}</p>}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <BadgeEstado estado={receta.estado} vencida={vencida} />
                        <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 ${expandida ? "rotate-180" : ""}`} />
                    </div>
                </div>
                <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
                    <span>Emitida {emision}</span>
                    <span>·</span>
                    <span>{items.length} medicamento{items.length !== 1 ? "s" : ""}</span>
                    {pendientes > 0 && <><span>·</span><span className="text-amber-600 font-medium">{pendientes} pendiente{pendientes !== 1 ? "s" : ""}</span></>}
                </div>
            </button>

            {expandida && (
                <div className="border-t border-slate-100 dark:border-slate-700">
                    {medico && (
                        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Médico</p>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white text-sm font-bold shrink-0">{iniciales(medico.nombre, medico.apellido)}</div>
                                <div>
                                    <p className="font-semibold text-slate-800 dark:text-slate-100">Dr/a. {medico.nombre} {medico.apellido}</p>
                                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                                        {medico.especialidad && <><span>{medico.especialidad}</span><span>·</span></>}
                                        <span>Mat. {medico.matricula}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex gap-6">
                        <div><p className="text-xs text-slate-400">Emisión</p><p className="text-sm font-medium text-slate-700 dark:text-slate-200 mt-0.5">{emision}</p></div>
                        <div><p className="text-xs text-slate-400">Vencimiento</p><p className="text-sm font-medium text-slate-700 dark:text-slate-200 mt-0.5">{vencimiento}</p></div>
                    </div>

                    <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Medicamentos</p>
                        <div className="space-y-2">
                            {items.map(item => {
                                const med = getMedicamento(item.id_medicamento);
                                return (
                                    <div key={item.id_item} className={`rounded-xl border p-3 flex items-start gap-3 ${item.entregado ? "bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-700" : "bg-blue-50/60 dark:bg-blue-900/10 border-blue-100 dark:border-blue-800"}`}>
                                        <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${item.entregado ? "bg-slate-200 dark:bg-slate-700" : "bg-blue-100 dark:bg-blue-900/30"}`}>
                                            <Pill size={13} className={item.entregado ? "text-slate-500" : "text-blue-600"} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <p className={`text-sm font-semibold ${item.entregado ? "text-slate-500 dark:text-slate-400" : "text-slate-800 dark:text-slate-100"}`}>{med?.nombre_generico ?? "Medicamento"}</p>
                                                    {med?.nombre_comercial && <p className="text-xs text-slate-400">{med.nombre_comercial}</p>}
                                                </div>
                                                <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${item.entregado ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>{item.entregado ? "Entregado" : "Pendiente"}</span>
                                            </div>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{item.cantidad} unid.{item.indicaciones ? ` · ${item.indicaciones}` : ""}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="px-5 py-4 flex items-center justify-between flex-wrap gap-3">
                        <button onClick={onToggleQr} className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors">
                            <QrCode size={16} />
                            {qrVisible ? "Ocultar QR de validación" : "Mostrar QR de validación"}
                        </button>
                        <button onClick={() => generarPdfReceta(receta, medico, items, getMedicamento)} className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors">
                            <Download size={16} />
                            Descargar PDF
                        </button>
                    </div>
                    <div className="px-5 pb-4">
                        {qrVisible && (
                            <div className="mt-3 flex items-start gap-4">
                                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=farmatch-receta-${receta.id_receta}&color=1e40af&bgcolor=f0f9ff`} alt={`QR receta ${receta.id_receta}`} className="rounded-xl border border-blue-100 shadow-sm" width={120} height={120} />
                                <div className="text-xs text-slate-400 space-y-1 pt-1">
                                    <p className="font-medium text-slate-600 dark:text-slate-300">Receta #{receta.id_receta}</p>
                                    <p>Presentá este código en la farmacia para retirar tus medicamentos.</p>
                                    <p className="text-slate-300 dark:text-slate-600">ID: farmatch-receta-{receta.id_receta}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
