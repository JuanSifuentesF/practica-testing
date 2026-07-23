# Beneficios GitHub Student Developer Pack — Inventario para ISTQB Study Agent

**Uso del documento:** este archivo funciona como inventario de beneficios disponibles. La decisión operativa de hosting, dominio, DNS, SSL y despliegue vive en [Plan de Hosting, Dominio y Producción](hosting_domain_plan.md).

**Criterio de selección:** no activar un servicio solo porque sea gratuito. Se prioriza lo que reduzca costo, riesgo o fricción para el despliegue real del proyecto.

## Prioridad Para Este Proyecto

| Prioridad | Beneficio | Decisión | Motivo |
|---|---|---|---|
| Alta | Heroku | Evaluar para FastAPI | Es el destino futuro elegido; confirmar oferta, límites y costos vigentes antes de PR-02. |
| Alta | Name.com | Recomendado para dominio principal | Permite elegir dominios como `.app`, `.dev` o `.studio`, más adecuados para una web app. |
| Alta | Vercel | Usar para Next.js | Deploy automático, dominio custom y SSL gestionado. |
| Alta | Supabase | Usar para DB/Auth/Storage | Ya es parte del stack confirmado. |
| Media | Namecheap | Fallback para dominio `.me` | Útil si se prefiere marca personal; el certificado SSL extra no es crítico porque Vercel lo gestiona. |
| Media | GitHub Actions | Usar en producción | Automatiza CI/CD y mantiene trazabilidad de despliegues. |
| Media | Sentry / Codecov | Considerar después del MVP | Útiles para monitoreo y calidad cuando la app esté estable. |
| Media | DigitalOcean | Conservar como hosting histórico | BE-06 sigue desplegado allí, pero no es el destino futuro. |
| Baja | Azure / MongoDB / Clerk / Appwrite | No usar en MVP | Duplican decisiones ya tomadas para infraestructura, datos y auth. |

## Inventario General

> **Snapshot histórico:** montos, duración y disponibilidad pueden cambiar. No
> presupuestar ni elegir plan sin comprobar la oferta oficial vigente.

### ☁️ Nube e Infraestructura
* **DigitalOcean:** crédito estudiantil histórico; verificar monto y vigencia.
* **Heroku:** crédito estudiantil histórico; verificar monto, duración y planes elegibles.
* **Microsoft Azure:** crédito estudiantil histórico; verificar oferta vigente.
* **LocalStack:** Licencia gratuita para el emulador local de AWS.
* **GitHub Pages:** Alojamiento gratuito para sitios web de proyectos.

### 🗄️ Bases de Datos y Backend
* **MongoDB:** $50 en créditos para Atlas (nube) y certificación gratuita valorada en $150.
* **Clerk:** Plan Pro gratuito para añadir autenticación y gestión de usuarios.
* **Appwrite:** Plan Education gratuito (con límites equivalentes al plan Pro de $40/mes).
* **PopSQL:** Suscripción Premium gratuita al editor SQL colaborativo.
* **SQLGate:** Acceso a funciones de la suscripción estándar por 1 año.
* **Zyte (Scrapinghub):** 1 unidad Scrapy Cloud gratuita de por vida para web scraping.
* **Blockchair:** 100,000 solicitudes gratuitas a sus APIs de blockchain.
* **Testmail:** Plan Essential gratuito para pruebas automatizadas de correo.

### 🌐 Dominios y SSL
* **Name.com:** 1 dominio gratuito a elegir (extensiones como .dev, .app, .studio).
* **Namecheap:** 1 dominio `.me` gratuito y 1 certificado SSL gratis por 1 año.
* **.TECH:** 1 dominio `.tech` gratuito por 1 año.

### 🔒 Seguridad y Configuración
* **Doppler:** Suscripción Team gratuita para gestionar variables de entorno y secretos.
* **DevCycle:** 1 año gratis en el Plan Starter para Feature Flags.
* **ConfigCat:** 1000 Feature Flags y usuarios ilimitados gratis.
* **1Password:** 1 año gratuito del gestor de contraseñas (incluye Developer Tools).
* **Dashlane:** 6 meses gratuitos del plan Premium.
* **AstraSecurity:** 6 meses de acceso al firewall y escáner de malware.

