import { supabase, requireAuth, formatSoles, formatFecha, showToast } from './supabase.js';

let currentUser = null;

// Inicializar página
async function init() {
  try {
    currentUser = await requireAuth();
    
    mostrarNombreUsuario();
    configurarEventListeners();
    await cargarTransacciones();
    
  } catch (error) {
    console.error('Error en inicialización:', error);
    window.location.replace('/index.html');
  }
}

// Mostrar nombre del usuario
function mostrarNombreUsuario() {
  const nombreElement = document.getElementById('userName');
  const nombre = currentUser.user_metadata?.full_name?.split(' ')[0] || currentUser.email;
  nombreElement.textContent = nombre;
}

// Configurar event listeners
function configurarEventListeners() {
  // Logout
  document.getElementById('btnLogout').addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.replace('/index.html');
  });
  
  // Botón filtrar
  document.getElementById('btnFiltrar').addEventListener('click', cargarTransacciones);
  
  // Botón limpiar filtros
  document.getElementById('btnLimpiar').addEventListener('click', limpiarFiltros);
  
  // Permitir filtro con Enter en inputs de fecha
  const filtroDesde = document.getElementById('filtroDesde');
  const filtroHasta = document.getElementById('filtroHasta');
  const filtroTipo = document.getElementById('filtroTipo');
  
  filtroDesde.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') cargarTransacciones();
  });
  
  filtroHasta.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') cargarTransacciones();
  });
  
  filtroTipo.addEventListener('change', cargarTransacciones);
}

// Limpiar todos los filtros
function limpiarFiltros() {
  document.getElementById('filtroTipo').value = '';
  document.getElementById('filtroDesde').value = '';
  document.getElementById('filtroHasta').value = '';
  cargarTransacciones();
}

// Cargar transacciones con filtros aplicados
async function cargarTransacciones() {
  const tipo = document.getElementById('filtroTipo').value;
  const desde = document.getElementById('filtroDesde').value;
  const hasta = document.getElementById('filtroHasta').value;
  
  // Mostrar spinner en la tabla
  const tbody = document.getElementById('txnBody');
  tbody.innerHTML = `
    <tr><td colspan="5" class="text-center py-4">
      <div class="spinner-border text-primary"></div>
      <p class="text-muted mt-2 mb-0">Cargando transacciones...</p>
    </td></tr>
  `;
  
  try {
    let query = supabase
      .from('transacciones')
      .select(`
        *,
        cuentas!inner(tipo, numero_cuenta)
      `)
      .eq('user_id', currentUser.id)
      .order('fecha', { ascending: false })
      .limit(20);
    
    if (tipo) {
      query = query.eq('tipo', tipo);
    }
    
    if (desde) {
      query = query.gte('fecha', desde);
    }
    
    if (hasta) {
      query = query.lte('fecha', hasta + 'T23:59:59');
    }
    
    const { data: transacciones, error } = await query;
    
    if (error) {
      console.error('Error cargando transacciones:', error);
      showToast('Error al cargar las transacciones', 'danger');
      renderTabla([]);
      renderResumen([]);
      return;
    }
    
    renderTabla(transacciones || []);
    renderResumen(transacciones || []);
    
  } catch (error) {
    console.error('Error en cargarTransacciones:', error);
    showToast('Error al procesar la solicitud', 'danger');
    renderTabla([]);
    renderResumen([]);
  }
}

// Renderizar tabla de transacciones
function renderTabla(transacciones) {
  const tbody = document.getElementById('txnBody');
  
  if (!transacciones || transacciones.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="5" class="text-center text-muted py-4">
        <i class="bi bi-inbox fs-2 d-block mb-2"></i>
        No se encontraron transacciones con esos filtros.
      </td></tr>
    `;
    return;
  }
  
  tbody.innerHTML = transacciones.map(t => {
    const tipoCuenta = t.cuentas?.tipo === 'corriente' ? 'Cta. Corriente' : 'Cta. Ahorro';
    const icono = t.tipo === 'debito' 
      ? 'bi-arrow-up-right-circle text-danger' 
      : 'bi-arrow-down-left-circle text-success';
    const badgeClass = t.tipo === 'debito' ? 'badge-debito' : 'badge-credito';
    const badgeText = t.tipo === 'debito' ? 'Débito' : 'Crédito';
    const montoClass = t.tipo === 'debito' ? 'monto-debito' : 'monto-credito';
    const montoSign = t.tipo === 'debito' ? '- ' : '+ ';
    
    return `
      <tr>
        <td class="ps-3 text-muted small">${formatFecha(t.fecha)}</td>
        <td>
          <div class="d-flex align-items-center gap-2">
            <i class="bi ${icono} fs-5"></i>
            <span class="fw-semibold small">${escapeHtml(t.descripcion)}</span>
          </div>
        </td>
        <td class="text-muted small">${tipoCuenta}</td>
        <td>
          <span class="badge ${badgeClass} px-2 py-1">
            ${badgeText}
          </span>
        </td>
        <td class="text-end pe-3">
          <span class="${montoClass} fw-bold">
            ${montoSign}${formatSoles(t.monto)}
          </span>
        </td>
      </tr>
    `;
  }).join('');
}

// Renderizar tarjetas de resumen
function renderResumen(transacciones) {
  if (!transacciones || transacciones.length === 0) {
    document.getElementById('resTotal').textContent = '0';
    document.getElementById('resDebitos').textContent = formatSoles(0);
    document.getElementById('resCreditos').textContent = formatSoles(0);
    const netoEl = document.getElementById('resNeto');
    netoEl.textContent = formatSoles(0);
    netoEl.className = 'fw-bold fs-5 text-secondary';
    return;
  }
  
  const debitos = transacciones
    .filter(t => t.tipo === 'debito')
    .reduce((sum, t) => sum + Number(t.monto), 0);
    
  const creditos = transacciones
    .filter(t => t.tipo === 'credito')
    .reduce((sum, t) => sum + Number(t.monto), 0);
    
  const neto = creditos - debitos;
  
  document.getElementById('resTotal').textContent = transacciones.length;
  document.getElementById('resDebitos').textContent = formatSoles(debitos);
  document.getElementById('resCreditos').textContent = formatSoles(creditos);
  
  const netoEl = document.getElementById('resNeto');
  netoEl.textContent = formatSoles(Math.abs(neto));
  netoEl.className = `fw-bold fs-5 ${neto >= 0 ? 'text-success' : 'text-danger'}`;
}

// Función auxiliar para escapar HTML y prevenir XSS
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Iniciar aplicación
init();
