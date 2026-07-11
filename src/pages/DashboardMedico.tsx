import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabase";
import ChatIA from "../components/ChatIA";
import { Users, FileText, PlusCircle, LogOut, ChevronDown, ChevronUp, CheckCircle, Clock, Search, Trash2, AlertCircle, X, UserPlus, Sun, Moon, Download } from "lucide-react";
import { jsPDF } from "jspdf";
import { FarmatchLogoHorizontal } from "../components/FarmatchLogo";
import { useDarkMode } from "../hooks/useDarkMode";

interface Paciente { id_paciente: number; nombre: string; apellido: string; dni: string; obra_social: string | null; }
interface Medicamento { id_medicamento: number; nombre_generico: string; nombre_comercial: string | null; }
interface RecetaItem { id_item: number; id_medicamento: number; cantidad: number; indicaciones: string | null; entregado: boolean; medicamentos: { nombre_generico: string; nombre_comercial: string | null }; }
interface Receta { id_receta: number; id_paciente: number; estado: "activa" | "completada"; fecha_emision: string; pacientes: { nombre: string; apellido: string; dni: string }; receta_items: RecetaItem[]; }
interface ItemForm { id_medicamento: number | null; cantidad: number; indicaciones: string; }
interface Diagnostico { id_diagnostico: number; id_paciente: number; id_medico: number; descripcion: string; fecha: string; }

const initials = (nombre: string, apellido: string) => `${nombre[0]}${apellido[0]}`.toUpperCase();
const avatarColor = (id: number) => { const p = ["bg-blue-100 text-blue-700", "bg-indigo-100 text-indigo-700", "bg-sky-100 text-sky-700", "bg-blue-200 text-blue-800"]; return p[id % p.length]; };
const formatDate = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });

function getBadgeReceta(fechaEmision: string, estado: string) {
    const venc = new Date(fechaEmision); venc.setDate(venc.getDate() + 30);
    const vencida = estado === "activa" && venc < new Date();
    if (vencida) return { color: "bg-red-50 text-red-700 border-red-200", label: "Vencida" };
    if (estado === "completada") return { color: "bg-green-50 text-green-700 border-green-200", label: "Completada" };
    return { color: "bg-amber-50 text-amber-700 border-amber-200", label: "Activa" };
}

function generarPdfRecetaMedico(receta: Receta, medicoNombre: string) {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("FARMATCH", 14, 20);
    doc.setFontSize(11);
    doc.text("Receta digital", 14, 27);
    doc.setLineWidth(0.5);
    doc.line(14, 32, 196, 32);

    doc.setFontSize(10);
    doc.text(`Receta N: ${receta.id_receta}`, 14, 42);
    doc.text(`Fecha de emision: ${new Date(receta.fecha_emision).toLocaleDateString("es-AR")}`, 14, 49);
    doc.text(`Estado: ${receta.estado}`, 14, 56);
    doc.text(`Paciente: ${receta.pacientes.nombre} ${receta.pacientes.apellido}`, 14, 66);
    doc.text(`DNI: ${receta.pacientes.dni}`, 14, 73);
    doc.text(`Medico: Dr/a. ${medicoNombre}`, 14, 80);

    doc.setFontSize(12);
    doc.text("Medicamentos:", 14, 94);
    doc.setFontSize(10);
    let y = 102;
    receta.receta_items.forEach((item, i) => {
        doc.text(`${i + 1}. ${item.medicamentos.nombre_generico}${item.medicamentos.nombre_comercial ? ` (${item.medicamentos.nombre_comercial})` : ""} - Cantidad: ${item.cantidad}`, 14, y);
        y += 6;
        if (item.indicaciones) { doc.text(`   ${item.indicaciones}`, 14, y); y += 6; }
        doc.text(`   Estado: ${item.entregado ? "Entregado" : "Pendiente"}`, 14, y);
        y += 9;
    });

    doc.setFontSize(8);
    doc.text(`ID de validacion: farmatch-receta-${receta.id_receta}`, 14, 285);

    doc.save(`receta-farmatch-${receta.id_receta}.pdf`);
}

