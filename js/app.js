/* ============================================
   VACITOPLASTICO POS - CONEXIÓN SUPABASE
   ============================================ */

// 1. CONFIGURACIÓN DE SUPABASE (Tus claves)
const SUPABASE_URL = 'https://tahejfchdcdcqotjwihc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhaGVqZmNoZGNkY3FvdGp3aWhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1NjAzODksImV4cCI6MjEwMDEzNjM4OX0.1hD0ZR-Yg7VBXXBO3I7xall5YUBZyIe4warbJOfp4JE';

// Inicializar cliente de Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let productos = [];
let carrito = [];

// Elementos del DOM
const $grid = document.getElementById('productosGrid');
const $carritoItems = document.getElementById('carritoItems');
const $total = document.getElementById('total');
const $buscador = document.getElementById('buscador');
const $categoria = document.getElementById('selectorCategoria');
const $fechaHora = document.getElementById('fechaHora');

// --- FUNCIONES DE BASE DE DATOS ---

async function cargarProductos() {
  try {
    const { data, error } = await supabase
      .from('productos')
      .select('*')
      .order('nombre', { ascending: true });

    if (error) throw error;
    
    productos = data || [];
    renderizarProductos();
  } catch (err) {
    console.error('Error cargando productos:', err);
    notificar('Error de conexión. Revisa tu internet.', 'error');
  }
}

async function guardarProductoEnNube(datos) {
  const emojis = { 'bebidas': '🥤', 'alimentos': '🍞', 'limpieza': '🧹', 'varios': '📦' };
  
  const nuevo = {
    nombre: datos.nombre,
    precio: parseFloat(datos.precio),
    costo: 0,
    stock: parseInt(datos.stock) || 0,
    categoria: datos.categoria,
    codigo: '',
    emoji: emojis[datos.categoria] || '📦'
  };

  const { data, error } = await supabase.from('productos').insert([nuevo]).select();
  
  if (error) {
    notificar('Error al guardar en la nube', 'error');
    console.error(error);
  } else {
    productos.push(data[0]);
    renderizarProductos();
    notificar(`"${nuevo.nombre}" guardado en la nube`);
  }
}

async function registrarVentaEnNube(venta) {
  try {
    // 1. Guardar la venta
    const { error: errorVenta } = await supabase.from('ventas').insert([{
      items: venta.items,
      total: venta.total,
      metodo: venta.metodo,
      numero: venta.numero
    }]);

    if (errorVenta) throw errorVenta;

    // 2. Actualizar el stock de cada producto vendido
    for (const item of venta.items) {
      const prod = productos.find(p => p.id === item.id);
      if (prod) {
        const nuevoStock = prod.stock - item.cantidad;
        await supabase
          .from('productos')
          .update({ stock: nuevoStock })
          .eq('id', item.id);
        
        // Actualizar también en el array local para que la UI refleje el cambio inmediato
        prod.stock = nuevoStock;
      }
    }
    
    renderizarProductos(); // Refrescar la vista con el nuevo stock
    notificar('Venta sincronizada con la nube ✅');
  } catch (err) {
    console.error('Error registrando venta:', err);
    notificar('Error al guardar la venta. Inténtalo de nuevo.', 'error');
  }
}

// --- FUNCIONES DE RENDERIZADO ---

