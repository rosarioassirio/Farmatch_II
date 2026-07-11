const { MongoClient } = require("mongodb");

let cachedClient = null;

async function getClient() {
    if (cachedClient) return cachedClient;
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    cachedClient = client;
    return client;
}

module.exports = async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.status(200).end();

    try {
        const client = await getClient();
        const db = client.db("farmatch");
        const coleccion = db.collection("resenas");

        if (req.method === "GET") {
            const idFarmacia = req.query.id_farmacia;
            if (!idFarmacia) return res.status(400).json({ error: "Falta id_farmacia" });
            const resenas = await coleccion.find({ id_farmacia: Number(idFarmacia) }).sort({ fecha: -1 }).toArray();
            const promedio = resenas.length > 0 ? resenas.reduce((t, r) => t + r.calificacion, 0) / resenas.length : null;
            return res.status(200).json({ resenas, promedio, total: resenas.length });
        }

        if (req.method === "POST") {
            const { id_farmacia, id_paciente, nombre_paciente, calificacion, comentario } = req.body;
            if (!id_farmacia || !id_paciente || !calificacion) return res.status(400).json({ error: "Faltan datos obligatorios" });
            if (calificacion < 1 || calificacion > 5) return res.status(400).json({ error: "La calificacion debe ser entre 1 y 5" });
            const nuevaResena = {
                id_farmacia: Number(id_farmacia),
                id_paciente: Number(id_paciente),
                nombre_paciente: nombre_paciente || "Paciente",
                calificacion: Number(calificacion),
                comentario: comentario || "",
                fecha: new Date().toISOString(),
            };
            await coleccion.insertOne(nuevaResena);
            return res.status(201).json({ exito: true });
        }

        return res.status(405).json({ error: "Metodo no permitido" });
    } catch (error) {
        return res.status(500).json({ error: "Error de servidor", detalle: String(error) });
    }
};