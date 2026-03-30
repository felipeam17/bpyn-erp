# BYN Marine Supply ERP — Guía de Instalación y Despliegue

Sistema ERP en la nube para BYN, construido con React + Supabase + Vercel.

---

## Stack Tecnológico

| Capa | Tecnología | Costo |
|------|-----------|-------|
| Frontend | React + Vite | Gratis |
| Base de datos | Supabase (PostgreSQL) | Gratis hasta 500MB |
| Autenticación | Supabase Auth | Gratis hasta 50,000 usuarios |
| Hosting | Vercel | Gratis |

---

## PASO 1 — Configurar Supabase (Base de Datos)

### 1.1 Crear proyecto
1. Ve a [supabase.com](https://supabase.com) → **Start your project**
2. Crea una cuenta (con GitHub o email)
3. Clic en **New Project**
4. Nombre: `byn-erp`
5. Password: elige una contraseña segura y guárdala
6. Region: **US East (N. Virginia)** — la más cercana a Panamá con buen latency
7. Espera ~2 minutos mientras se crea

### 1.2 Crear las tablas
1. En el panel de Supabase, ve a **SQL Editor** (ícono de base de datos en el sidebar)
2. Clic en **New query**
3. Copia y pega todo el contenido de `supabase/migrations/001_initial_schema.sql`
4. Clic en **Run** (▶)
5. Deberías ver: `Success. No rows returned`

### 1.3 Obtener las credenciales
1. Ve a **Settings** → **API**
2. Copia:
   - **Project URL** → esto es tu `VITE_SUPABASE_URL`
   - **anon public** key → esto es tu `VITE_SUPABASE_ANON_KEY`

### 1.4 Crear usuarios (socios y trabajadores)
1. Ve a **Authentication** → **Users** → **Add user**
2. Crea un usuario por cada persona:
   - Email: su email corporativo o personal
   - Password: genera una temporal y se la compartes
   - Clic en **Create user**
3. Repite para cada trabajador (máx 5 usuarios en tu caso)

> **Nota**: Los usuarios NO pueden registrarse solos. Solo tú (admin) puedes crear cuentas desde el panel de Supabase. Esto asegura que solo el equipo BYN tenga acceso.

---

## PASO 2 — Configurar el Proyecto Local

### 2.1 Prerequisitos
- [Node.js](https://nodejs.org) v18 o superior
- Git instalado

### 2.2 Instalar dependencias
```bash
cd byn-erp
npm install
```

### 2.3 Configurar variables de entorno
```bash
# Copia el archivo de ejemplo
cp .env.example .env

# Edita .env con tus credenciales de Supabase
```

Abre `.env` y reemplaza con tus valores reales:
```
VITE_SUPABASE_URL=https://abcdefghijk.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...tu_key_real
```

### 2.4 Probar localmente
```bash
npm run dev
```
Abre [http://localhost:5173](http://localhost:5173)

---

## PASO 3 — Desplegar en Vercel (Producción)

### 3.1 Subir código a GitHub
```bash
# Desde la carpeta byn-erp
git init
git add .
git commit -m "BYN ERP v1.0"

# Crea un repositorio PRIVADO en github.com
# Luego conecta:
git remote add origin https://github.com/TU_USUARIO/byn-erp.git
git push -u origin main
```

### 3.2 Conectar con Vercel
1. Ve a [vercel.com](https://vercel.com) → **Sign up with GitHub**
2. Clic en **Add New Project**
3. Selecciona el repositorio `byn-erp`
4. En **Environment Variables**, agrega:
   - `VITE_SUPABASE_URL` = tu Project URL
   - `VITE_SUPABASE_ANON_KEY` = tu anon key
5. Clic en **Deploy**

Vercel te dará una URL tipo: `https://byn-erp.vercel.app`

### 3.3 Dominio personalizado (opcional)
Si quieres `erp.bynmarine.com`:
1. En Vercel → tu proyecto → **Settings** → **Domains**
2. Agrega tu dominio
3. Configura el DNS según las instrucciones de Vercel

---

## PASO 4 — Importar Productos desde Google Sheets

### Formato requerido de la tabla
Tu Google Sheet debe tener una fila de encabezados. Los nombres exactos no importan, los vas a mapear en el sistema.

**Columnas recomendadas:**
| Nombre | Precio Venta | Categoría | SKU | Stock |
|--------|-------------|-----------|-----|-------|

### Pasos de importación
1. Entra al ERP → **Importar** (sidebar)
2. En Google Sheets: selecciona toda tu tabla (Ctrl+A o manualmente)
3. Ctrl+C para copiar
4. Pega en el campo de texto del ERP
5. El sistema auto-detecta las columnas — verifica el mapeo
6. Revisa el preview
7. Clic en **Importar**

> Los costos puedes dejarlos vacíos en la importación y agregarlos manualmente uno a uno desde el Catálogo conforme revisas las facturas físicas.

---

## Estructura del Proyecto

```
byn-erp/
├── src/
│   ├── lib/
│   │   ├── supabase.js      # Cliente DB + todas las queries
│   │   └── utils.js         # Helpers (fmt, calcMargin, etc.)
│   ├── components/
│   │   └── Layout.jsx       # Sidebar + estructura principal
│   ├── pages/
│   │   ├── Login.jsx        # Autenticación
│   │   ├── Dashboard.jsx    # Vista principal con KPIs
│   │   ├── Catalog.jsx      # Gestión de productos + CRUD
│   │   ├── NewQuote.jsx     # Constructor de cotizaciones
│   │   ├── Quotes.jsx       # Lista + detalle de cotizaciones
│   │   ├── Margins.jsx      # Análisis de márgenes
│   │   └── Import.jsx       # Importador Google Sheets / CSV
│   ├── App.jsx              # Router + AuthContext
│   ├── main.jsx             # Entry point
│   └── index.css            # Estilos globales
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql   # Todo el schema SQL
├── .env.example             # Template de variables de entorno
├── .env                     # TUS credenciales (no subir a GitHub)
├── vite.config.js
└── package.json
```

---

## Flujo de Trabajo Diario

### Agregar un producto nuevo
1. Catálogo → **+ Nuevo Producto**
2. Nombre, precio de venta, categoría (requeridos)
3. Si ya tienes la factura: agrega el costo promedio
4. Si no: déjalo vacío, lo completas después
5. **Guardar**

### Crear una cotización
1. Dashboard → **+ Nueva Cotización** (o desde Quotes)
2. Nombre del yate/cliente
3. Busca productos por nombre o SKU
4. Ajusta cantidades — el precio base se carga automático
5. Si el cliente negoció un precio diferente: edita el precio en el ítem
6. Aplica descuento global si aplica
7. **Guardar Cotización**

### Cargar costos desde facturas físicas
1. Catálogo → busca el producto
2. **Editar**
3. Agrega el **Costo Promedio**
4. El sistema registra el cambio en el historial con fecha y usuario
5. **Guardar**

---

## Seguridad

- Solo usuarios creados manualmente por el admin pueden acceder
- Row Level Security activado en Supabase — los datos no son accesibles sin autenticación
- El repositorio debe ser **privado** en GitHub
- Las variables de entorno (`.env`) nunca se suben a GitHub — están en `.gitignore`

---

## Soporte y Actualizaciones

Para agregar funcionalidades futuras:
- **Exportar cotización a PDF**: agregar librería `jsPDF`
- **Historial de ventas**: nueva tabla `sales` en Supabase
- **Múltiples listas de precios**: columna `price_tier` en products
- **Notificaciones de stock bajo**: Supabase Edge Functions + email

---

*BYN Marine Supply ERP v1.0 — 2025*
