# 📸 Instagram Scraper - Extractor de Datos de Publicaciones

Un script automatizado en Node.js que realiza **web scraping** de Instagram para extraer información detallada de publicaciones, comentarios y personas que han dado "like" a las publicaciones de un usuario específico.

---

## 🎯 Funcionalidades

### ✅ Autenticación Automática
- Login automático en Instagram usando credenciales de usuario
- Detección robusta de formularios de login (múltiples versiones de UI)
- Comportamiento humanizado para evitar bloqueos (delays aleatorios, movimiento de mouse)

### 📝 Extracción de Información de Publicaciones
El script extrae las **5 publicaciones más recientes** de un perfil objetivo con los siguientes datos:

| Dato | Descripción |
|------|-------------|
| **URL** | Enlace directo a la publicación |
| **Descripción** | Texto de la publicación |
| **Fecha** | Fecha y hora de la publicación |
| **Cantidad de Likes** | Número total de likes |
| **Personas que dieron Like** | Lista de usuarios que han dado like |
| **Comentarios** | Comentarios visibles en la publicación |

### 💬 Extracción de Comentarios
- Carga automática de todos los comentarios disponibles
- Extrae respuestas a comentarios
- Integración de comentarios capturados por DOM y API GraphQL
- Deduplicación automática de comentarios

### 👥 Extracción de Likers
- Abre el modal de likes automáticamente
- Scrollea inteligentemente para cargar todos los perfiles
- Detección de cuando se ha alcanzado el final
- Combina datos del DOM, API GraphQL y enlaces de perfil
- Limitado a un máximo de 500 likers por seguridad

### 📊 Generación de Reportes
- Exporta datos a **CSV** (`reporte_publicaciones.csv`)
- Formato limpio con columnas estructuradas
- Información de todos los campos en filas organizadas

---

## 🛠️ Requisitos Previos

- **Node.js** v14 o superior
- **npm** para instalar dependencias
- Credenciales de Instagram válidas

---

## 📦 Instalación

1. **Clonar o descargar el proyecto:**
```bash
git clone <repository-url>
cd ig_scraping
```

2. **Instalar dependencias:**
```bash
npm install
```

3. **Crear archivo `.env` con credenciales:**
```bash
YOUR_USERNAME=tu_usuario_instagram
YOUR_PASSWORD=tu_contraseña_instagram
TARGET_USERNAME=usuario_a_scrapear
```

---

## 🚀 Uso

Ejecutar el script:
```bash
node ig_scraper.js
```

### Proceso Automatizado:
1. ✅ Se autentica en Instagram
2. ✅ Navega al perfil objetivo
3. ✅ Extrae los enlaces de las 5 publicaciones más recientes
4. ✅ Para cada publicación:
   - 📌 Carga todos los comentarios disponibles
   - 👍 Abre el modal de likes y extrae perfiles
   - 📊 Guarda información en memoria
5. ✅ Genera reporte CSV
6. ✅ Cierra el navegador

---

## ⚙️ Configuración

Dentro del archivo `ig_scraper.js`, puedes ajustar estos parámetros:

```javascript
const MAX_POSTS = 5;                    // Número de publicaciones a extraer
const MAX_COMMENTS_PER_POST = 100;      // Límite de comentarios por publicación
const MAX_LIKERS_PER_POST = 500;        // Límite de likers por publicación
```

---

## 📋 Dependencias

| Paquete | Versión | Propósito |
|---------|---------|----------|
| **puppeteer** | ^24.30.0 | Automatización del navegador |
| **json2csv** | ^6.0.0-alpha.2 | Conversión de datos a CSV |
| **dotenv** | ^16.0.0 | Gestión de variables de entorno |

---

## 📤 Salida

### Archivo: `reporte_publicaciones.csv`

El script genera un archivo CSV con las siguientes columnas:

- **Publicacion**: Número de la publicación (1-5)
- **URL**: Enlace a la publicación en Instagram
- **Descripcion**: Texto de la publicación
- **Fecha**: Fecha y hora de la publicación
- **Cantidad de likes**: Número total de likes
- **Personas que dieron like**: Usernames de personas que dieron like (separados por `|`)
- **Comentarios**: Texto de comentarios con usuario (formato: `usuario: comentario`, separados por `|`)

---

## 🔒 Consideraciones de Seguridad

⚠️ **IMPORTANTE:**
- Las credenciales se almacenan en `.env` (no incluir en repositorio)
- El archivo `.gitignore` está configurado para ignorar archivos sensibles
- El script añade retrasos para simular comportamiento humano
- Instagram puede bloquear o limitar la actividad si detecta automatización

---

## ⚡ Características Técnicas

### Comportamiento Humanizado
- Movimientos aleatorios del mouse
- Scrolleos con velocidad variable
- Delays aleatorios entre acciones
- User-Agent realista

### Robustez
- Múltiples selectores CSS para diferentes versiones de UI
- Reintentos automáticos si los elementos no se encuentran
- Manejo de diálogos y pop-ups
- Fallbacks para extracción de datos

### Integración con APIs
- Interceptación de respuestas GraphQL de Instagram
- Captura de datos de likers y comentarios desde API
- Combinación de datos del DOM y API para máxima precisión

---

## 🐛 Solución de Problemas

### Error: "Author identity unknown"
- Ejecutar: `git config --global user.name "Tu Nombre"`
- Ejecutar: `git config --global user.email "tu@email.com"`

### Instagram detecta automatización
- Aumentar los valores de `delay()`
- Esperar unas horas antes de intentar nuevamente
- Verificar que las credenciales sean correctas

### No se extraen comentarios o likes
- Instagram puede haber cambiado su UI
- Verificar selectores CSS en las herramientas de desarrollador
- Actualizar selectores en el código

---

## 📝 Notas

- El script simula comportamiento humano pero puede ser detectado por Instagram
- Respetar los términos de servicio de Instagram
- Usar solo para propósitos educativos o de investigación
- No compartir credenciales de terceros

---

## 📄 Licencia

ISC

---

**Desarrollado con ❤️ | Última actualización: 2026**