function renderizarProductos() {
  const busqueda = $buscador.value.toLowerCase();
  const cat = $categoria.value;

  const filtrados = productos.filter(p => {
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
      <div class="producto-stock ${p.stock <= 5 ? 'bajo' : ''}">Stock: ${p.stock}</div>
    </div>
  `).join('');
}

function renderizarCarrito() {
  if (carrito.length === 0) {
    $carritoItems.innerHTML = `<div class="carrito-vacio"><span class="vacio-icon">🛒</span><p>Agrega productos</p></div>`;
    $total.textContent = '$0.00';
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

  const total = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
  $total.textContent = `$${total.toFixed(2)}`;
}

// --- FUNCIONES DE ACCIÓN ---

function agregarAlCarrito(id) {
  const producto = productos.find(p => p.id === id);
  if (!producto || producto.stock <= 0) return;

  const existente = carrito.find(item => item.id === id);
  if (existente) {
    if (existente.cantidad >= producto.stock) {
      notificar('No hay más stock disponible', 'error');
      return;
    }
    existente.cantidad++;
  } else {
    carrito.push({ id: producto.id, nombre: producto.nombre, precio: producto.precio, cantidad: 1 });
  }
  renderizarCarrito();
}

function cambiarCantidad(id, cambio) {
  const item = carrito.find(i => i.id === id);
  if (!item) return;
  const producto = productos.find(p => p.id === id);

  if (cambio > 0 && item.cantidad >= producto.stock) {
    notificar('Stock insuficiente', 'error');
    return;
  }

  item.cantidad += cambio;
  if (item.cantidad <= 0) carrito = carrito.filter(i => i.id !== id);
  renderizarCarrito();
}

function limpiarCarrito() {
  if (carrito.length === 0) return;
  if (confirm('¿Limpiar toda la venta actual?')) {
    carrito = [];
    renderizarCarrito();
  }
}

async function finalizarVenta() {
  if (carrito.length === 0) {
    notificar('El carrito está vacío', 'error');
    return;
  }

  const metodo = document.getElementById('metodoPago').value;
  const total = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
  const numeroVenta = Math.floor(Math.random() * 10000); // Simulado por ahora

  const venta = {
    items: [...carrito],
    total: total,
    metodo: metodo,
    numero: numeroVenta
  };

  // Mostrar modal de carga
  const btnVender = document.getElementById('btnVender');
  btnVender.textContent = '⏳ Guardando...';
  btnVender.disabled = true;

  // Enviar a la nube
  await registrarVentaEnNube(venta);

  // Mostrar éxito
  const metodosNombres = {
    'efectivo_cup': '💵 Efectivo CUP',
    'efectivo_usd': '💲 Efectivo USD',
    'transfermovil': '📱 Transfermóvil',
    'enzona': '📱 EnZona',
    'fiao': '📝 Fiao (Crédito)'
  };

  document.getElementById('exitoTotal').textContent = `$${total.toFixed(2)}`;
  document.getElementById('exitoMetodo').textContent = metodosNombres[metodo] || metodo;
  document.getElementById('modalVenta').classList.add('activo');

  carrito = [];
  renderizarCarrito();
  
  btnVender.textContent = '💰 Finalizar Venta';
  btnVender.disabled = false;
}

// --- UTILIDADES ---

function notificar(mensaje, tipo = 'exito') {
  const contenedor = document.getElementById('notificaciones');
  const notif = document.createElement('div');
  notif.className = `notificacion ${tipo}`;
  notif.textContent = mensaje;
  contenedor.appendChild(notif);
  setTimeout(() => {
    notif.style.opacity = '0';
    setTimeout(() => notif.remove(), 300);
  }, 2500);
}

function actualizarReloj() {
  const ahora = new Date();
  $fechaHora.textContent = ahora.toLocaleDateString('es-CU', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function alternarTema() {
  const actual = document.documentElement.getAttribute('data-tema');
  const nuevo = actual === 'oscuro' ? 'claro' : 'oscuro';
  document.documentElement.setAttribute('data-tema', nuevo);
  document.getElementById('btnTema').textContent = nuevo === 'oscuro' ? '☀️' : '🌙';
  localStorage.setItem('vacitoplastico_tema', nuevo);
}

// --- INICIALIZACIÓN ---

document.addEventListener('DOMContentLoaded', () => {
  cargarProductos(); // Cargar desde la nube al iniciar
  renderizarCarrito();
  actualizarReloj();
  setInterval(actualizarReloj, 30000);

  const temaGuardado = localStorage.getItem('vacitoplastico_tema');
  if (temaGuardado === 'oscuro') {
    document.documentElement.setAttribute('data-tema', 'oscuro');
    document.getElementById('btnTema').textContent = '☀️';
  }

  $buscador.addEventListener('input', renderizarProductos);
  $categoria.addEventListener('change', renderizarProductos);
  document.getElementById('btnTema').addEventListener('click', alternarTema);
  document.getElementById('btnLimpiarCarrito').addEventListener('click', limpiarCarrito);
  document.getElementById('btnVender').addEventListener('click', finalizarVenta);

  document.getElementById('btnNuevoProducto').addEventListener('click', () => {
    document.getElementById('modalProducto').classList.add('activo');
  });
  document.getElementById('btnCerrarModal').addEventListener('click', () => {
    document.getElementById('modalProducto').classList.remove('activo');
  });

  document.getElementById('formProducto').addEventListener('submit', (e) => {
    e.preventDefault();
    guardarProductoEnNube({
      nombre: document.getElementById('prodNombre').value,
      precio: document.getElementById('prodPrecio').value,
      stock: document.getElementById('prodStock').value,
      categoria: document.getElementById('prodCategoria').value
    });
    document.getElementById('formProducto').reset();
    document.getElementById('modalProducto').classList.remove('activo');
  });

  document.getElementById('btnCerrarVenta').addEventListener('click', () => {
    document.getElementById('modalVenta').classList.remove('activo');
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.remove('activo');
    });
  });
});