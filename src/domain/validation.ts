import { z } from "zod";
export const provinces = [
  "Distrito Nacional",
  "Azua",
  "Bahoruco",
  "Barahona",
  "Dajabón",
  "Duarte",
  "Elías Piña",
  "El Seibo",
  "Espaillat",
  "Hato Mayor",
  "Hermanas Mirabal",
  "Independencia",
  "La Altagracia",
  "La Romana",
  "La Vega",
  "María Trinidad Sánchez",
  "Monseñor Nouel",
  "Monte Cristi",
  "Monte Plata",
  "Pedernales",
  "Peravia",
  "Puerto Plata",
  "Samaná",
  "Sánchez Ramírez",
  "San Cristóbal",
  "San José de Ocoa",
  "San Juan",
  "San Pedro de Macorís",
  "Santiago",
  "Santiago Rodríguez",
  "Santo Domingo",
  "Valverde",
] as const;
const text = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min, `Escribe al menos ${min} caracteres.`)
    .max(max, `Máximo ${max} caracteres.`);
export const password = z
  .string()
  .min(10, "Usa al menos 10 caracteres.")
  .max(72)
  .regex(/[a-z]/, "Incluye minúsculas.")
  .regex(/[A-Z]/, "Incluye mayúsculas.")
  .regex(/[0-9]/, "Incluye números.");
export const location = {
  province: z.enum(provinces),
  municipality: text(2, 80),
};
export const profile = z.object({
  name: text(2, 80),
  phone: z
    .string()
    .trim()
    .regex(
      /^(\+1[ -]?)?\(?[0-9]{3}\)?[ -]?[0-9]{3}[ -]?[0-9]{4}$/,
      "Escribe un teléfono válido.",
    ),
  ...location,
  bio: z.string().trim().max(1500).default(""),
  specialty: z.string().trim().max(100).default(""),
  experienceYears: z.coerce.number().int().min(0).max(70).default(0),
  latitude: z.coerce.number().min(-90).max(90).nullable().optional(),
  longitude: z.coerce.number().min(-180).max(180).nullable().optional(),
});
export const registration = profile.extend({
  email: z.email().trim().toLowerCase().max(200),
  password,
  role: z.enum(["CLIENTE", "CONTRATISTA"]),
  consent: z.literal(true, {
    error:
      "Debes aceptar el uso de datos para gestionar tu cuenta y servicios.",
  }),
});
export const credentials = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1).max(72),
});
export const amount = z
  .string()
  .regex(
    /^\d{1,9}(\.\d{1,2})?$/,
    "Usa un monto positivo con hasta dos decimales.",
  )
  .refine((v) => Number(v) > 0, "El monto debe ser positivo.");
export const publication = z.object({
  title: text(5, 100),
  categoryId: text(1, 100),
  description: text(20, 3000),
  ...location,
  basePrice: amount,
  visible: z.boolean(),
});
export const serviceRequest = z.object({
  publicationId: text(1, 100),
  description: text(20, 2000),
  address: text(8, 300),
  ...location,
});
export const appointment = z.object({
  startsAt: z.iso
    .datetime({ offset: true })
    .refine(
      (v) => new Date(v).getTime() > Date.now(),
      "Selecciona una fecha futura.",
    ),
  address: text(8, 300),
  amount,
});
export const review = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: text(10, 1000),
});
export const report = z.object({
  targetId: text(1, 100),
  reason: z.enum([
    "Comportamiento inapropiado",
    "Incumplimiento del acuerdo",
    "Información engañosa",
    "Otro",
  ]),
  detail: text(20, 2000),
});
export const message = z.object({ body: text(1, 2000) });
