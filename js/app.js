/* ============================================
   VACITOPLASTICO POS - LÓGICA PRINCIPAL
   ============================================ */

// --- BASE DE DATOS LOCAL (IndexedDB simulada con localStorage) ---
const DB_KEY = 'vacitoplastico_db';

function cargarDB() {
  const datos = localStorage.getItem(DB_KEY);
  if (datos) return JSON.parse(datos);
  // Productos iniciales de ejemplo
  return {
    productos: [
      { id: 1, nombre: 'Refresco Coca Cola', precio: 250, costo: 200, stock: 24, categoria: 'bebidas', codigo: '', emoji: '🥤' },
      { id: 2, nombre: 'Agua Cristal', precio: 100, costo: 70, stock: 48, categoria: 'bebidas', codigo: '', emoji: '💧' },
      { id: 3, nombre: 'Cerveza Bucanero', precio: 350, costo: 280, stock: 12, categoria: 'bebidas', codigo: '', emoji: '🍺' },
      { id: 4, nombre: 'Jugo Natural', precio: 150, costo: 100, stock: 10, categoria: 'bebidas', codigo: '', emoji: '🧃' },
      { id: 5, nombre: 'Pan Suave', precio: 80, costo: 50, stock: 30, categoria: 'alimentos', codigo: '', emoji: '🍞' },
      { id: 6, nombre: 'Arroz (1 lb)', precio: 200, costo: 160, stock: 50, categoria: 'alimentos', codigo: '', emoji: '🍚' },
      { id: 7, nombre: 'Aceite', precio: 500, costo: 400, stock: 15, categoria: 'alimentos', codigo: '', emoji: '🫗' },
      { id: 8, nombre: 'Café Molido', precio: 300, costo: 220, stock: 20, categoria: 'alimentos', codigo: '', emoji: '☕' },
      { id: 9, nombre: 'Detergente', precio: 180, costo: 130, stock: 18, categoria: 'limpieza', codigo: '', emoji: '🧴' },
      { id: 10, nombre: 'Jabón de Baño', precio: 120, costo: 80, stock: 25, categoria: 'limpieza', codigo: '', emoji: '🧼' },
      { id: 11, nombre: 'Pasta Dental', precio: 200, costo: 150, stock: 8, categoria: 'limpieza', codigo: '', emoji: '🪥' },
      { id: 12, nombre: 'Papel Higiénico', precio: 250, costo: 190, stock: 3, categoria: 'limpieza', codigo: '', emoji: '🧻' },
      { id: 13, nombre: 'Velas', precio: 100, costo: 60, stock: 40, categoria: 'varios', codigo: '', emoji: '🕯️' },
      { id: 14, nombre: 'Fósforos', precio: 30, costo: 15, stock: 50, categoria: 'varios', codigo: '', emoji: '🔥' },
      { id: 15, nombre: 'Pilas AA (par)', precio: 200, costo: 140, stock: 20, categoria: 'varios', codigo: '', emoji: '🔋' }
    ],
    ventas: [],
    siguienteId: 16
  };
}

function guardarDB(db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

let db = cargarDB();
let carrito = [];

// --- ELEMENTOS DEL DOM ---
const $grid = document.getElementById('productosGrid');
const $carritoItems = document.getElementById('carritoItems');
const $carritoVacio = document.getElementById('carritoVacio');
const $subtotal = document.getElementById('subtotal');
const $descuento = document.getElementById('descuento');
const $total = document.getElementById('total');
const $buscador = document.getElementById('buscador');
const $categoria = document.getElementById('selectorCategoria');
const $fechaHora = document.getElementById('fechaHora');

// --- FUNCIONES DE RENDERIZADO ---

function renderizarProductos() {
  const busqueda = $buscador.value.toLowerCase();
  const cat = $categoria.value;

  const filtrados = db.productos.filter(p => {
    const coincideNombre = p.nombre.toLowerCase().includes(busqueda);
    const coincideCat = cat === 'todos' || p.categoria === cat;
    return coincideNombre && coincideCat;
  });

  if (filtrados.length === 0) {
    $grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--texto-secundario)">No se encontraron productos</div>';
    return;
  }

  $grid.innerHTML = filtrados.map(p => `
    <div class="producto-card ${p.stock <= 0 ? 'sin-stock' : ''}" onclick="agregarAlCarrito(${p.id})">
      <div class="producto-emoji">${p.emoji || '📦'}</div>
      <div class="producto-nombre">${p.nombre}</div>
      <div class="producto-precio">$${p.precio.toFixed(2)}</div>
      <div class="producto-stock ${p.stock <= 5 ? 'bajo' : ''}">
        Stock: ${p.stock}
      </div>
    </div>
  `).join('');
}