### 💻 IDEs y Herramientas de Código
* **JetBrains:** Suscripción anual gratuita a toda su suite de IDEs profesionales (IntelliJ, WebStorm, etc.).
* **GitHub Pro / Codespaces:** Acceso nivel Pro gratuito a la plataforma y a entornos de desarrollo en la nube.
* **GitKraken & GitLens:** 6 meses gratuitos del plan Student (cliente Git visual y extensión de VS Code).
* **Tower:** Licencia Pro gratuita del cliente Git para escritorio.
* **Termius:** Acceso gratuito a las funciones Pro/Team del cliente SSH.
* **WorkingCopy:** Funciones Pro gratuitas en este cliente Git para iOS.
* **Imgbot:** Optimización automática de imágenes gratuita para todos tus repositorios.

### 📊 Monitoreo, Testing y QA
* **Sentry:** Plan Team gratis (50K errores y 100K transacciones/mes) para rastrear bugs.
* **Datadog:** Cuenta Pro gratuita por 2 años (monitoreo de hasta 10 servidores).
* **New Relic:** Acceso gratuito a la plataforma de observabilidad ($300/mes de valor).
* **LambdaTest:** 1 año de Plan Live gratuito para pruebas en navegadores reales.
* **BrowserStack:** 1 año del plan Automate Mobile para pruebas automatizadas.
* **Codecov:** Acceso gratuito para métricas de cobertura de código en repositorios.
* **CodeScene:** Cuenta gratuita para analizar deuda técnica en repositorios privados.
* **Honeybadger:** Cuenta Small gratuita por 1 año para monitoreo de errores y uptime.
* **Blackfire:** Suscripción Developer gratuita para perfiles de rendimiento de código.

### 🎨 Frontend y Diseño
* **Bootstrap Studio:** Licencia gratuita de la aplicación de escritorio.
* **Polypane:** 1 año gratuito del navegador especializado para desarrollo responsivo.
* **ToDiagram:** Plan Pro gratuito para crear diagramas desde código (JSON, YAML, etc.).
* **IconScout:** 60 iconos premium gratis al mes por 1 año.
* **Icons8:** 3 meses de suscripción gratis (iconos, fotos, música).
* **Visme:** 3 meses gratuitos del plan Starter para presentaciones y UI.
* **Pageclip:** Plan básico gratuito para gestionar formularios HTML sin backend.

### 📚 Cursos y Aprendizaje
* **FrontendMasters:** 6 meses gratuitos de cursos de JavaScript y Frontend.
* **Boot.dev:** 3 meses gratuitos de cursos de Backend (Go, Python, DBs).
* **Educative:** 6 meses gratuitos de acceso a más de 70 cursos interactivos.
* **Scrimba:** 1 mes de acceso gratuito a cursos Pro interactivos.
* **DataCamp:** 3 meses gratuitos para cursos de ciencia de datos y SQL.
* **Codedex:** 6 meses del plan premium para aprender a programar.
* **GoRails:** 12 meses gratuitos de tutoriales en video (Ruby, Rails, JS).
* **SymfonyCasts:** 3 meses gratuitos para aprender PHP y Symfony.
* **AlgoExpert / InterviewCake:** Acceso a preguntas premium y cursos para preparar entrevistas técnicas.

### 🚀 Productividad y Organización
* **Notion:** Plan Education gratuito (incluye funciones del plan Plus, historial extendido y respuestas de IA).
* **Microsoft 365:** Acceso gratuito a herramientas de ofimática y 1TB de almacenamiento en la nube.
* **PomoDone:** 2 años gratuitos del plan Lite para gestionar tu tiempo.
* **SlideCoach:** 2,000 créditos gratuitos (40 sesiones) para practicar presentaciones con feedback de IA.
