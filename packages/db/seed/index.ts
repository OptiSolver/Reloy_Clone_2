import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const db = drizzle(pool, { schema });

// Nombres argentinos realistas
const firstNames = ["Martín", "Lucía", "Santiago", "Valentina", "Mateo", "Sofía", "Benjamín", "Isabella", "Joaquín", "Camila", "Tomás", "Emma", "Nicolás", "Catalina", "Felipe", "María", "Agustín", "Abril", "Juan", "Florencia"];
const lastNames = ["García", "Rodríguez", "Fernández", "González", "López", "Martínez", "Sánchez", "Pérez", "Romero", "Gómez", "Álvarez", "Torres", "D'Angelo", "Ruiz", "Díaz", "Moreno", "Castro", "Silva", "Ramos", "Vargas"];

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate(daysAgo: number): Date {
  const now = new Date();
  const past = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  return new Date(past.getTime() + Math.random() * daysAgo * 24 * 60 * 60 * 1000);
}

async function main() {
  console.log("🌱 Iniciando seed enriquecido...");

  // 1. Limpiar DB
  console.log("🧹 Limpiando tablas...");
  await db.delete(schema.events);
  await db.delete(schema.pointsLedger);
  await db.delete(schema.missionProgress);
  await db.delete(schema.missions);
  await db.delete(schema.rewardRedemptions);
  await db.delete(schema.rewards);
  await db.delete(schema.memberships);
  await db.delete(schema.merchantSettings);
  await db.delete(schema.customerIdentifiers);
  await db.delete(schema.staff);
  await db.delete(schema.branches);
  await db.delete(schema.merchants);
  await db.delete(schema.owners);
  await db.delete(schema.customers);

  console.log("✅ Datos antiguos eliminados.");

  // 2. Crear Owner
  console.log("👤 Creando Owner...");
  const [owner] = await db.insert(schema.owners).values({
    id: "440e8400-e29b-41d4-a716-446655440000",
    firstName: "Luka",
    lastName: "Propietario",
    accountType: "owner",
    status: "active",
  }).returning();

  // 3. Crear Merchant
  console.log("🏪 Creando Merchant...");
  const [merchant] = await db.insert(schema.merchants).values({
    id: "550e8400-e29b-41d4-a716-446655440000",
    ownerId: owner.id,
    name: "Cafetería LOOP Buenos Aires",
    isActive: true,
  }).returning();

  // 4. Configurar Merchant Settings
  console.log("⚙️  Creando configuración del Merchant...");
  await db.insert(schema.merchantSettings).values({
    merchantId: merchant.id,
    industry: "cafe",
    visitMode: "single",
    config: {
      "pointsPerVisit": 100
    }
  });

  // 5. Crear Branches
  console.log("🏢 Creando sucursales...");
  const branchNames = ["Sucursal Palermo", "Sucursal Recoleta", "Sucursal Belgrano"];
  const branches = [];
  for (const name of branchNames) {
    const [branch] = await db.insert(schema.branches).values({
      merchantId: merchant.id,
      name,
    }).returning();
    branches.push(branch);
  }

  // 6. Crear Staff (varios empleados)
  console.log("👷 Creando personal...");
  const staffNames = ["Juan Barista", "María Cajera", "Pedro Gerente", "Laura Mesera", "Carlos Cocinero"];
  const staffMembers = [];
  for (const name of staffNames) {
    const [staff] = await db.insert(schema.staff).values({
      branchId: randomElement(branches).id,
      fullName: name,
      role: "admin",
      isActive: true,
    }).returning();
    staffMembers.push(staff);
  }

  // 7. Crear múltiples Customers (30 clientes)
  console.log("🧍 Creando 30 clientes...");
  const customers = [];
  for (let i = 0; i < 30; i++) {
    const [customer] = await db.insert(schema.customers).values({}).returning();
    customers.push(customer);

    // Identificadores
    const firstName = randomElement(firstNames);
    const lastName = randomElement(lastNames);
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@email.com`;
    const phone = `+549${randomInt(1100000000, 1199999999)}`;

    await db.insert(schema.customerIdentifiers).values({
      customerId: customer.id,
      type: "email",
      valueRaw: email,
      valueNormalized: email.toLowerCase(),
      isPrimary: true,
    });

    await db.insert(schema.customerIdentifiers).values({
      customerId: customer.id,
      type: "phone",
      valueRaw: phone,
      valueNormalized: phone,
      isPrimary: false,
    });

    // Membership con balance variable
    const pointsBalance = randomInt(0, 2000);
    await db.insert(schema.memberships).values({
      merchantId: merchant.id,
      customerId: customer.id,
      pointsBalance,
      status: "active",
    });
  }

  // 8. Crear Rewards (catálogo enriquecido)
  console.log("🎁 Creando recompensas...");
  await db.insert(schema.rewards).values([
    {
      merchantId: merchant.id,
      title: "Café Espresso Gratis",
      description: "Un café espresso a elección",
      pointsCost: 500,
      isActive: true,
    },
    {
      merchantId: merchant.id,
      title: "Medialuna de Manteca",
      description: "Medialuna recién horneada",
      pointsCost: 300,
      isActive: true,
    },
    {
      merchantId: merchant.id,
      title: "Tostado Completo",
      description: "Tostado de jamón y queso",
      pointsCost: 800,
      isActive: true,
    },
    {
      merchantId: merchant.id,
      title: "Alfajor Artesanal",
      description: "Alfajor de dulce de leche",
      pointsCost: 400,
      isActive: true,
    },
    {
      merchantId: merchant.id,
      title: "10% Descuento",
      description: "Descuento en cualquier compra",
      pointsCost: 1000,
      isActive: true,
    },
  ]);

  // 9. Crear eventos (visitas) - 150 eventos en los últimos 30 días
  console.log("🎉 Creando 150 eventos...");
  const eventTypes = ["visit", "visit", "visit", "visit", "purchase"]; // Más visitas que compras
  for (let i = 0; i < 150; i++) {
    await db.insert(schema.events).values({
      merchantId: merchant.id,
      branchId: randomElement(branches).id,
      customerId: randomElement(customers).id,
      staffId: randomElement(staffMembers).id,
      type: randomElement(eventTypes),
      payload: { notes: `Evento generado automáticamente #${i + 1}` },
      occurredAt: randomDate(30),
    });
  }

  console.log("✅ Seed enriquecido completado exitosamente!");
  console.log({
    ownerId: owner.id,
    merchantId: merchant.id,
    branches: branches.length,
    staff: staffMembers.length,
    customers: customers.length,
    events: 150,
  });

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Seed falló!");
  console.error(err);
  process.exit(1);
});
