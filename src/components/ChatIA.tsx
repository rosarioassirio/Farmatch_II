import { useState, useRef, useEffect } from "react";
import { X, Send, User, Loader } from "lucide-react";
import { FarmyIcon } from "./FarmyIcon";
import { supabase } from "../services/supabase";

type Rol = "paciente" | "medico" | "farmacia";
interface Mensaje { rol: "user" | "assistant"; contenido: string; }
interface Props { rol: Rol; contexto?: string; idPaciente?: number; idMedico?: number; idFarmacia?: number; }

const advertencia = `Responde siempre en espanol. Se muy conciso y directo, maximo 2-3 oraciones por respuesta. Al final de cada respuesta agrega una linea corta recordando consultar con un profesional.`;

const systemPrompt = (rol: Rol, contexto?: string): string => {
    const base: Record<Rol, string> = {
        paciente: `Sos un asistente farmacologico de FARMATCH que ayuda a pacientes. Podes explicar para que sirven los medicamentos, como tomarlos, efectos secundarios comunes, que alimentos o actividades evitar, y responder dudas generales sobre salud y medicacion. Tambien podes crear reservas de medicamentos en una farmacia cuando el paciente te lo pida (usando la herramienta crear_reserva). No diagnosticas enfermedades ni modificas indicaciones medicas.${contexto ? `\nContexto del paciente: ${contexto}` : ""}\n${advertencia}`,
        medico: `Sos un asistente clinico de FARMATCH que ayuda a medicos. Podes responder sobre interacciones medicamentosas, dosis habituales, mecanismos de accion, contraindicaciones, equivalentes genericos y comerciales, y guias clinicas. Usa lenguaje tecnico apropiado para un profesional medico.${contexto ? `\nContexto: ${contexto}` : ""}\n${advertencia}`,
        farmacia: `Sos un asistente de FARMATCH que ayuda al personal de farmacias. Podes responder sobre equivalentes genericos y comerciales, conservacion de medicamentos, presentaciones disponibles, cadena de frio, y dudas operativas sobre dispensacion.${contexto ? `\nContexto: ${contexto}` : ""}\n${advertencia}`,
    };
    return base[rol];
};

const mensajeInicial: Record<Rol, string> = {
    paciente: "Hola! Soy FARMY, tu asistente de salud de FARMATCH. Puedo explicarte tus medicamentos o reservarte tus recetas pendientes en una farmacia. En que te puedo ayudar?",
    medico: "Hola! Soy FARMY, tu asistente clinico de FARMATCH. Podes consultarme sobre interacciones medicamentosas, dosis, contraindicaciones, equivalentes genericos o guias clinicas. En que te puedo ayudar?",
    farmacia: "Hola! Soy FARMY, tu asistente farmaceutico de FARMATCH. Podes preguntarme sobre equivalentes genericos y comerciales, conservacion de medicamentos, presentaciones disponibles o dudas sobre dispensacion. En que te puedo ayudar?",
};

const placeholder: Record<Rol, string> = {
    paciente: "Reservame mis medicamentos en Farmacia Gonnet",
    medico: "Hay interaccion entre ibuprofeno y aspirina?",
    farmacia: "Cual es el generico de Atorvastatina?",
};

const titulo: Record<Rol, string> = { paciente: "FARMY", medico: "FARMY", farmacia: "FARMY" };

const COHERE_API_KEY = import.meta.env.VITE_COHERE_KEY;

// ---------- Definicion de herramientas por rol ----------

const toolsPaciente = [
    {
        type: "function",
        function: {
            name: "crear_reserva",
            description: "Crea una reserva de los medicamentos pendientes de entrega del paciente en una farmacia especifica. Usar cuando el paciente pida reservar, retirar, pedir o buscar sus medicamentos en una farmacia puntual.",
            parameters: {
                type: "object",
                properties: {
                    nombre_farmacia: { type: "string", description: "Nombre o parte del nombre de la farmacia donde se quiere reservar" },
                    medicamentos: { type: "array", items: { type: "string" }, description: "Nombres de los medicamentos a reservar. Si se omite, se reservan todos los medicamentos pendientes del paciente." },
                },
                required: ["nombre_farmacia"],
            },
        },
    },
];

