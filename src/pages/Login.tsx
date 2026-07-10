import { supabase } from "../services/supabase";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Eye, EyeOff, ArrowLeft, Sun, Moon } from "lucide-react";
import { FarmatchLogoHorizontal } from "../components/FarmatchLogo";
import { useDarkMode } from "../hooks/useDarkMode";

type Modo = "login" | "registro-paciente" | "registro-medico" | "registro-farmacia";

// ─── Componentes reutilizables dark-aware ─────────────────────────────────────

const inputClass = "w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition";

const Input = ({
    type = "text", placeholder, value, onChange, autoFocus = false
}: {
    type?: string; placeholder: string; value: string;
    onChange: (v: string) => void; autoFocus?: boolean;
}) => (
    <input
        type={type} placeholder={placeholder} value={value}
        onChange={(e) => onChange(e.target.value)} autoFocus={autoFocus}
        className={inputClass}
    />
);

const PasswordInput = ({ placeholder, value, onChange }: {
    placeholder: string; value: string; onChange: (v: string) => void;
}) => {
    const [show, setShow] = useState(false);
    return (
        <div className="relative">
            <input
                type={show ? "text" : "password"} placeholder={placeholder} value={value}
                onChange={(e) => onChange(e.target.value)}
                className={inputClass + " pr-11"}
            />
            <button
                type="button" onClick={() => setShow((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
            >
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
        </div>
    );
};

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Login() {
    const navigate = useNavigate();
    const { dark, toggle } = useDarkMode();

    const [modo, setModo] = useState<Modo>("login");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [matricula, setMatricula] = useState("");
    const [codigoFarmacia, setCodigoFarmacia] = useState("");
    const [pacienteNombre, setPacienteNombre] = useState("");
    const [pacienteApellido, setPacienteApellido] = useState("");
    const [pacienteDni, setPacienteDni] = useState("");
    const [pacienteObraSocial, setPacienteObraSocial] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    function resetForm() {
        setEmail(""); setPassword(""); setConfirmPassword("");
        setMatricula(""); setCodigoFarmacia("");
        setPacienteNombre(""); setPacienteApellido(""); setPacienteDni(""); setPacienteObraSocial("");
        setError(""); setSuccess("");
    }

    async function iniciarSesion() {
        setError(""); setLoading(true);
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        setLoading(false);
        if (error) { setError("Email o contraseña incorrectos."); return; }
        const { data: perfil } = await supabase.from("perfiles").select("*").eq("id", data.user.id).single();
        if (perfil?.rol === "paciente") navigate("/paciente");
        else if (perfil?.rol === "medico") navigate("/medico");
        else if (perfil?.rol === "farmacia") navigate("/farmacia");
    }

    async function registrarPaciente() {
        setError("");
        if (!pacienteNombre.trim() || !pacienteApellido.trim() || !pacienteDni.trim()) { setError("Nombre, apellido y DNI son obligatorios."); return; }
        if (password !== confirmPassword) { setError("Las contraseñas no coinciden."); return; }
        setLoading(true);
        const { data: pacienteExistente } = await supabase.from("pacientes").select("id_paciente").eq("dni", pacienteDni.trim()).single();
        if (pacienteExistente) { setError("Ya existe un paciente con ese DNI."); setLoading(false); return; }
        const { data, error: authError } = await supabase.auth.signUp({ email, password });
        if (authError) { setError(authError.message); setLoading(false); return; }
        const { data: nuevoPaciente, error: errPaciente } = await supabase.from("pacientes").insert({
            nombre: pacienteNombre.trim(), apellido: pacienteApellido.trim(),
            dni: pacienteDni.trim(), email: email.trim(),
            obra_social: pacienteObraSocial.trim() || null, id_medico_cargo: null,
        }).select().single();
        if (errPaciente || !nuevoPaciente) { setError("Error al crear el perfil."); setLoading(false); return; }
        await supabase.from("perfiles").insert({ id: data.user!.id, nombre: `${pacienteNombre.trim()} ${pacienteApellido.trim()}`, rol: "paciente", ficha_id: nuevoPaciente.id_paciente });
        setLoading(false);
        setSuccess("Cuenta creada. Ya podés iniciar sesión.");
        setTimeout(() => { resetForm(); setModo("login"); setSuccess(""); }, 2000);
    }

    async function registrarMedico() {
        setError("");
        if (password !== confirmPassword) { setError("Las contraseñas no coinciden."); return; }
        setLoading(true);
        const { data: medico } = await supabase.from("medicos").select("*").eq("matricula", matricula).single();
        if (!medico) { setError("Matrícula no encontrada. Contactá a FARMATCH."); setLoading(false); return; }
        const { data, error: authError } = await supabase.auth.signUp({ email, password });
        if (authError) { setError(authError.message); setLoading(false); return; }
        await supabase.from("perfiles").insert({ id: data.user!.id, nombre: `${medico.nombre} ${medico.apellido}`, rol: "medico", ficha_id: medico.id_medico });
        setLoading(false);
        setSuccess("Cuenta creada. Ya podés iniciar sesión.");
        setTimeout(() => { resetForm(); setModo("login"); setSuccess(""); }, 2000);
    }

    async function registrarFarmacia() {
        setError("");
        if (password !== confirmPassword) { setError("Las contraseñas no coinciden."); return; }
        setLoading(true);
        const { data: farmacia } = await supabase.from("farmacias").select("*").eq("codigo_farmacia", codigoFarmacia).single();
        if (!farmacia) { setError("Código no encontrado. Contactá a FARMATCH."); setLoading(false); return; }
        const { data, error: authError } = await supabase.auth.signUp({ email, password });
        if (authError) { setError(authError.message); setLoading(false); return; }
        await supabase.from("perfiles").insert({ id: data.user!.id, nombre: farmacia.nombre, rol: "farmacia", ficha_id: farmacia.id_farmacia });
        setLoading(false);
        setSuccess("Cuenta creada. Ya podés iniciar sesión.");
        setTimeout(() => { resetForm(); setModo("login"); setSuccess(""); }, 2000);
    }

    const handleKey = (e: React.KeyboardEvent) => { if (e.key === "Enter" && modo === "login") iniciarSesion(); };

    const ErrorBox = ({ msg }: { msg: string }) => (
        <div className="mt-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900 px-4 py-3 text-sm text-red-600 dark:text-red-400">{msg}</div>
    );
    const SuccessBox = ({ msg }: { msg: string }) => (
        <div className="mt-3 rounded-xl bg-green-50 dark:bg-green-950/40 border border-green-100 dark:border-green-900 px-4 py-3 text-sm text-green-600 dark:text-green-400">{msg}</div>
    );
    const SubmitBtn = ({ onClick, label, loadingLabel }: { onClick: () => void; label: string; loadingLabel: string }) => (
        <button onClick={onClick} disabled={loading}
            className="mt-5 w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition flex items-center justify-center gap-2">
            {loading
                ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{loadingLabel}</>
                : label}
        </button>
    );
    const BackBtn = () => (
        <button onClick={() => { resetForm(); setModo("login"); }}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 mb-6 transition">
            <ArrowLeft size={14} /> Volver
        </button>
    );

    return (
        <div
            className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4 transition-colors"
            onKeyDown={handleKey}
        >
            {/* Toggle dark en esquina */}
            <button
                onClick={toggle}
                className="fixed top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-800 transition shadow-sm"
            >
                {dark ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            <div className="w-full max-w-md">
                <div className="rounded-3xl bg-white dark:bg-slate-800 p-10 shadow-xl shadow-slate-200/60 dark:shadow-slate-950/60 border border-slate-100 dark:border-slate-700">

                    <div className="mb-8 flex justify-center">
                        <FarmatchLogoHorizontal height={44} />
                    </div>

                    {/* ── LOGIN ─────────────────────────────────────────────────── */}
                    {modo === "login" && (
                        <>
                            <h1 className="mb-1 text-2xl font-bold text-slate-900 dark:text-white">Iniciar sesión</h1>
                            <p className="mb-7 text-sm text-slate-400">Accedé a tu cuenta FARMATCH</p>
                            <div className="space-y-3">
                                <Input placeholder="Email" type="email" value={email} onChange={setEmail} autoFocus />
                                <PasswordInput placeholder="Contraseña" value={password} onChange={setPassword} />
                            </div>
                            {error && <ErrorBox msg={error} />}
                            <SubmitBtn onClick={iniciarSesion} label="Entrar" loadingLabel="Entrando..." />

                            <div className="mt-7 pt-6 border-t border-slate-100 dark:border-slate-700">
                                <p className="mb-4 text-center text-xs text-slate-400 font-medium uppercase tracking-wide">¿No tenés cuenta?</p>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { label: "Soy paciente", mode: "registro-paciente" as Modo },
                                        { label: "Soy médico", mode: "registro-medico" as Modo },
                                        { label: "Soy farmacia", mode: "registro-farmacia" as Modo },
                                    ].map(({ label, mode }) => (
                                        <button
                                            key={mode}
                                            onClick={() => { resetForm(); setModo(mode); }}
                                            className="rounded-xl border border-slate-200 dark:border-slate-600 py-2.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-blue-300 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400 transition"
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

                    {/* ── REGISTRO PACIENTE ──────────────────────────────────────── */}
                    {modo === "registro-paciente" && (
                        <>
                            <BackBtn />
                            <h1 className="mb-1 text-2xl font-bold text-slate-900 dark:text-white">Crear cuenta</h1>
                            <p className="mb-7 text-sm text-slate-400">Registrate como paciente en FARMATCH</p>
                            <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <Input placeholder="Nombre" value={pacienteNombre} onChange={setPacienteNombre} autoFocus />
                                    <Input placeholder="Apellido" value={pacienteApellido} onChange={setPacienteApellido} />
                                </div>
                                <Input placeholder="DNI (sin puntos)" value={pacienteDni} onChange={(v) => setPacienteDni(v.replace(/\D/g, ""))} />
                                <Input placeholder="Obra social (opcional)" value={pacienteObraSocial} onChange={setPacienteObraSocial} />
                                <Input placeholder="Email" type="email" value={email} onChange={setEmail} />
                                <PasswordInput placeholder="Contraseña" value={password} onChange={setPassword} />
                                <PasswordInput placeholder="Confirmar contraseña" value={confirmPassword} onChange={setConfirmPassword} />
                            </div>
                            {error && <ErrorBox msg={error} />}
                            {success && <SuccessBox msg={success} />}
                            <SubmitBtn onClick={registrarPaciente} label="Crear cuenta" loadingLabel="Creando cuenta..." />
                        </>
                    )}

                    {/* ── REGISTRO MÉDICO ────────────────────────────────────────── */}
                    {modo === "registro-medico" && (
                        <>
                            <BackBtn />
                            <h1 className="mb-1 text-2xl font-bold text-slate-900 dark:text-white">Registro médico</h1>
                            <p className="mb-7 text-sm text-slate-400">Verificamos tu matrícula antes de crear la cuenta</p>
                            <div className="space-y-3">
                                <Input placeholder="Matrícula (ej: MAT-1)" value={matricula} onChange={setMatricula} autoFocus />
                                <Input placeholder="Email" type="email" value={email} onChange={setEmail} />
                                <PasswordInput placeholder="Contraseña" value={password} onChange={setPassword} />
                                <PasswordInput placeholder="Confirmar contraseña" value={confirmPassword} onChange={setConfirmPassword} />
                            </div>
                            {error && <ErrorBox msg={error} />}
                            {success && <SuccessBox msg={success} />}
                            <SubmitBtn onClick={registrarMedico} label="Crear cuenta" loadingLabel="Verificando..." />
                        </>
                    )}

                    {/* ── REGISTRO FARMACIA ──────────────────────────────────────── */}
                    {modo === "registro-farmacia" && (
                        <>
                            <BackBtn />
                            <h1 className="mb-1 text-2xl font-bold text-slate-900 dark:text-white">Registro farmacia</h1>
                            <p className="mb-7 text-sm text-slate-400">Verificamos tu código antes de crear la cuenta</p>
                            <div className="space-y-3">
                                <Input placeholder="Código de farmacia (ej: FARM-34)" value={codigoFarmacia} onChange={setCodigoFarmacia} autoFocus />
                                <Input placeholder="Email" type="email" value={email} onChange={setEmail} />
                                <PasswordInput placeholder="Contraseña" value={password} onChange={setPassword} />
                                <PasswordInput placeholder="Confirmar contraseña" value={confirmPassword} onChange={setConfirmPassword} />
                            </div>
                            {error && <ErrorBox msg={error} />}
                            {success && <SuccessBox msg={success} />}
                            <SubmitBtn onClick={registrarFarmacia} label="Crear cuenta" loadingLabel="Verificando..." />
                        </>
                    )}
                </div>

                <p className="mt-6 text-center text-xs text-slate-400">© 2026 FARMATCH · Tu farmacia, en el mapa.</p>
            </div>
        </div>
    );
}