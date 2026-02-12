export default function DevHubPage() {
  const items = [
    { name: "WEB (este)", url: "http://localhost:3000" },
    { name: "LANDING", url: "http://localhost:3001" },
    { name: "OWNER", url: "http://localhost:3002" },
    { name: "STAFF", url: "http://localhost:3003" },
    { name: "CLIENT", url: "http://localhost:3004" },
  ];

  return (
    <main style={{ padding: 24, fontFamily: "ui-sans-serif, system-ui" }}>
      <h1 style={{ fontSize: 28, marginBottom: 12 }}>Dev Hub</h1>
      <p style={{ opacity: 0.8, marginBottom: 20 }}>
        Accesos rápidos a todos los proyectos levantados en paralelo.
      </p>

      <div style={{ display: "grid", gap: 12, maxWidth: 520 }}>
        {items.map((x) => (
          <a
            key={x.url}
            href={x.url}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: 14,
              border: "1px solid rgba(0,0,0,0.12)",
              borderRadius: 12,
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <span style={{ fontWeight: 600 }}>{x.name}</span>
            <span style={{ opacity: 0.7 }}>{x.url}</span>
          </a>
        ))}
      </div>
    </main>
  );
}
