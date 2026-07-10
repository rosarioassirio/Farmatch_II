import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import { useNavigate } from "react-router-dom";
import { FarmatchLogoHorizontal } from "../components/FarmatchLogo";
import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import ChatIA from "../components/ChatIA";
import { Search, FileText, PackageCheck, LogOut, Sun, Moon } from "lucide-react";
import { useDarkMode } from "../hooks/useDarkMode";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
});

function calcularDistanciaKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function DashboardPaciente() {
    const navigate = useNavigate();
    const { dark, toggle } = useDarkMode();
    const [farmacias, setFarmacias] = useState<any[]>([]);
    const [farmaciasCercanas, setFarmaciasCercanas] = useState<any[]>([]);
    const [recetas, setRecetas] = useState<any[]>([]);
    const [nombre, setNombre] = useState("");
    const [medicamentosPendientes, setMedicamentosPendientes] = useState(0);
    const [reservasActivas, setReservasActivas] = useState(0);
    const [reservaListaParaRetirar, setReservaListaParaRetirar] = useState<any | null>(null);
    const [ubicacion, setUbicacion] = useState<{ lat: number; lng: number } | null>(null);
    const [ubicacionError, setUbicacionError] = useState(false);

    async function cerrarSesion() {
        await supabase.auth.signOut();
        navigate("/");
    }

    useEffect(() => {
        navigator.geolocation.getCurrentPosition(
            (pos) => setUbicacion({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => setUbicacionError(true)
        );
    }, []);

    useEffect(() => {
        if (!ubicacion || farmacias.length === 0) return;
        const cercanas = farmacias
            .map((f) => ({ ...f, distancia: calcularDistanciaKm(ubicacion.lat, ubicacion.lng, f.latitud, f.longitud) }))
            .filter((f) => f.distancia <= 5)
            .sort((a, b) => a.distancia - b.distancia);
        setFarmaciasCercanas(cercanas);
    }, [ubicacion, farmacias]);

    useEffect(() => {
        async function cargarDatos() {
            const { data: farmaciasData } = await supabase.from("farmacias").select("*");
            if (farmaciasData) setFarmacias(farmaciasData);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data: perfil } = await supabase.from("perfiles").select("*").eq("id", user.id).single();
            if (perfil) setNombre(perfil.nombre);
            const { data: paciente } = await supabase.from("pacientes").select("*").eq("email", user.email).single();
            if (!paciente) return;
            const { data: recetasData } = await supabase.from("recetas").select("*")
                .eq("id_paciente", paciente.id_paciente).eq("estado", "activa");
            if (recetasData) {
                setRecetas(recetasData);
                const idsRecetas = recetasData.map((r) => r.id_receta);
                const { data: itemsPaciente } = await supabase.from("receta_items").select("*")
                    .in("id_receta", idsRecetas).eq("entregado", false);
                setMedicamentosPendientes(itemsPaciente?.length || 0);
            }
            const { data: reservasData } = await supabase.from("reservas").select("*")
                .eq("id_paciente", paciente.id_paciente)
                .in("estado", ["pendiente", "preparando", "lista"]);
            if (reservasData) {
                setReservasActivas(reservasData.length);
                const lista = reservasData.find((r) => r.estado === "lista");
                if (lista) {
                    const { data: farmacia } = await supabase.from("farmacias").select("nombre, direccion")
                        .eq("id_farmacia", lista.id_farmacia).single();
                    setReservaListaParaRetirar(farmacia);
                }
            }
        }
        cargarDatos();
    }, []);

    const mapCenter = ubicacion ?? { lat: -34.6037, lng: -58.3816 };

    return (
        <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-900">
            <header className="bg-white dark:bg-slate-800 border-b-2 border-blue-600 shadow-sm">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-8 py-3">
                    <FarmatchLogoHorizontal height={48} />
                    <div className="flex items-center gap-3">
                        <button onClick={toggle} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition">
                            {dark ? <Sun size={18} /> : <Moon size={18} />}
                        </button>
                        <div className="text-right">
                            <p className="font-semibold text-slate-800 dark:text-slate-100">{nombre}</p>
                            <p className="text-sm text-slate-400">paciente</p>
                        </div>
                        <button onClick={cerrarSesion} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-red-500 transition px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
                            <LogOut size={15} />
                            <span>Salir</span>
                        </button>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-7xl p-8">
                <h2 className="mb-2 text-3xl font-bold text-slate-800 dark:text-slate-100">
                    Bienvenida, {nombre.split(" ")[0]}
                </h2>
                <p className="mb-8 text-slate-400">¿Qué necesitás hoy?</p>

                {reservaListaParaRetirar && (
                    <div className="mb-6 rounded-2xl border-l-4 border-green-500 bg-green-50 dark:bg-green-900/20 p-4 flex items-center justify-between">
                        <div>
                            <p className="font-semibold text-green-700 dark:text-green-400">Tu pedido está listo para retirar</p>
                            <p className="text-sm text-green-600 dark:text-green-500">{reservaListaParaRetirar.nombre} · {reservaListaParaRetirar.direccion}</p>
                        </div>
                        <button onClick={() => navigate("/mis-reservas")} className="rounded-xl bg-green-600 px-4 py-2 text-sm text-white font-medium hover:bg-green-700 transition">
                            Ver reservas
                        </button>
                    </div>
                )}

                <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
                    {[
                        { label: "Recetas activas", value: recetas.length, sub: null },
                        { label: "Medicamentos pendientes", value: medicamentosPendientes, sub: "sin entregar" },
                        { label: "Reservas activas", value: reservasActivas, sub: "en proceso" },
                        { label: "Farmacias cercanas", value: ubicacion ? farmaciasCercanas.length : "—", sub: ubicacionError ? "sin ubicación" : ubicacion ? "en radio de 5 km" : "obteniendo..." },
                    ].map(({ label, value, sub }) => (
                        <div key={label} className="rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-sm border border-slate-100 dark:border-slate-700">
                            <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
                            <p className="mt-2 text-4xl font-bold text-blue-600">{value}</p>
                            {sub && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{sub}</p>}
                        </div>
                    ))}
                </div>

                <h2 className="mb-4 text-lg font-bold text-slate-800 dark:text-slate-100">Acciones rápidas</h2>
                <div className="mb-10 grid gap-4 md:grid-cols-3">
                    <button onClick={() => navigate("/buscar-medicamentos")} className="rounded-2xl bg-white dark:bg-slate-800 p-6 text-left border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition">
                        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-900/30">
                            <Search size={20} className="text-blue-600" />
                        </div>
                        <h3 className="font-semibold text-slate-800 dark:text-slate-100">Buscar medicamento</h3>
                        <p className="mt-1 text-sm text-slate-400">Encontrá disponibilidad en farmacias cercanas.</p>
                    </button>
                    <button onClick={() => navigate("/mis-recetas")} className="rounded-2xl bg-white dark:bg-slate-800 p-6 text-left border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition">
                        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-900/30">
                            <FileText size={20} className="text-blue-600" />
                        </div>
                        <h3 className="font-semibold text-slate-800 dark:text-slate-100">Mis recetas</h3>
                        <p className="mt-1 text-sm text-slate-400">Consultá todas tus recetas digitales.</p>
                    </button>
                    <button onClick={() => navigate("/mis-reservas")} className="rounded-2xl bg-white dark:bg-slate-800 p-6 text-left border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition">
                        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-900/30">
                            <PackageCheck size={20} className="text-blue-600" />
                        </div>
                        <h3 className="font-semibold text-slate-800 dark:text-slate-100">Mis reservas</h3>
                        <p className="mt-1 text-sm text-slate-400">Seguí el estado de tus pedidos.</p>
                        {reservasActivas > 0 && (
                            <span className="mt-2 inline-block rounded-full bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:text-blue-400">
                                {reservasActivas} activa{reservasActivas > 1 ? "s" : ""}
                            </span>
                        )}
                    </button>
                </div>

                <h2 className="mb-4 text-lg font-bold text-slate-800 dark:text-slate-100">Farmacias cercanas</h2>
                {ubicacionError && <p className="mb-4 text-sm text-slate-400">No se pudo obtener tu ubicación. Mostrando todas las farmacias.</p>}

                <div className="overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm" style={{ height: "400px" }}>
                    {!ubicacion && !ubicacionError ? (
                        <div className="flex h-full items-center justify-center bg-slate-50 dark:bg-slate-800">
                            <p className="text-slate-400">Obteniendo tu ubicación...</p>
                        </div>
                    ) : (
                        <MapContainer center={[mapCenter.lat, mapCenter.lng]} zoom={13} style={{ height: "100%", width: "100%" }}>
                            <TileLayer
                                attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                                url={dark
                                    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                                    : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"}
                            />
                            {ubicacion && (
                                <Circle center={[ubicacion.lat, ubicacion.lng]} radius={5000}
                                    pathOptions={{ color: "#3b82f6", fillColor: "#3b82f6", fillOpacity: 0.08 }} />
                            )}
                            {ubicacion && <Marker position={[ubicacion.lat, ubicacion.lng]}><Popup>Tu ubicación</Popup></Marker>}
                            {farmacias.map((f) => (
                                <Marker key={f.id_farmacia} position={[f.latitud, f.longitud]}>
                                    <Popup>
                                        <strong>{f.nombre}</strong><br />{f.direccion}
                                        {ubicacion && <><br /><span>{calcularDistanciaKm(ubicacion.lat, ubicacion.lng, f.latitud, f.longitud).toFixed(1)} km</span></>}
                                    </Popup>
                                </Marker>
                            ))}
                        </MapContainer>
                    )}
                </div>

                {ubicacion && farmaciasCercanas.length > 0 && (
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {farmaciasCercanas.map((f) => (
                            <div key={f.id_farmacia} className="flex items-center justify-between rounded-2xl bg-white dark:bg-slate-800 p-4 border border-slate-100 dark:border-slate-700 shadow-sm">
                                <div>
                                    <p className="font-semibold text-slate-800 dark:text-slate-100">{f.nombre}</p>
                                    <p className="text-sm text-slate-400">{f.direccion}</p>
                                </div>
                                <span className="rounded-full bg-blue-100 dark:bg-blue-900/40 px-3 py-1 text-sm font-semibold text-blue-700 dark:text-blue-400">
                                    {f.distancia.toFixed(1)} km
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </main>
            <ChatIA rol="paciente" />
        </div>
    );
}