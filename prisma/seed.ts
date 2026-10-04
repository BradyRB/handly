import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
const db = new PrismaClient();
async function main() {
  if (process.env.NODE_ENV === "production")
    throw new Error("La semilla ficticia solo se ejecuta en desarrollo.");
  const passwordHash = await hash("HandlyDemo2026!", 12);
  const categories = [
    ["electricidad", "Electricidad"],
    ["plomeria", "Plomería"],
    ["aire-acondicionado", "Aire acondicionado"],
    ["pintura", "Pintura"],
    ["carpinteria", "Carpintería"],
    ["limpieza", "Limpieza"],
  ];
  for (const [slug, name] of categories)
    await db.serviceCategory.upsert({
      where: { slug },
      create: { id: `cat-${slug}`, slug, name },
      update: {},
    });
  const people = [
    [
      "rafael",
      "Rafael Méndez",
      "Electricidad residencial",
      "Distrito Nacional",
      "Santo Domingo de Guzmán",
      "electricidad",
      "Instalaciones eléctricas y reparaciones",
      "1500",
      18.486,
      -69.934,
      8,
    ],
    [
      "laura",
      "Laura Peña",
      "Plomería y mantenimiento",
      "Santo Domingo",
      "Santo Domingo Este",
      "plomeria",
      "Soluciones de plomería para tu hogar",
      "1200",
      18.488,
      -69.852,
      6,
    ],
    [
      "miguel",
      "Miguel Castillo",
      "Climatización",
      "Distrito Nacional",
      "Santo Domingo de Guzmán",
      "aire-acondicionado",
      "Mantenimiento de aire acondicionado",
      "1800",
      18.47,
      -69.951,
      10,
    ],
    [
      "carmen",
      "Carmen Díaz",
      "Pintura de interiores",
      "Santiago",
      "Santiago de los Caballeros",
      "pintura",
      "Pintura y renovación de espacios",
      "2500",
      19.452,
      -70.689,
      7,
    ],
    [
      "jose",
      "José Rosario",
      "Carpintería a medida",
      "La Vega",
      "Concepción de La Vega",
      "carpinteria",
      "Reparación de muebles y puertas",
      "2000",
      19.221,
      -70.529,
      12,
    ],
    [
      "elena",
      "Elena Vargas",
      "Limpieza residencial",
      "Azua",
      "Azua de Compostela",
      "limpieza",
      "Limpieza profunda de tu hogar",
      "1600",
      18.453,
      -70.735,
      5,
    ],
  ] as const;
  for (const [
    slug,
    name,
    specialty,
    province,
    municipality,
    category,
    title,
    basePrice,
    latitude,
    longitude,
    experienceYears,
  ] of people) {
    await db.user.upsert({
      where: { email: `${slug}@handly.demo` },
      create: {
        id: `demo-${slug}`,
        email: `${slug}@handly.demo`,
        name,
        passwordHash,
        role: "CONTRATISTA",
        phone: "809-555-0100",
        province,
        municipality,
        contractorProfile: {
          create: {
            specialty,
            bio: `Soy ${name}. Trabajo en ${specialty.toLowerCase()} y coordino cada servicio contigo antes de comenzar. Cuéntame lo que necesitas para preparar una propuesta.`,
            experienceYears,
            latitude,
            longitude,
          },
        },
      },
      update: {},
    });
    await db.servicePublication.upsert({
      where: { id: `pub-${slug}` },
      create: {
        id: `pub-${slug}`,
        contractorId: `demo-${slug}`,
        categoryId: `cat-${category}`,
        title,
        description: `Servicio de ${specialty.toLowerCase()} en ${municipality}. Incluye evaluación inicial y una propuesta de trabajo. El precio final depende del alcance y se confirma contigo antes del servicio.`,
        province,
        municipality,
        basePrice,
      },
      update: {},
    });
  }
  for (const [slug, name] of [
    ["ana", "Ana Martínez"],
    ["luis", "Luis Santana"],
    ["sofia", "Sofía Núñez"],
  ]) {
    await db.user.upsert({
      where: { email: `${slug}@handly.demo` },
      create: {
        id: `demo-${slug}`,
        email: `${slug}@handly.demo`,
        name,
        passwordHash,
        role: "CLIENTE",
        phone: "809-555-0120",
        province: "Distrito Nacional",
        municipality: "Santo Domingo de Guzmán",
        clientProfile: { create: {} },
      },
      update: {},
    });
  }
  await db.serviceRequest.upsert({
    where: { id: "demo-request" },
    create: {
      id: "demo-request",
      clientId: "demo-ana",
      contractorId: "demo-rafael",
      publicationId: "pub-rafael",
      serviceTitle: "Instalaciones eléctricas y reparaciones",
      description:
        "Necesito revisar dos tomacorrientes de la sala que dejaron de funcionar y cambiar un interruptor.",
      province: "Distrito Nacional",
      municipality: "Santo Domingo de Guzmán",
      address: "Calle Ejemplo 12, sector de demostración",
      conversation: {
        create: {
          id: "demo-conversation",
          messages: {
            create: {
              senderId: "demo-ana",
              body: "Hola Rafael. Los tomacorrientes de la sala no tienen corriente. ¿Podemos coordinar una revisión?",
            },
          },
        },
      },
    },
    update: {},
  });
  for (const [index, author, rating, comment] of [
    [
      1,
      "luis",
      5,
      "Coordinamos la revisión con claridad y el trabajo quedó bien realizado.",
    ],
    [
      2,
      "sofia",
      4,
      "Buena comunicación durante el servicio y explicación del trabajo realizado.",
    ],
  ] as const) {
    await db.serviceRequest.upsert({
      where: { id: `seed-completed-${index}` },
      create: {
        id: `seed-completed-${index}`,
        clientId: `demo-${author}`,
        contractorId: "demo-rafael",
        publicationId: "pub-rafael",
        serviceTitle: "Revisión eléctrica",
        description:
          "Trabajo histórico ficticio para demostrar el módulo de opiniones.",
        address: "Dirección ficticia de demostración",
        province: "Distrito Nacional",
        municipality: "Santo Domingo de Guzmán",
        status: "COMPLETED",
        payment: {
          create: {
            amount: "1500",
            method: "CASH",
            status: "PAID",
            adapter: "cash",
            paidAt: new Date(),
          },
        },
        review: {
          create: {
            authorId: `demo-${author}`,
            contractorId: "demo-rafael",
            rating,
            comment,
          },
        },
      },
      update: {},
    });
  }
  console.log(
    "Semilla ficticia lista. Cliente: ana@handly.demo | Contratista: rafael@handly.demo | Contraseña: HandlyDemo2026!",
  );
}
main().finally(() => db.$disconnect());