const toolsMedico = [
    {
        type: "function",
        function: {
            name: "crear_paciente",
            description: "Crea un paciente nuevo y lo asigna al medico actual. Usar cuando el medico pida dar de alta o registrar un paciente nuevo.",
            parameters: {
                type: "object",
                properties: {
                    nombre: { type: "string", description: "Nombre del paciente" },
                    apellido: { type: "string", description: "Apellido del paciente" },
                    dni: { type: "string", description: "DNI del paciente, solo numeros" },
                    obra_social: { type: "string", description: "Obra social del paciente, si se menciona" },
                },
                required: ["nombre", "apellido", "dni"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "crear_receta",
            description: "Emite una receta nueva para un paciente ya asignado al medico actual, con uno o mas medicamentos. Usar cuando el medico pida recetar, emitir una receta o indicar medicamentos a un paciente.",
            parameters: {
                type: "object",
                properties: {
                    paciente: { type: "string", description: "Nombre, apellido o DNI del paciente al que se le emite la receta" },
                    medicamentos: {
                        type: "array",
                        description: "Lista de medicamentos a recetar",
                        items: {
                            type: "object",
                            properties: {
                                nombre: { type: "string", description: "Nombre generico o comercial del medicamento" },
                                cantidad: { type: "number", description: "Cantidad, por defecto 1" },
                                indicaciones: { type: "string", description: "Indicaciones de uso, opcional" },
                            },
                            required: ["nombre"],
                        },
                    },
                },
                required: ["paciente", "medicamentos"],
            },
        },
    },
];

const toolsFarmacia = [
    {
        type: "function",
        function: {
            name: "actualizar_stock",
            description: "Actualiza la cantidad disponible y/o el precio de un medicamento en el stock de la farmacia actual. Si el medicamento no esta en el stock, lo agrega. Usar cuando el personal de la farmacia pida cargar, actualizar o modificar stock o precios.",
            parameters: {
                type: "object",
                properties: {
                    nombre_medicamento: { type: "string", description: "Nombre generico o comercial del medicamento" },
                    cantidad: { type: "number", description: "Nueva cantidad disponible" },
                    precio: { type: "number", description: "Nuevo precio, opcional" },
                },
                required: ["nombre_medicamento", "cantidad"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "obtener_estadisticas",
            description: "Devuelve un resumen de las estadisticas de la farmacia actual: medicamentos mas buscados, oportunidades de stock (buscados y no encontrados), pedidos por estado, y facturacion/comision a traves de Farmatch. Usar cuando pregunten por estadisticas, numeros, facturacion o rendimiento de la farmacia.",
            parameters: { type: "object", properties: {} },
        },
    },
];

function getToolsForRol(rol: Rol) {
    if (rol === "paciente") return toolsPaciente;
    if (rol === "medico") return toolsMedico;
    if (rol === "farmacia") return toolsFarmacia;
    return [];
}

// ---------- Ejecucion de herramientas contra Supabase ----------

async function ejecutarHerramienta(nombre: string, args: any, ctx: { idPaciente?: number; idMedico?: number; idFarmacia?: number }): Promise<any> {
    if (nombre === "crear_reserva") {
        if (!ctx.idPaciente) return { error: "No se encontro el paciente." };
        const { data: farmacias } = await supabase.from("farmacias").select("id_farmacia, nombre").ilike("nombre", `%${args.nombre_farmacia}%`);
        if (!farmacias || farmacias.length === 0) return { error: `No se encontro ninguna farmacia que coincida con "${args.nombre_farmacia}".` };
        const farmacia = farmacias[0];

        const { data: recetasActivas } = await supabase.from("recetas").select("id_receta").eq("id_paciente", ctx.idPaciente).eq("estado", "activa");
        if (!recetasActivas || recetasActivas.length === 0) return { error: "El paciente no tiene recetas activas." };
        const idsRecetas = recetasActivas.map((r: any) => r.id_receta);

        let itemsQuery = supabase.from("receta_items").select("id_item, id_medicamento, cantidad, medicamentos(nombre_generico)").in("id_receta", idsRecetas).eq("entregado", false);
        const { data: itemsPendientes } = await itemsQuery;
        if (!itemsPendientes || itemsPendientes.length === 0) return { error: "No hay medicamentos pendientes de entrega." };

        let itemsAReservar = itemsPendientes;
        if (args.medicamentos && args.medicamentos.length > 0) {
            const nombresBuscados = args.medicamentos.map((m: string) => m.toLowerCase());
            itemsAReservar = itemsPendientes.filter((it: any) => nombresBuscados.some((n: string) => it.medicamentos?.nombre_generico?.toLowerCase().includes(n)));
            if (itemsAReservar.length === 0) return { error: `Ninguno de los medicamentos pedidos (${args.medicamentos.join(", ")}) esta pendiente de entrega.` };
        }

        const { data: reservaCreada, error: errReserva } = await supabase.from("reservas").insert({ id_paciente: ctx.idPaciente, id_farmacia: farmacia.id_farmacia, fecha: new Date().toISOString(), estado: "pendiente" }).select().single();
        if (errReserva || !reservaCreada) return { error: "Ocurrio un error al crear la reserva." };

        await supabase.from("reserva_items").insert(itemsAReservar.map((it: any) => ({ id_reserva: reservaCreada.id_reserva, id_item: it.id_item })));

        return {
            exito: true,
            farmacia: farmacia.nombre,
            medicamentos_reservados: itemsAReservar.map((it: any) => it.medicamentos?.nombre_generico ?? "medicamento"),
            id_reserva: reservaCreada.id_reserva,
        };
    }
    if (nombre === "crear_paciente") {
        if (!ctx.idMedico) return { error: "No se encontro el medico." };
        const { data: medico } = await supabase.from("medicos").select("especialidad").eq("id_medico", ctx.idMedico).single();
        const { data: existente } = await supabase.from("pacientes").select("id_paciente, nombre, apellido").eq("dni", String(args.dni).trim()).maybeSingle();
        if (existente) {
            const { data: yaAsignado } = await supabase.from("paciente_medico").select("id").eq("id_paciente", existente.id_paciente).eq("id_medico", ctx.idMedico).maybeSingle();
            if (yaAsignado) return { error: `${existente.nombre} ${existente.apellido} ya esta a tu cargo.` };
            await supabase.from("paciente_medico").insert({ id_paciente: existente.id_paciente, id_medico: ctx.idMedico, especialidad: medico?.especialidad ?? "Clinica" });
            return { exito: true, paciente: `${existente.nombre} ${existente.apellido}`, asignado_existente: true };
        }
        const { data: nuevoPaciente, error } = await supabase.from("pacientes").insert({
            nombre: args.nombre, apellido: args.apellido, dni: String(args.dni).trim(),
            email: `${String(args.dni).trim()}@farmatch.temp`, obra_social: args.obra_social || null,
        }).select().single();
        if (error || !nuevoPaciente) return { error: "Ocurrio un error al crear el paciente." };
        await supabase.from("paciente_medico").insert({ id_paciente: nuevoPaciente.id_paciente, id_medico: ctx.idMedico, especialidad: medico?.especialidad ?? "Clinica" });
        return { exito: true, paciente: `${args.nombre} ${args.apellido}`, asignado_existente: false };
    }

    if (nombre === "crear_receta") {
        if (!ctx.idMedico) return { error: "No se encontro el medico." };
        const { data: misPacientes } = await supabase.from("paciente_medico").select("id_paciente").eq("id_medico", ctx.idMedico);
        if (!misPacientes || misPacientes.length === 0) return { error: "No tenes pacientes asignados." };
        const idsMisPacientes = misPacientes.map((p: any) => p.id_paciente);
        const { data: candidatos } = await supabase.from("pacientes").select("id_paciente, nombre, apellido, dni").in("id_paciente", idsMisPacientes);
        const busqueda = String(args.paciente).toLowerCase();
        const pacienteEncontrado = (candidatos ?? []).find((p: any) =>
            p.dni.includes(busqueda) || `${p.nombre} ${p.apellido}`.toLowerCase().includes(busqueda) || p.nombre.toLowerCase().includes(busqueda) || p.apellido.toLowerCase().includes(busqueda)
        );
        if (!pacienteEncontrado) return { error: `No se encontro un paciente tuyo que coincida con "${args.paciente}".` };

        const { data: recetaCreada, error: errReceta } = await supabase.from("recetas").insert({
            id_paciente: pacienteEncontrado.id_paciente, id_medico: ctx.idMedico, estado: "activa",
            fecha_vencimiento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        }).select().single();
        if (errReceta || !recetaCreada) return { error: "Ocurrio un error al crear la receta." };

        const medicamentosNoEncontrados: string[] = [];
        const itemsInsertados: string[] = [];
        for (const med of args.medicamentos) {
            const { data: medsEncontrados } = await supabase.from("medicamentos").select("id_medicamento, nombre_generico").or(`nombre_generico.ilike.%${med.nombre}%,nombre_comercial.ilike.%${med.nombre}%`).limit(1);
            if (!medsEncontrados || medsEncontrados.length === 0) { medicamentosNoEncontrados.push(med.nombre); continue; }
            await supabase.from("receta_items").insert({
                id_receta: recetaCreada.id_receta, id_medicamento: medsEncontrados[0].id_medicamento,
                cantidad: med.cantidad || 1, indicaciones: med.indicaciones || null, entregado: false,
            });
            itemsInsertados.push(medsEncontrados[0].nombre_generico);
        }
        return {
            exito: true, paciente: `${pacienteEncontrado.nombre} ${pacienteEncontrado.apellido}`,
            medicamentos_recetados: itemsInsertados, medicamentos_no_encontrados: medicamentosNoEncontrados,
            id_receta: recetaCreada.id_receta,
        };
    }

    if (nombre === "actualizar_stock") {
        if (!ctx.idFarmacia) return { error: "No se encontro la farmacia." };
        const { data: medsEncontrados } = await supabase.from("medicamentos").select("id_medicamento, nombre_generico").or(`nombre_generico.ilike.%${args.nombre_medicamento}%,nombre_comercial.ilike.%${args.nombre_medicamento}%`).limit(1);
        if (!medsEncontrados || medsEncontrados.length === 0) return { error: `No se encontro el medicamento "${args.nombre_medicamento}".` };
        const medicamento = medsEncontrados[0];
        const { data: stockExistente } = await supabase.from("stock").select("id_stock").eq("id_farmacia", ctx.idFarmacia).eq("id_medicamento", medicamento.id_medicamento).maybeSingle();
        if (stockExistente) {
            const updateData: any = { cantidad_disponible: args.cantidad, ultima_actualizacion: new Date().toISOString() };
            if (args.precio) updateData.precio = args.precio;
            await supabase.from("stock").update(updateData).eq("id_stock", stockExistente.id_stock);
        } else {
            await supabase.from("stock").insert({ id_farmacia: ctx.idFarmacia, id_medicamento: medicamento.id_medicamento, cantidad_disponible: args.cantidad, precio: args.precio || 0, ultima_actualizacion: new Date().toISOString() });
        }
        return { exito: true, medicamento: medicamento.nombre_generico, cantidad: args.cantidad, precio: args.precio || null };
    }

    if (nombre === "obtener_estadisticas") {
        if (!ctx.idFarmacia) return { error: "No se encontro la farmacia." };
        const { data: reservasData } = await supabase.from("reservas").select("estado, comision").eq("id_farmacia", ctx.idFarmacia);
        const contadores: Record<string, number> = { pendiente: 0, preparando: 0, lista: 0, entregada: 0, cancelada: 0 };
        let totalComisiones = 0;
        (reservasData ?? []).forEach((r: any) => { if (r.estado in contadores) contadores[r.estado]++; if (r.comision) totalComisiones += Number(r.comision); });

        const { data: busquedasData } = await supabase.from("busquedas").select("id_medicamento, resultado").eq("id_farmacia", ctx.idFarmacia);
        const conteoEncontrados: Record<number, number> = {}; const conteoNoEncontrados: Record<number, number> = {};
        (busquedasData ?? []).forEach((b: any) => {
            if (!b.id_medicamento) return;
            if (b.resultado === "encontrado") conteoEncontrados[b.id_medicamento] = (conteoEncontrados[b.id_medicamento] || 0) + 1;
            if (b.resultado === "no_encontrado") conteoNoEncontrados[b.id_medicamento] = (conteoNoEncontrados[b.id_medicamento] || 0) + 1;
        });
        const idsMeds = [...new Set([...Object.keys(conteoEncontrados), ...Object.keys(conteoNoEncontrados)].map(Number))];
        const { data: medsData } = idsMeds.length > 0 ? await supabase.from("medicamentos").select("id_medicamento, nombre_generico").in("id_medicamento", idsMeds) : { data: [] as any[] };
        const nombreMed = (id: number) => (medsData ?? []).find((m: any) => m.id_medicamento === id)?.nombre_generico ?? "desconocido";

        const masBuscados = Object.entries(conteoEncontrados).sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, 5).map(([id, cant]) => ({ medicamento: nombreMed(Number(id)), busquedas: cant }));
        const oportunidades = Object.entries(conteoNoEncontrados).sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, 5).map(([id, cant]) => ({ medicamento: nombreMed(Number(id)), veces_no_encontrado: cant }));

        return { exito: true, pedidos_por_estado: contadores, comision_total_farmatch: Math.round(totalComisiones * 100) / 100, mas_buscados: masBuscados, oportunidades_de_stock: oportunidades };
    }

    return { error: "Herramienta no reconocida." };
}

async function llamarCohere(mensajesAPI: any[], tools: any[]) {
    return fetch("https://api.cohere.com/v2/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${COHERE_API_KEY}` },
        body: JSON.stringify({
            model: "command-r-plus-08-2024",
            messages: mensajesAPI,
            ...(tools.length > 0 ? { tools } : {}),
        }),
    });
}

export default function ChatIA({ rol, contexto, idPaciente, idMedico, idFarmacia }: Props) {
    const [abierto, setAbierto] = useState(false);
    const [mensajes, setMensajes] = useState<Mensaje[]>([{ rol: "assistant", contenido: mensajeInicial[rol] }]);
    const [input, setInput] = useState("");
    const [cargando, setCargando] = useState(false);
    const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
    const bottomRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const observer = new MutationObserver(() => {
            setDark(document.documentElement.classList.contains("dark"));
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
        return () => observer.disconnect();
    }, []);

    useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [mensajes, cargando]);
    useEffect(() => { if (abierto) setTimeout(() => inputRef.current?.focus(), 100); }, [abierto]);

    const enviar = async () => {
        const texto = input.trim();
        if (!texto || cargando) return;
        const nuevosMensajes: Mensaje[] = [...mensajes, { rol: "user", contenido: texto }];
        setMensajes(nuevosMensajes);
        setInput("");
        setCargando(true);
        try {
            const tools = getToolsForRol(rol);
            let mensajesAPI: any[] = [
                { role: "system", content: systemPrompt(rol, contexto) },
                ...nuevosMensajes.map((m) => ({ role: m.rol === "user" ? "user" : "assistant", content: m.contenido })),
            ];

            let response = await llamarCohere(mensajesAPI, tools);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            let data = await response.json();

            if (data.message?.tool_calls && data.message.tool_calls.length > 0) {
                const toolCalls = data.message.tool_calls;
                mensajesAPI.push({ role: "assistant", tool_calls: toolCalls, tool_plan: data.message.tool_plan ?? "" });

                for (const tc of toolCalls) {
                    let args: any = {};
                    try { args = JSON.parse(tc.function.arguments); } catch { args = {}; }
                    const resultado = await ejecutarHerramienta(tc.function.name, args, { idPaciente, idMedico, idFarmacia });
                    mensajesAPI.push({
                        role: "tool",
                        tool_call_id: tc.id,
                        content: [{ type: "document", document: { data: JSON.stringify(resultado) } }],
                    });
                }

                response = await llamarCohere(mensajesAPI, tools);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                data = await response.json();
            }

            const respuesta = data.message?.content?.[0]?.text ?? "No pude procesar la respuesta.";
            setMensajes([...nuevosMensajes, { rol: "assistant", contenido: respuesta }]);
        } catch {
            setMensajes([...nuevosMensajes, { rol: "assistant", contenido: "Hubo un error al conectar con el asistente. Intenta de nuevo." }]);
        } finally {
            setCargando(false);
        }
    };

    const handleKey = (e: React.KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } };

    return (
        <>
            <button
                onClick={() => setAbierto((v) => !v)}
                style={{ backgroundColor: abierto ? "#334155" : dark ? "#1e293b" : "#f1f5f9", borderColor: dark ? "#475569" : "#e2e8f0" }}
                className="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-110 border"
                aria-label="Abrir asistente IA"
            >
                {abierto ? <X size={22} className="text-white" /> : <FarmyIcon size={36} />}
            </button>

            {abierto && (
                <div
                    style={{ backgroundColor: dark ? "#1e293b" : "#ffffff", borderColor: dark ? "#334155" : "#f1f5f9", maxHeight: "520px" }}
                    className="fixed bottom-24 right-5 z-50 w-80 sm:w-96 rounded-2xl shadow-2xl border flex flex-col overflow-hidden"
                >
                    <div className="bg-blue-600 px-4 py-3 flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                            <FarmyIcon size={24} />
                        </div>
                        <div>
                            <p className="text-white font-semibold text-sm">{titulo[rol]}</p>
                            <p className="text-blue-200 text-xs">Powered by IA - No reemplaza consulta medica</p>
                        </div>
                    </div>

                    <div style={{ backgroundColor: dark ? "#0f172a" : "#f8fafc", minHeight: "300px" }} className="flex-1 overflow-y-auto p-3 space-y-3">
                        {mensajes.map((m, i) => (
                            <div key={i} className={`flex gap-2 ${m.rol === "user" ? "flex-row-reverse" : "flex-row"}`}>
                                <div style={{ backgroundColor: m.rol === "user" ? "#2563eb" : dark ? "#334155" : "#e2e8f0" }} className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                    {m.rol === "user" ? <User size={13} className="text-white" /> : <FarmyIcon size={18} />}
                                </div>
                                <div style={{
                                    backgroundColor: m.rol === "user" ? "#2563eb" : dark ? "#1e293b" : "#ffffff",
                                    color: m.rol === "user" ? "#ffffff" : dark ? "#e2e8f0" : "#334155",
                                    borderColor: dark ? "#334155" : "#f1f5f9",
                                }} className="max-w-[78%] px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap border shadow-sm">
                                    {m.contenido}
                                </div>
                            </div>
                        ))}

                        {cargando && (
                            <div className="flex gap-2">
                                <div style={{ backgroundColor: dark ? "#334155" : "#e2e8f0" }} className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <FarmyIcon size={18} />
                                </div>
                                <div style={{ backgroundColor: dark ? "#1e293b" : "#ffffff", borderColor: dark ? "#334155" : "#f1f5f9" }} className="border shadow-sm rounded-2xl px-3 py-2">
                                    <div className="flex gap-1 items-center h-5">
                                        {[0, 1, 2].map((i) => (
                                            <div key={i} className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={bottomRef} />
                    </div>

                    <div style={{ backgroundColor: dark ? "#1e293b" : "#ffffff", borderColor: dark ? "#334155" : "#f1f5f9" }} className="p-3 border-t">
                        <div className="flex gap-2 items-center">
                            <input
                                ref={inputRef}
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKey}
                                placeholder={placeholder[rol]}
                                disabled={cargando}
                                style={{ backgroundColor: dark ? "#0f172a" : "#f8fafc", borderColor: dark ? "#475569" : "#e2e8f0", color: dark ? "#e2e8f0" : "#1e293b" }}
                                className="flex-1 px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                            />
                            <button
                                onClick={enviar}
                                disabled={!input.trim() || cargando}
                                className="w-9 h-9 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors flex-shrink-0"
                            >
                                {cargando ? <Loader size={15} className="text-white animate-spin" /> : <Send size={15} className="text-white" />}
                            </button>
                        </div>
                        <p style={{ color: dark ? "#475569" : "#cbd5e1" }} className="text-xs text-center mt-2">Solo informativo - No reemplaza consulta medica</p>
                    </div>
                </div>
            )}
        </>
    );
}