function renderizarCarrito() {
  if (carrito.length === 0) {
    $carritoItems.innerHTML = `
      <div class="carrito-vacio">
        <span class="vacio-icon">🛒</span>
        <p>Agrega productos para comenzar</p>
      </div>`;
    actualizarTotales();
    return;
  }

  $carritoItems.innerHTML = carrito.map(item => `
    <div class="carrito-item">
      <div class="carrito-item-info">
        <div class="carrito-item-nombre">${item.nombre}</div>
        <div class="carrito-item-precio">$${item.precio.toFixed(2)} c/u</div>
      </div>
      <div class="carrito-item-controles">
        <button class="btn-cantidad menos" onclick="cambiarCantidad(${item.id}, -1)">−</button>
        <span class="cantidad-num">${item.cantidad}</span>
        <button class="btn-cantidad" onclick="cambiarCantidad(${item.id}, 1)">+</button>
      </div>
      <div class="carrito-item-total">$${(item.precio * item.cantidad).toFixed(2)}</div>
    </div>
  `).join('');

  actualizarTotales();
}

function actualizarTotales() {
  const subtotal = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
  $subtotal.textContent = `$${subtotal.toFixed(2)}`;
  $descuento.textContent = `$0.00`;
  $total.textContent = `$${subtotal.toFixed(2)}`;
}

// --- FUNCIONES DE ACCIÓN ---

function agregarAlCarrito(id) {
  const producto = db.productos.find(p => p.id === id);
  if (!producto || producto.stock <= 0) return;

  const existente = carrito.find(item => item.id === id);
  if (existente) {
    if (existente.cantidad >= producto.stock) {
      notificar('No hay más stock disponible', 'error');
      return;
    }
    existente.cantidad++;
  } else {
    carrito.push({
      id: producto.id,
      nombre: producto.nombre,
      precio: producto.precio,
      cantidad: 1
    });
  }

  renderizarCarrito();
  notificar(`${producto.nombre} agregado`);
}

function cambiarCantidad(id, cambio) {
  const item = carrito.find(i => i.id === id);
  if (!item) return;

  const producto = db.productos.find(p => p.id === id);

  if (cambio > 0 && item.cantidad >= producto.stock) {
    notificar('Stock insuficiente', 'error');
    return;
  }

  item.cantidad += cambio;
  if (item.cantidad <= 0) {
    carrito = carrito.filter(i => i.id !== id);
  }

  renderizarCarrito();
}

function limpiarCarrito() {
  if (carrito.length === 0) return;
  if (confirm('¿Limpiar toda la venta actual?')) {
    carrito = [];
    renderizarCarrito();
  }
}

function finalizarVenta() {
  if (carrito.length === 0) {
    notificar('El carrito está vacío', 'error');
    return;
  }

  const metodo = document.getElementById('metodoPago').value;
  const subtotal = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);

  // Registrar la venta
  const venta = {
    id: Date.now(),
    fecha: new Date().toISOString(),
    items: [...carrito],
    total: subtotal,
    metodo: metodo,
    numero: db.ventas.length + 1
  };

  // Actualizar stock
  carrito.forEach(item => {
    const producto = db.productos.find(p => p.id === item.id);
    if (producto) {
      producto.stock -= item.cantidad;
    }
  });

  db.ventas.push(venta);
  guardarDB(db);

  // Mostrar modal de éxito
  const metodosNombres = {
    'efectivo_cup': '💵 Efectivo CUP',
    'efectivo_usd': '💲 Efectivo USD',
    'transfermovil': '📱 Transfermóvil',
    'enzona': '📱 EnZona',
    'tarjeta': '💳 Tarjeta',
    'fiao': '📝 Fiao (Crédito)'
  };

  document.getElementById('exitoTotal').textContent = `$${subtotal.toFixed(2)} CUP`;
  document.getElementById('exitoMetodo').textContent = metodosNombres[metodo] || metodo;
  document.getElementById('exitoItems').innerHTML = venta.items.map(item =>
    `<div class="exito-item-line">
      <span>${item.cantidad}x ${item.nombre}</span>
      <span>$${(item.precio * item.cantidad).toFixed(2)}</span>
    </div>`
  ).join('');

  document.getElementById('modalVenta').classList.add('activo');

  // Limpiar carrito
  carrito = [];
  renderizarCarrito();
  renderizarProductos();

  notificar(`Venta #${venta.numero} registrada exitosamente`);
}

