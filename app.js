// ============================================
// 1) IndexedDB: abrir base de datos
// ============================================
const DB_NOMBRE = "usuariosDB";
const DB_VERSION = 1;
const STORE = "usuarios";

function abrirDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NOMBRE, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Guardar un usuario en IndexedDB
function guardarUsuario(db, usuario) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(usuario);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Leer todos los usuarios guardados en IndexedDB
function leerUsuarios(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ============================================
// 2) Fetch API: obtener datos de la API
// ============================================
const API_URL = "https://jsonplaceholder.typicode.com/users";

async function obtenerUsuariosAPI() {
  const respuesta = await fetch(API_URL);
  if (!respuesta.ok) {
    throw new Error("La API respondió con error " + respuesta.status);
  }
  return await respuesta.json();
}

// ============================================
// 3) Sincronización: API -> IndexedDB
// ============================================
async function sincronizar(db) {
  mostrarEstado("Sincronizando con la API...", "");

  try {
    const datos = await obtenerUsuariosAPI();

    // Guardamos cada usuario de la API en IndexedDB
    for (const usuario of datos) {
      await guardarUsuario(db, {
        id: usuario.id,
        nombre: usuario.name,
        email: usuario.email,
        origen: "api"
      });
    }

    mostrarEstado("Sincronización correcta: " + datos.length + " usuarios desde la API.", "online");
    await mostrarUsuarios(db);
  } catch (error) {
    // Si falla la API, se muestran los datos guardados localmente
    mostrarEstado("Sin conexión con la API. Se muestran los datos guardados localmente.", "offline");
    await mostrarUsuarios(db);
  }
}

// ============================================
// 4) Mostrar los datos en la pagina
// ============================================
async function mostrarUsuarios(db) {
  const usuarios = await leerUsuarios(db);
  const lista = document.getElementById("lista");

  lista.innerHTML = "";

  if (usuarios.length === 0) {
    const vacio = document.createElement("li");
    vacio.className = "vacio";
    vacio.textContent = "No hay datos guardados.";
    lista.appendChild(vacio);
    return;
  }

  usuarios.forEach((usuario) => {
    const item = document.createElement("li");

    const avatar = document.createElement("span");
    avatar.className = "avatar";
    avatar.textContent = (usuario.nombre || "?").trim().charAt(0);

    const datos = document.createElement("div");
    datos.className = "datos";

    const nombre = document.createElement("strong");
    nombre.textContent = usuario.nombre;

    const email = document.createElement("span");
    email.className = "email";
    email.textContent = usuario.email;

    const origen = document.createElement("span");
    origen.className = "local";
    origen.dataset.origen = usuario.origen;
    origen.textContent = usuario.origen;

    datos.append(nombre, email, origen);
    item.append(avatar, datos);
    lista.appendChild(item);
  });
}

// Mostrar mensaje de estado
function mostrarEstado(texto, tipo) {
  const estado = document.getElementById("estado");
  estado.textContent = texto;
  estado.className = tipo;
}

// ============================================
// 5) Ingreso manual de datos -> IndexedDB
// ============================================
function iniciarFormulario(db) {
  document.getElementById("formulario").addEventListener("submit", async (evento) => {
    evento.preventDefault();

    const nombre = document.getElementById("nombre").value;
    const email = document.getElementById("email").value;

    // id negativo para no chocar con los ids de la API
    await guardarUsuario(db, {
      id: "local-" + Date.now(),
      nombre: nombre,
      email: email,
      origen: "local"
    });

    document.getElementById("formulario").reset();
    mostrarEstado("Usuario guardado en IndexedDB.", "online");
    await mostrarUsuarios(db);
  });
}

// ============================================
// Inicio de la aplicacion
// ============================================
async function iniciar() {
  const db = await abrirDB();

  document.getElementById("btn-sincronizar").addEventListener("click", () => sincronizar(db));
  iniciarFormulario(db);

  // Al cargar, se intenta sincronizar; si falla se usan los datos locales
  await sincronizar(db);
}

iniciar();