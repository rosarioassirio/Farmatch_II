import { Link, useNavigate } from "react-router-dom";
import { FarmatchLogoHorizontal } from "../components/FarmatchLogo";
import { useDarkMode } from "../hooks/useDarkMode";
import { Sun, Moon, Search, FileText, PackageCheck, Brain, MapPin, Shield } from "lucide-react";

export default function Landing() {
    const navigate = useNavigate();
    const { dark, toggle } = useDarkMode();

    return (
        <div className="min-h-screen bg-white dark:bg-slate-900 transition-colors">

            {/* Nav */}
            <nav className="flex items-center justify-between px-8 py-4 border-b border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-20">
                <FarmatchLogoHorizontal height={44} />
                <div className="flex items-center gap-3">
                    <button
                        onClick={toggle}
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    >
                        {dark ? <Sun size={17} /> : <Moon size={17} />}
                    </button>
                    <Link
                        to="/login"
                        className="rounded-xl bg-blue-600 px-5 py-2 font-semibold text-white hover:bg-blue-700 transition text-sm"
                    >
                        Iniciar sesión
                    </Link>
                </div>
            </nav>

            {/* Hero */}
            <main className="mx-auto max-w-6xl px-8 py-20 flex flex-col lg:flex-row items-center gap-16">
                <div className="flex-1">
                    <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-blue-50 dark:bg-blue-950 px-4 py-1.5 text-sm font-semibold text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                        Plataforma de salud inteligente
                    </div>

                    <h1 className="text-5xl font-extrabold leading-tight text-slate-900 dark:text-white mb-6">
                        Encontrá tus medicamentos
                        <span className="text-blue-500"> en segundos.</span>
                    </h1>

                    <p className="text-lg text-slate-500 dark:text-slate-400 max-w-lg leading-relaxed mb-8">
                        Conectamos pacientes, médicos y farmacias en un solo lugar. Recetas digitales, stock en tiempo real y reservas sin filas.
                    </p>

                    <div className="space-y-3 mb-10">
                        {[
                            { icon: MapPin, text: "Farmacias cercanas con tu medicamento en stock" },
                            { icon: FileText, text: "Recetas digitales y reservas en un clic" },
                            { icon: Brain, text: "Asistente IA farmacológico disponible 24/7" },
                        ].map(({ icon: Icon, text }) => (
                            <div key={text} className="flex items-center gap-3 text-slate-600 dark:text-slate-300 text-sm">
                                <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950 flex items-center justify-center shrink-0">
                                    <Icon size={13} className="text-blue-500" />
                                </div>
                                {text}
                            </div>
                        ))}
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate("/login")}
                            className="rounded-2xl bg-blue-600 px-8 py-3.5 text-base font-semibold text-white hover:bg-blue-700 transition shadow-lg shadow-blue-600/20"
                        >
                            Comenzar gratis
                        </button>
                        <span className="text-sm text-slate-400 dark:text-slate-500">Sin tarjeta de crédito</span>
                    </div>
                </div>

                {/* Mock card */}
                <div className="flex-1 flex justify-center">
                    <div className="w-[320px] rounded-3xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-2xl shadow-slate-200 dark:shadow-slate-950">
                        <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-100 dark:border-slate-700">
                            <div>
                                <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">Bienvenida, Lucía</p>
                                <p className="text-xs text-slate-400">paciente</p>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">LF</div>
                        </div>

                        <div className="grid grid-cols-2 gap-2.5 mb-4">
                            {[
                                { label: "Recetas activas", value: "3" },
                                { label: "Farmacias cercanas", value: "12" },
                                { label: "Reservas activas", value: "2" },
                                { label: "Medicamentos", value: "5" },
                            ].map(({ label, value }) => (
                                <div key={label} className="rounded-2xl bg-slate-50 dark:bg-slate-700/50 p-3 border border-slate-100 dark:border-slate-700">
                                    <p className="text-[10px] text-slate-400 mb-1">{label}</p>
                                    <p className="text-2xl font-bold text-blue-500">{value}</p>
                                </div>
                            ))}
                        </div>

                        <div className="rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900 p-3 flex items-center gap-2 mb-3">
                            <div className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
                            <p className="text-xs text-green-700 dark:text-green-400 font-medium">Tu pedido está listo para retirar</p>
                        </div>

                        <div className="flex gap-2">
                            {["Buscar", "Recetas", "Reservas"].map((label) => (
                                <div key={label} className="flex-1 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-700 py-2 text-center">
                                    <p className="text-[10px] text-slate-400">{label}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </main>

            {/* Cómo funciona */}
            <section className="bg-slate-50 dark:bg-slate-800/50 border-y border-slate-100 dark:border-slate-800 py-20 px-8">
                <div className="max-w-4xl mx-auto text-center mb-12">
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">¿Cómo funciona?</h2>
                    <p className="text-slate-500 dark:text-slate-400">En tres pasos simples</p>
                </div>
                <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-5">
                    {[
                        { paso: "1", titulo: "Buscás tu medicamento", desc: "Seleccionás tus recetas activas y FARMATCH encuentra las farmacias con stock disponible cerca tuyo." },
                        { paso: "2", titulo: "Elegís la farmacia", desc: "Ves el ranking por disponibilidad, precio y distancia. Elegís la mejor opción y reservás." },
                        { paso: "3", titulo: "Retirás tu pedido", desc: "La farmacia prepara tu pedido. Te avisamos cuando está listo." },
                    ].map(({ paso, titulo, desc }) => (
                        <div key={paso} className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700 shadow-sm">
                            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-lg mb-4">
                                {paso}
                            </div>
                            <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-2">{titulo}</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Para quién */}
            <section className="py-20 px-8 bg-white dark:bg-slate-900">
                <div className="max-w-5xl mx-auto text-center mb-12">
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">Una plataforma para todos</h2>
                    <p className="text-slate-500 dark:text-slate-400">Pacientes, médicos y farmacias conectados en un mismo sistema</p>
                </div>
                <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-5">
                    {[
                        {
                            titulo: "Pacientes",
                            badgeBg: "bg-blue-600",
                            borderColor: "border-blue-200 dark:border-blue-900",
                            bgColor: "bg-blue-50 dark:bg-blue-950/30",
                            icon: Search,
                            features: [
                                "Buscá farmacias con tu medicamento en stock",
                                "Reservá sin moverte de tu casa",
                                "Seguí el estado de tu pedido en tiempo real",
                                "Asistente IA para dudas sobre medicamentos",
                            ],
                        },
                        {
                            titulo: "Médicos",
                            badgeBg: "bg-indigo-600",
                            borderColor: "border-indigo-200 dark:border-indigo-900",
                            bgColor: "bg-indigo-50 dark:bg-indigo-950/30",
                            icon: FileText,
                            features: [
                                "Emitís recetas digitales en segundos",
                                "Ves qué medicamentos retiró cada paciente",
                                "Gestionás tus pacientes desde un panel",
                                "Info farmacológica actualizada",
                            ],
                        },
                        {
                            titulo: "Farmacias",
                            badgeBg: "bg-green-600",
                            borderColor: "border-green-200 dark:border-green-900",
                            bgColor: "bg-green-50 dark:bg-green-950/30",
                            icon: PackageCheck,
                            features: [
                                "Recibís pedidos digitales organizados",
                                "Gestionás tu stock en tiempo real",
                                "Estadísticas de ventas y demanda",
                                "Alertas de medicamentos más buscados",
                            ],
                        },
                    ].map(({ titulo, badgeBg, borderColor, bgColor, features }) => (
                        <div key={titulo} className={`rounded-2xl p-6 border ${borderColor} ${bgColor}`}>
                            <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold mb-4 text-white ${badgeBg}`}>
                                {titulo}
                            </span>
                            <ul className="space-y-2.5">
                                {features.map((f) => (
                                    <li key={f} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                                        <div className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500 shrink-0 mt-1.5" />
                                        {f}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </section>

            {/* Trust bar */}
            <section className="bg-slate-50 dark:bg-slate-800/50 border-y border-slate-100 dark:border-slate-800 py-10 px-8">
                <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-center gap-8 text-center md:text-left">
                    {[
                        { icon: Shield, title: "Datos seguros", desc: "Tu información médica está protegida y cifrada." },
                        { icon: MapPin, title: "Cobertura nacional", desc: "Farmacias en toda Argentina integradas al sistema." },
                        { icon: Brain, title: "IA farmacológica", desc: "Respuestas claras sobre tus medicamentos, 24/7." },
                    ].map(({ icon: Icon, title, desc }) => (
                        <div key={title} className="flex items-start gap-3 max-w-xs">
                            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950 shrink-0">
                                <Icon size={16} className="text-blue-500" />
                            </div>
                            <div>
                                <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{title}</p>
                                <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* CTA */}
            <section className="bg-blue-600 py-16 px-8 text-center">
                <h2 className="text-3xl font-bold text-white mb-3">¿Listo para empezar?</h2>
                <p className="text-blue-100 mb-8 text-lg">Unite a FARMATCH y simplificá el acceso a tus medicamentos</p>
                <button
                    onClick={() => navigate("/login")}
                    className="rounded-2xl bg-white text-blue-600 px-8 py-3.5 text-base font-bold hover:bg-blue-50 transition shadow-lg shadow-blue-800/30"
                >
                    Crear cuenta gratis
                </button>
            </section>

            {/* Footer */}
            <footer className="border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-8 py-8">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                    <FarmatchLogoHorizontal height={40} />
                    <p className="text-sm text-slate-400">© 2026 FARMATCH · Plataforma de salud inteligente</p>
                    <div className="flex gap-5 text-sm text-slate-400">
                        <span>Argentina</span>
                        <span>Privacidad</span>
                        <span>Términos</span>
                    </div>
                </div>
            </footer>
        </div>
    );
}