function agregarProducto(datos) {
  const emojis = {
    'bebidas': '🥤',
    'alimentos': '🍞',
    'limpieza': '🧹',
    'varios': '📦'
  };

  const nuevo = {
    id: db.siguienteId++,
    nombre: datos.nombre,
    precio: parseFloat(datos.precio),
    costo: parseFloat(datos.costo) || 0,
    stock: parseInt(datos.stock) || 0,
    categoria: datos.categoria,
    codigo: datos.codigo || '',
    emoji: emojis[datos.categoria] || '📦'
  };

  db.productos.push(nuevo);
  guardarDB(db);
  renderizarProductos();
  notificar(`"${nuevo.nombre}" agregado al catálogo`);
}

// --- NOTIFICACIONES ---

function notificar(mensaje, tipo = 'exito') {
  const contenedor = document.getElementById('notificaciones');
  const notif = document.createElement('div');
  notif.className = `notificacion ${tipo}`;
  notif.textContent = mensaje;
  contenedor.appendChild(notif);

  setTimeout(() => {
    notif.style.opacity = '0';
    notif.style.transform = 'translateX(100px)';
    notif.style.transition = 'all 0.3s';
    setTimeout(() => notif.remove(), 300);
  }, 2500);
}

// --- RELOJ ---

function actualizarReloj() {
  const ahora = new Date();
  const opciones = { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' };
  $fechaHora.textContent = ahora.toLocaleDateString('es-CU', opciones);
}

// --- TEMA OSCURO ---

function alternarTema() {
  const actual = document.documentElement.getAttribute('data-tema');
  const nuevo = actual === 'oscuro' ? 'claro' : 'oscuro';
  document.documentElement.setAttribute('data-tema', nuevo);
  document.getElementById('btnTema').textContent = nuevo === 'oscuro' ? '☀️' : '🌙';
  localStorage.setItem('vacitoplastico_tema', nuevo);
}

// --- PANTALLA COMPLETA ---

function pantallaCompleta() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen();
  }
}

// --- EVENT LISTENERS ---

document.addEventListener('DOMContentLoaded', () => {
  // Render inicial
  renderizarProductos();
  renderizarCarrito();
  actualizarReloj();
  setInterval(actualizarReloj, 30000);

  // Cargar tema guardado
  const temaGuardado = localStorage.getItem('vacitoplastico_tema');
  if (temaGuardado === 'oscuro') {
    document.documentElement.setAttribute('data-tema', 'oscuro');
    document.getElementById('btnTema').textContent = '☀️';
  }

  // Buscador y filtro
  $buscador.addEventListener('input', renderizarProductos);
  $categoria.addEventListener('change', renderizarProductos);

  // Botones del header
  document.getElementById('btnTema').addEventListener('click', alternarTema);
  document.getElementById('btnPantallaCompleta').addEventListener('click', pantallaCompleta);

  // Carrito
  document.getElementById('btnLimpiarCarrito').addEventListener('click', limpiarCarrito);
  document.getElementById('btnVender').addEventListener('click', finalizarVenta);
  document.getElementById('btnGuardar').addEventListener('click', finalizarVenta);

  // Modal producto
  document.getElementById('btnNuevoProducto').addEventListener('click', () => {
    document.getElementById('modalProducto').classList.add('activo');
  });

  document.getElementById('btnCerrarModal').addEventListener('click', () => {
    document.getElementById('modalProducto').classList.remove('activo');
  });

  document.getElementById('formProducto').addEventListener('submit', (e) => {
    e.preventDefault();
    agregarProducto({
      nombre: document.getElementById('prodNombre').value,
      precio: document.getElementById('prodPrecio').value,
      costo: document.getElementById('prodCosto').value,
      stock: document.getElementById('prodStock').value,
      categoria: document.getElementById('prodCategoria').value,
      codigo: document.getElementById('prodCodigo').value
    });
    document.getElementById('formProducto').reset();
    document.getElementById('modalProducto').classList.remove('activo');
  });

  // Modal venta exitosa
  document.getElementById('btnCerrarVenta').addEventListener('click', () => {
    document.getElementById('modalVenta').classList.remove('activo');
  });

  // Cerrar modales al hacer clic fuera
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.remove('activo');
    });
  });

  // Atajo de teclado: Escape cierra modales
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.activo').forEach(m => m.classList.remove('activo'));
    }
    // Ctrl+F enfoca el buscador
    if (e.ctrlKey && e.key === 'f') {
      e.preventDefault();
      $buscador.focus();
    }
  });
});