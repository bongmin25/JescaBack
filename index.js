import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { MercadoPagoConfig, Payment, Preference } from "mercadopago";

// Configurar variables de entorno
dotenv.config();

// Configurar MercadoPago
const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

const payment = new Payment(client);
const preference = new Preference(client);

const app = express();
const port = 3000;

// Variables en memoria para evitar duplicados y almacenar notificaciones (solo para pruebas locales)
const processedPayments = new Set();
const notificationsLog = [];

app.use(cors());
app.use(express.json());

// Ruta principal
app.get("/", (req, res) => {
  res.send("Soy el server:");
});

// Crear una preferencia
app.post("/create_preference", async (req, res) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "El carrito está vacío." });
    }

    const body = {
      items: items.map((item) => ({
        title: item.title,
        quantity: Number(item.quantity),
        unit_price: Number(item.price),
        currency_id: "ARS",
      })),
      back_urls: {
        success: `http://localhost:3001/carrito?status=success`,
        failure: `http://localhost:3001/carrito?status=failure`,
        pending: `http://localhost:3001/carrito?status=pending`,
      },
      auto_return: "approved",
    };

    const result = await preference.create({ body });

    res.json({
      id: result.id,
    });
  } catch (error) {
    console.error(
      "Error al crear la preferencia:",
      error.response?.data || error.message
    );
    res.status(500).json({ error: "Hubo un error al crear la preferencia" });
  }
});

// Procesar notificaciones de pago
app.post("/", async (req, res) => {
  try {
    const notification = req.body;

    notificationsLog.push(notification);
    console.log("Notificación recibida y almacenada:", notification);

    const paymentId = notification?.data?.id;

    if (!paymentId) {
      console.error("No se recibió un ID de pago válido en la notificación.");
      return res.status(400).send("ID de pago no proporcionado.");
    }

    // Verificar si ya fue procesado
    if (processedPayments.has(paymentId)) {
      console.log("El ID de pago ya fue procesado:", paymentId);
      return res.status(200).send("Notificación duplicada ignorada.");
    }

    processedPayments.add(paymentId);

    // Obtener detalles del pago desde MercadoPago
    const response = await payment.get({ id: paymentId });

    if (response.status !== 200) {
      console.error("Error al verificar el pago, status no 200:", response);
      return res.status(500).send("Error al verificar el pago.");
    }

    const paymentDetails = response.body;

    if (paymentDetails.status === "approved") {
      console.log("Pago aprobado:", paymentDetails);
    } else {
      console.log("El pago no fue aprobado. Estado:", paymentDetails.status);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("Error procesando la notificación:", error.message || error);
    res.status(500).send("Error procesando la notificación.");
  }
});

// Iniciar servidor
app.listen(port, () => {
  console.log(`El servidor está corriendo en el puerto ${port}`);
});