export default function DashboardMedico() {
    const navigate = useNavigate();
    const { dark, toggle } = useDarkMode();
    const [medicoId, setMedicoId] = useState<number | null>(null);
    const [medicoNombre, setMedicoNombre] = useState("");
    const [medicoEspecialidad, setMedicoEspecialidad] = useState("");
    const [misPacientes, setMisPacientes] = useState<Paciente[]>([]);
    const [todosPacientes, setTodosPacientes] = useState<Paciente[]>([]);
    const [recetas, setRecetas] = useState<Receta[]>([]);
    const [medicamentos, setMedicamentos] = useState<Medicamento[]>([]);
    const [tab, setTab] = useState<"pacientes" | "crear" | "historial">("pacientes");
    const [expandedReceta, setExpandedReceta] = useState<number | null>(null);
    const [searchPaciente, setSearchPaciente] = useState("");
    const [searchHistorial, setSearchHistorial] = useState("");
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
    const [formPacienteId, setFormPacienteId] = useState<number | null>(null);
    const [formSearchPaciente, setFormSearchPaciente] = useState("");
    const [showPacienteSuggestions, setShowPacienteSuggestions] = useState(false);
    const [formItems, setFormItems] = useState<ItemForm[]>([{ id_medicamento: null, cantidad: 1, indicaciones: "" }]);
    const [submitting, setSubmitting] = useState(false);
    const [showModalPaciente, setShowModalPaciente] = useState(false);
    const [newNombre, setNewNombre] = useState("");
    const [newApellido, setNewApellido] = useState("");
    const [newDni, setNewDni] = useState("");
    const [newObraSocial, setNewObraSocial] = useState("");
    const [savingPaciente, setSavingPaciente] = useState(false);
    const [showModalEditar, setShowModalEditar] = useState(false);
    const [editPacienteId, setEditPacienteId] = useState<number | null>(null);
    const [editNombre, setEditNombre] = useState("");
    const [editApellido, setEditApellido] = useState("");
    const [editDni, setEditDni] = useState("");
    const [editObraSocial, setEditObraSocial] = useState("");
    const [savingEdicion, setSavingEdicion] = useState(false);
    const [diagnosticos, setDiagnosticos] = useState<Diagnostico[]>([]);
    const [expandedPacienteDiag, setExpandedPacienteDiag] = useState<number | null>(null);
    const [nuevoDiagnostico, setNuevoDiagnostico] = useState("");
    const [savingDiagnostico, setSavingDiagnostico] = useState(false);

    const card = "rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm";
    const inp = "rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";

    useEffect(() => {
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return navigate("/");
            const { data: perfil } = await supabase.from("perfiles").select("ficha_id, rol").eq("id", user.id).single();
            if (!perfil || perfil.rol !== "medico") return navigate("/");
            const { data: medico } = await supabase.from("medicos").select("id_medico, nombre, apellido, especialidad").eq("id_medico", perfil.ficha_id).single();
            if (!medico) return navigate("/");
            setMedicoId(medico.id_medico);
            setMedicoNombre(`${medico.nombre} ${medico.apellido}`);
            setMedicoEspecialidad(medico.especialidad ?? "Medico");
            await Promise.all([loadMisPacientes(medico.id_medico), loadTodosPacientes(), loadRecetas(medico.id_medico), loadMedicamentos(), loadDiagnosticos()]);
            setLoading(false);
        })();
    }, []);

    const loadMisPacientes = async (id: number) => {
        const { data: asignaciones } = await supabase.from("paciente_medico").select("id_paciente, especialidad").eq("id_medico", id);
        if (!asignaciones || asignaciones.length === 0) { setMisPacientes([]); return; }
        const idsPacientes = asignaciones.map((a: any) => a.id_paciente);
        const { data } = await supabase.from("pacientes").select("id_paciente, nombre, apellido, dni, obra_social").in("id_paciente", idsPacientes).order("apellido");
        setMisPacientes(data ?? []);
    };

    const loadTodosPacientes = async () => { const { data } = await supabase.from("pacientes").select("id_paciente, nombre, apellido, dni, obra_social").order("apellido"); setTodosPacientes(data ?? []); };
    const loadRecetas = async (id: number) => {
        const { data: recetasData, error: err1 } = await supabase.from("recetas").select("id_receta, id_paciente, id_medico, estado, fecha_emision").eq("id_medico", id).order("fecha_emision", { ascending: false });
        if (err1 || !recetasData?.length) { setRecetas([]); return; }
        const recetaIds = recetasData.map((r: any) => r.id_receta);
        const { data: itemsData } = await supabase.from("receta_items").select("id_item, id_receta, id_medicamento, cantidad, indicaciones, entregado, medicamentos(nombre_generico, nombre_comercial)").in("id_receta", recetaIds);
        const pacienteIds = [...new Set(recetasData.map((r: any) => r.id_paciente))];
        const { data: pacientesData } = await supabase.from("pacientes").select("id_paciente, nombre, apellido, dni").in("id_paciente", pacienteIds);
        setRecetas(recetasData.map((r: any) => {
            const pac = (pacientesData ?? []).find((p: any) => p.id_paciente === r.id_paciente);
            return { ...r, pacientes: pac ? { nombre: pac.nombre, apellido: pac.apellido, dni: pac.dni } : { nombre: "Desconocido", apellido: "", dni: "" }, receta_items: (itemsData ?? []).filter((it: any) => it.id_receta === r.id_receta) };
        }) as unknown as Receta[]);
    };

    const loadMedicamentos = async () => { const { data } = await supabase.from("medicamentos").select("id_medicamento, nombre_generico, nombre_comercial").order("nombre_generico"); setMedicamentos(data ?? []); };
    const loadDiagnosticos = async () => { const { data } = await supabase.from("diagnosticos").select("*").order("fecha", { ascending: false }); setDiagnosticos(data ?? []); };
    const showToast = (msg: string, type: "ok" | "err") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500); };
    const handleLogout = async () => { await supabase.auth.signOut(); navigate("/"); };

    const handleAgregarPaciente = async () => {
        if (!newNombre.trim() || !newApellido.trim() || !newDni.trim()) return showToast("Nombre, apellido y DNI son obligatorios.", "err");
        setSavingPaciente(true);
        try {
            const { data: existente } = await supabase.from("pacientes").select("id_paciente, nombre, apellido").eq("dni", newDni.trim()).maybeSingle();
            if (existente) {
                const { data: yaAsignado } = await supabase.from("paciente_medico").select("id").eq("id_paciente", existente.id_paciente).eq("id_medico", medicoId).maybeSingle();
                if (yaAsignado) { showToast("Ese paciente ya esta a tu cargo.", "err"); return; }
                const { error: errInsert } = await supabase.from("paciente_medico").insert({ id_paciente: existente.id_paciente, id_medico: medicoId, especialidad: medicoEspecialidad });
                if (errInsert) throw errInsert;
                showToast(`Paciente ${existente.nombre} ${existente.apellido} asignado a tu cargo.`, "ok");
                setShowModalPaciente(false); setNewNombre(""); setNewApellido(""); setNewDni(""); setNewObraSocial("");
                await Promise.all([loadMisPacientes(medicoId!), loadTodosPacientes()]);
                return;
            }
            const { data, error } = await supabase.from("pacientes").insert({
                nombre: newNombre.trim(),
                apellido: newApellido.trim(),
                dni: newDni.trim(),
                email: `${newDni.trim()}@farmatch.temp`,
                obra_social: newObraSocial.trim() || null,
            }).select().single();
            if (error) throw error;
            await supabase.from("paciente_medico").insert({ id_paciente: data.id_paciente, id_medico: medicoId, especialidad: medicoEspecialidad });
            showToast(`Paciente ${data.nombre} ${data.apellido} agregado.`, "ok");
            setShowModalPaciente(false); setNewNombre(""); setNewApellido(""); setNewDni(""); setNewObraSocial("");
            await Promise.all([loadMisPacientes(medicoId!), loadTodosPacientes()]);
        } catch (e: any) { showToast(e?.code === "23505" ? "Ya existe un paciente con ese DNI." : "Error al agregar el paciente.", "err"); }
        finally { setSavingPaciente(false); }
    };

    const handleAbrirEditar = (p: Paciente) => {
        setEditPacienteId(p.id_paciente);
        setEditNombre(p.nombre);
        setEditApellido(p.apellido);
        setEditDni(p.dni);
        setEditObraSocial(p.obra_social ?? "");
        setShowModalEditar(true);
    };

    const handleGuardarEdicion = async () => {
        if (!editNombre.trim() || !editApellido.trim() || !editDni.trim()) return showToast("Nombre, apellido y DNI son obligatorios.", "err");
        setSavingEdicion(true);
        try {
            const { error } = await supabase.from("pacientes").update({
                nombre: editNombre.trim(),
                apellido: editApellido.trim(),
                dni: editDni.trim(),
                obra_social: editObraSocial.trim() || null,
            }).eq("id_paciente", editPacienteId);
            if (error) throw error;
            showToast("Paciente actualizado.", "ok");
            setShowModalEditar(false);
            await Promise.all([loadMisPacientes(medicoId!), loadTodosPacientes()]);
        } catch (e: any) { showToast(e?.code === "23505" ? "Ya existe un paciente con ese DNI." : "Error al actualizar el paciente.", "err"); }
        finally { setSavingEdicion(false); }
    };

    const addItem = () => setFormItems([...formItems, { id_medicamento: null, cantidad: 1, indicaciones: "" }]);
    const removeItem = (i: number) => setFormItems(formItems.filter((_, idx) => idx !== i));
    const updateItem = (i: number, field: keyof ItemForm, value: ItemForm[keyof ItemForm]) => setFormItems(formItems.map((item, idx) => idx === i ? { ...item, [field]: value } : item));

    const handleCrearReceta = async () => {
        if (!formPacienteId) return showToast("Selecciona un paciente.", "err");
        if (formItems.some((it) => !it.id_medicamento)) return showToast("Selecciona un medicamento en cada fila.", "err");
        if (formItems.some((it) => it.cantidad < 1)) return showToast("La cantidad minima es 1.", "err");
        setSubmitting(true);
        try {
            const { data: receta, error: errReceta } = await supabase
                .from("recetas")
                .insert({
                    id_paciente: formPacienteId,
                    id_medico: medicoId,
                    estado: "activa",
                    fecha_vencimiento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
                }).select().single();
            if (errReceta || !receta) throw errReceta;
            const { error: errItems } = await supabase.from("receta_items").insert(formItems.map((it) => ({ id_receta: receta.id_receta, id_medicamento: it.id_medicamento, cantidad: it.cantidad, indicaciones: it.indicaciones || null, entregado: false })));
            if (errItems) throw errItems;
            showToast("Receta emitida exitosamente.", "ok");
            setFormPacienteId(null); setFormSearchPaciente(""); setFormItems([{ id_medicamento: null, cantidad: 1, indicaciones: "" }]);
            await loadRecetas(medicoId!); setTab("historial");
        } catch { showToast("Error al crear la receta. Intenta de nuevo.", "err"); }
        finally { setSubmitting(false); }
    };

    const filteredMisPacientes = misPacientes.filter((p) => { const q = searchPaciente.toLowerCase(); return p.nombre.toLowerCase().includes(q) || p.apellido.toLowerCase().includes(q) || p.dni.includes(q); });
    const filteredRecetas = recetas.filter((r) => { const q = searchHistorial.toLowerCase(); return r.pacientes.nombre.toLowerCase().includes(q) || r.pacientes.apellido.toLowerCase().includes(q) || r.pacientes.dni.includes(q); });
    const pacienteSuggestions = formSearchPaciente.length >= 2 ? todosPacientes.filter((p) => { const q = formSearchPaciente.toLowerCase(); return p.nombre.toLowerCase().includes(q) || p.apellido.toLowerCase().includes(q) || `${p.nombre} ${p.apellido}`.toLowerCase().includes(q) || p.dni.includes(q); }).slice(0, 8) : [];
    const selectedPaciente = todosPacientes.find((p) => p.id_paciente === formPacienteId);
    const recetasPorPaciente = (id: number) => recetas.filter((r) => r.id_paciente === id);
    const getDiagnosticosPaciente = (id: number) => diagnosticos.filter((d) => d.id_paciente === id);
    const handleAgregarDiagnostico = async (idPaciente: number) => {
        if (!nuevoDiagnostico.trim()) return showToast("Escribi una descripcion.", "err");
        setSavingDiagnostico(true);
        try {
            const { error } = await supabase.from("diagnosticos").insert({ id_paciente: idPaciente, id_medico: medicoId, descripcion: nuevoDiagnostico.trim() });
            if (error) throw error;
            setNuevoDiagnostico("");
            showToast("Diagnostico agregado.", "ok");
            await loadDiagnosticos();
        } catch { showToast("Error al agregar el diagnostico.", "err"); }
        finally { setSavingDiagnostico(false); }
    };
    const statsActivas = recetas.filter((r) => r.estado === "activa").length;
    const statsCompletadas = recetas.filter((r) => r.estado === "completada").length;

    if (loading) return <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-900 flex items-center justify-center"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>;

    return (
        <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-900">
            {toast && (
                <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${toast.type === "ok" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
                    {toast.type === "ok" ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                    {toast.msg}
                    <button onClick={() => setToast(null)} className="ml-2 opacity-60 hover:opacity-100"><X size={14} /></button>
                </div>
            )}

            {showModalPaciente && (
                <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-base">Nuevo paciente</h3>
                            <button onClick={() => { setShowModalPaciente(false); setNewNombre(""); setNewApellido(""); setNewDni(""); setNewObraSocial(""); }} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {[{ label: "Nombre *", value: newNombre, onChange: setNewNombre, placeholder: "Lucia" }, { label: "Apellido *", value: newApellido, onChange: setNewApellido, placeholder: "Fernandez" }].map(({ label, value, onChange, placeholder }) => (
                                <div key={label}>
                                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide">{label}</label>
                                    <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`w-full px-3 py-2.5 text-sm ${inp}`} />
                                </div>
                            ))}
                            <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide">DNI *</label>
                                <input type="text" value={newDni} onChange={(e) => setNewDni(e.target.value.replace(/\D/g, ""))} placeholder="12345678" maxLength={8} className={`w-full px-3 py-2.5 text-sm ${inp}`} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide">Obra social</label>
                                <input type="text" value={newObraSocial} onChange={(e) => setNewObraSocial(e.target.value)} placeholder="OSDE, IOMA..." className={`w-full px-3 py-2.5 text-sm ${inp}`} />
                            </div>
                        </div>
                        <p className="text-xs text-slate-400">El paciente quedara asignado a tu cargo automaticamente.</p>
                        <div className="flex gap-2 pt-1">
                            <button onClick={() => { setShowModalPaciente(false); setNewNombre(""); setNewApellido(""); setNewDni(""); setNewObraSocial(""); }} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">Cancelar</button>
                            <button onClick={handleAgregarPaciente} disabled={savingPaciente} className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2.5 rounded-xl text-sm font-semibold">
                                {savingPaciente ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <UserPlus size={15} />}
                                {savingPaciente ? "Guardando..." : "Agregar paciente"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showModalEditar && (
                <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-base">Editar paciente</h3>
                            <button onClick={() => setShowModalEditar(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide">Nombre *</label>
                                <input type="text" value={editNombre} onChange={(e) => setEditNombre(e.target.value)} className={`w-full px-3 py-2.5 text-sm ${inp}`} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide">Apellido *</label>
                                <input type="text" value={editApellido} onChange={(e) => setEditApellido(e.target.value)} className={`w-full px-3 py-2.5 text-sm ${inp}`} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide">DNI *</label>
                                <input type="text" value={editDni} onChange={(e) => setEditDni(e.target.value.replace(/\D/g, ""))} maxLength={8} className={`w-full px-3 py-2.5 text-sm ${inp}`} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide">Obra social</label>
                                <input type="text" value={editObraSocial} onChange={(e) => setEditObraSocial(e.target.value)} className={`w-full px-3 py-2.5 text-sm ${inp}`} />
                            </div>
                        </div>
                        <div className="flex gap-2 pt-1">
                            <button onClick={() => setShowModalEditar(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">Cancelar</button>
                            <button onClick={handleGuardarEdicion} disabled={savingEdicion} className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2.5 rounded-xl text-sm font-semibold">
                                {savingEdicion ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <UserPlus size={15} />}
                                {savingEdicion ? "Guardando..." : "Guardar cambios"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <header className="bg-white dark:bg-slate-800 border-b-2 border-blue-600 shadow-sm sticky top-0 z-40">
                <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
                    <FarmatchLogoHorizontal height={40} />
                    <div className="flex items-center gap-3">
                        <button onClick={toggle} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition">
                            {dark ? <Sun size={18} /> : <Moon size={18} />}
                        </button>
                        <div className="text-right hidden sm:block">
                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">Dr. {medicoNombre}</p>
                            <p className="text-xs text-slate-400">Medico {medicoEspecialidad}</p>
                        </div>
                        <button onClick={handleLogout} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-red-500 transition px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
                            <LogOut size={15} /><span className="hidden sm:inline">Salir</span>
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
                <div className="grid grid-cols-3 gap-4">
                    {[{ label: "Pacientes a cargo", value: misPacientes.length, icon: Users }, { label: "Recetas activas", value: statsActivas, icon: Clock }, { label: "Recetas completadas", value: statsCompletadas, icon: CheckCircle }].map(({ label, value, icon: Icon }) => (
                        <div key={label} className={`${card} p-4 flex items-center gap-3`}>
                            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0"><Icon size={20} className="text-blue-600" /></div>
                            <div>
                                <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{value}</p>
                                <p className="text-xs text-slate-400 leading-tight">{label}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <div className={`flex gap-1 ${card} rounded-2xl p-1 w-fit`}>
                    {([{ key: "pacientes", label: "Mis pacientes", icon: Users }, { key: "crear", label: "Crear receta", icon: PlusCircle }, { key: "historial", label: "Historial", icon: FileText }] as const).map(({ key, label, icon: Icon }) => (
                        <button key={key} onClick={() => setTab(key)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tab === key ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"}`}>
                            <Icon size={15} /><span className="hidden sm:inline">{label}</span>
                        </button>
                    ))}
                </div>

                {tab === "pacientes" && (
                    <div className="space-y-4">
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input type="text" placeholder="Buscar por nombre o DNI..." value={searchPaciente} onChange={(e) => setSearchPaciente(e.target.value)} className={`w-full pl-9 pr-4 py-2.5 text-sm ${inp}`} />
                            </div>
                            <button onClick={() => setShowModalPaciente(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm whitespace-nowrap">
                                <UserPlus size={15} /><span className="hidden sm:inline">Nuevo paciente</span>
                            </button>
                        </div>
                        {filteredMisPacientes.length === 0 ? (
                            <div className={`${card} p-8 text-center`}>
                                <Users size={32} className="text-slate-300 mx-auto mb-2" />
                                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">{searchPaciente ? "No hay pacientes que coincidan." : "Todavia no tenes pacientes asignados."}</p>
                                {!searchPaciente && <button onClick={() => setShowModalPaciente(true)} className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium">Agregar el primero</button>}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {filteredMisPacientes.map((p) => {
                                    const recs = recetasPorPaciente(p.id_paciente);
                                    const activas = recs.filter((r) => r.estado === "activa").length;
                                    return (
                                        <div key={p.id_paciente} className={`${card} p-4`}>
                                            <div className="flex items-start gap-3">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 ${avatarColor(p.id_paciente)}`}>{initials(p.nombre, p.apellido)}</div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <p className="font-semibold text-slate-800 dark:text-slate-100">{p.nombre} {p.apellido}</p>
                                                        {activas > 0 && <span className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full font-medium">{activas} receta{activas > 1 ? "s" : ""} activa{activas > 1 ? "s" : ""}</span>}
                                                    </div>
                                                    <p className="text-xs text-slate-400 mt-0.5">DNI {p.dni}{p.obra_social ? ` - ${p.obra_social}` : ""}</p>
                                                    {recs.length > 0 && (
                                                        <div className="mt-2 flex flex-wrap gap-1.5">
                                                            {recs.slice(0, 3).map((r) => { const badge = getBadgeReceta(r.fecha_emision, r.estado); return <span key={r.id_receta} className={`text-xs px-2 py-0.5 rounded-full font-medium border ${badge.color}`}>{formatDate(r.fecha_emision)} - {badge.label}</span>; })}
                                                            {recs.length > 3 && <span className="text-xs text-slate-400">+{recs.length - 3} mas</span>}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex flex-col gap-2 flex-shrink-0">
                                                    <button onClick={() => { setFormPacienteId(p.id_paciente); setFormSearchPaciente(`${p.nombre} ${p.apellido}`); setTab("crear"); }} className="text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors">Nueva receta</button>
                                                    <button onClick={() => setExpandedPacienteDiag(expandedPacienteDiag === p.id_paciente ? null : p.id_paciente)} className="text-xs font-medium text-slate-600 hover:text-slate-800 bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 px-3 py-1.5 rounded-lg transition-colors">Diagnosticos</button>
                                                    <button onClick={() => handleAbrirEditar(p)} className="text-xs font-medium text-slate-600 hover:text-slate-800 bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 px-3 py-1.5 rounded-lg transition-colors">Editar</button>
                                                </div>
                                            </div>
                                            {expandedPacienteDiag === p.id_paciente && (
                                                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 space-y-3">
                                                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Diagnosticos</p>
                                                    {getDiagnosticosPaciente(p.id_paciente).length === 0 ? (
                                                        <p className="text-xs text-slate-400">Sin diagnosticos registrados.</p>
                                                    ) : (
                                                        <div className="space-y-2">
                                                            {getDiagnosticosPaciente(p.id_paciente).map((d) => (
                                                                <div key={d.id_diagnostico} className="rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 p-3">
                                                                    <p className="text-sm text-slate-700 dark:text-slate-200">{d.descripcion}</p>
                                                                    <p className="text-xs text-slate-400 mt-1">{formatDate(d.fecha)}</p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                    <div className="flex gap-2">
                                                        <input type="text" placeholder="Nuevo diagnostico..." value={nuevoDiagnostico} onChange={(e) => setNuevoDiagnostico(e.target.value)} className={`flex-1 px-3 py-2 text-sm ${inp}`} />
                                                        <button onClick={() => handleAgregarDiagnostico(p.id_paciente)} disabled={savingDiagnostico} className="text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg">
                                                            {savingDiagnostico ? "..." : "Agregar"}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {tab === "crear" && (
                    <div className={`${card} p-6 space-y-5`}>
                        <h2 className="font-semibold text-slate-800 dark:text-slate-100 text-base">Nueva receta</h2>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Paciente</label>
                            <div className="relative">
                                {selectedPaciente ? (
                                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-blue-300 bg-blue-50 dark:bg-blue-900/20">
                                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0 ${avatarColor(selectedPaciente.id_paciente)}`}>{initials(selectedPaciente.nombre, selectedPaciente.apellido)}</div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{selectedPaciente.nombre} {selectedPaciente.apellido}</p>
                                            <p className="text-xs text-slate-400">DNI {selectedPaciente.dni}</p>
                                        </div>
                                        <button onClick={() => { setFormPacienteId(null); setFormSearchPaciente(""); }} className="text-slate-400 hover:text-slate-600"><X size={15} /></button>
                                    </div>
                                ) : (
                                    <>
                                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                        <input type="text" placeholder="Buscar paciente por nombre o DNI..." value={formSearchPaciente} onChange={(e) => { setFormSearchPaciente(e.target.value); setShowPacienteSuggestions(true); }} onFocus={() => setShowPacienteSuggestions(true)} className={`w-full pl-9 pr-4 py-2.5 text-sm ${inp}`} />
                                        {showPacienteSuggestions && pacienteSuggestions.length > 0 && (
                                            <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-lg overflow-hidden">
                                                {pacienteSuggestions.map((p) => (
                                                    <button key={p.id_paciente} onMouseDown={() => { setFormPacienteId(p.id_paciente); setFormSearchPaciente(`${p.nombre} ${p.apellido}`); setShowPacienteSuggestions(false); }} className="w-full text-left px-3 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors border-b border-slate-50 dark:border-slate-700 last:border-0 flex items-center gap-2">
                                                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0 ${avatarColor(p.id_paciente)}`}>{initials(p.nombre, p.apellido)}</div>
                                                        <div>
                                                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{p.nombre} {p.apellido}</p>
                                                            <p className="text-xs text-slate-400">DNI {p.dni}{p.obra_social ? ` - ${p.obra_social}` : ""}</p>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                            <p className="text-xs text-slate-400 mt-1.5">Podes recetar a cualquier paciente registrado. No esta? <button onClick={() => setShowModalPaciente(true)} className="text-blue-600 hover:text-blue-800 font-medium">Agregarlo ahora</button></p>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">Medicamentos</label>
                            <div className="space-y-3">
                                {formItems.map((item, i) => (
                                    <div key={i} className="border border-slate-100 dark:border-slate-700 rounded-xl p-3 space-y-2 bg-slate-50 dark:bg-slate-900/50">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs font-medium text-slate-400">Medicamento {i + 1}</span>
                                            {formItems.length > 1 && <button onClick={() => removeItem(i)} className="text-slate-300 hover:text-red-400"><Trash2 size={14} /></button>}
                                        </div>
                                        <select value={item.id_medicamento ?? ""} onChange={(e) => updateItem(i, "id_medicamento", e.target.value ? Number(e.target.value) : null)} className={`w-full px-3 py-2 rounded-lg text-sm ${inp}`}>
                                            <option value="">Selecciona un medicamento...</option>
                                            {medicamentos.map((m) => <option key={m.id_medicamento} value={m.id_medicamento}>{m.nombre_generico}{m.nombre_comercial ? ` (${m.nombre_comercial})` : ""}</option>)}
                                        </select>
                                        <div className="flex gap-2">
                                            <div className="w-24">
                                                <input type="number" min={1} value={item.cantidad} onChange={(e) => updateItem(i, "cantidad", Math.max(1, Number(e.target.value)))} className={`w-full px-3 py-2 rounded-lg text-sm text-center ${inp}`} />
                                                <p className="text-xs text-slate-400 text-center mt-0.5">cant.</p>
                                            </div>
                                            <input type="text" placeholder="Indicaciones (opcional)..." value={item.indicaciones} onChange={(e) => updateItem(i, "indicaciones", e.target.value)} className={`flex-1 px-3 py-2 rounded-lg text-sm ${inp}`} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button onClick={addItem} className="mt-2 flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium"><PlusCircle size={15} />Agregar medicamento</button>
                        </div>
                        <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-700">
                            <button onClick={handleCrearReceta} disabled={submitting} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-6 py-2.5 rounded-xl text-sm font-semibold shadow-sm">
                                {submitting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <FileText size={15} />}
                                {submitting ? "Guardando..." : "Emitir receta"}
                            </button>
                        </div>
                    </div>
                )}

                {tab === "historial" && (
                    <div className="space-y-4">
                        <div className="relative">
                            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input type="text" placeholder="Buscar por nombre o DNI del paciente..." value={searchHistorial} onChange={(e) => setSearchHistorial(e.target.value)} className={`w-full pl-9 pr-4 py-2.5 text-sm ${inp}`} />
                        </div>
                        {filteredRecetas.length === 0 ? (
                            <div className={`${card} p-8 text-center`}><FileText size={32} className="text-slate-300 mx-auto mb-2" /><p className="text-slate-400 text-sm">No hay recetas que coincidan.</p></div>
                        ) : (
                            <div className="space-y-3">
                                {filteredRecetas.map((r) => {
                                    const isOpen = expandedReceta === r.id_receta;
                                    const totalItems = r.receta_items.length;
                                    const entregados = r.receta_items.filter((it) => it.entregado).length;
                                    const badge = getBadgeReceta(r.fecha_emision, r.estado);
                                    return (
                                        <div key={r.id_receta} className={`${card} overflow-hidden`}>
                                            <button onClick={() => setExpandedReceta(isOpen ? null : r.id_receta)} className="w-full px-4 py-4 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left">
                                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 ${avatarColor(r.id_paciente)}`}>{initials(r.pacientes.nombre, r.pacientes.apellido)}</div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{r.pacientes.nombre} {r.pacientes.apellido}</p>
                                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${badge.color}`}>{badge.label}</span>
                                                    </div>
                                                    <p className="text-xs text-slate-400 mt-0.5">{formatDate(r.fecha_emision)} - {totalItems} medicamento{totalItems > 1 ? "s" : ""} - {entregados}/{totalItems} entregados</p>
                                                </div>
                                                {isOpen ? <ChevronUp size={16} className="text-slate-400 flex-shrink-0" /> : <ChevronDown size={16} className="text-slate-400 flex-shrink-0" />}
                                            </button>
                                            {isOpen && (
                                                <div className="px-4 pb-4 border-t border-slate-50 dark:border-slate-700">
                                                    <div className="mt-3 space-y-2">
                                                        {r.receta_items.map((it) => (
                                                            <div key={it.id_item} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700">
                                                                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${it.entregado ? "bg-green-400" : "bg-amber-400"}`} />
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{it.medicamentos.nombre_generico}{it.medicamentos.nombre_comercial && <span className="text-slate-400 font-normal ml-1 text-xs">({it.medicamentos.nombre_comercial})</span>}</p>
                                                                    <p className="text-xs text-slate-400">Cantidad: {it.cantidad}{it.indicaciones ? ` - ${it.indicaciones}` : ""}</p>
                                                                </div>
                                                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${it.entregado ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>{it.entregado ? "Entregado" : "Pendiente"}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <button onClick={() => generarPdfRecetaMedico(r, medicoNombre)} className="mt-3 flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors">
                                                        <Download size={15} />
                                                        Descargar PDF
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </main>
            <ChatIA rol="medico" />
        </div>
    );
}
