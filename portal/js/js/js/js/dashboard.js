import { supabase, requireAuth, formatSoles, formatFecha, showToast } from './supabase.js';

let currentUser = null;

// Inicializar dashboard
async function init() {
  try {
    // Mostrar spinner de carga global
    mostrarSpinner(true);
    
    // Autenticación
    currentUser = await requireAuth();
    
    // Configurar UI
    mostrarNombreUsuario();
    configurarEventListeners();
    mostrarFechaActual();
    
    // Cargar datos
    await Promise.all([
      cargarCuentas(),
      cargarTransaccionesRecientes()
    ]);
    
    mostrarSpinner(false);
    
  } catch (error) {
    console.error('Error en inicialización:', error);
    mostrarSpinner(false);
    showToast('Error al cargar el dashboard', 'danger');
  }
}

// Mostrar/ocultar spinner global
function mostrarSpinner(mostrar) {
  const spinner = document.getElementById('loadingSpinner');
  if (spinner) {
    if (mostrar) {
      spinner.classList.remove('d-none');
    } else {
      spinner.classList.add('d-none');
    }
  }
}

// Mostrar nombre del usuario
function mostrarNombreUsuario() {
  const nombreDisplay = currentUser.user_metadata?.full_name?.split(' ')[0] || currentUser.email;
  document.getElementById('userName').textContent = nombreDisplay;
  document.getElementById('welcomeName').textContent = nombreDisplay;
}

// Mostrar fecha actual formateada
function mostrarFechaActual() {
  const fechaElement = document.getElementById('fechaHoy');
  const fecha = new Date();
  const opciones = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  fechaElement.textContent = fecha.toLocaleDateString('es-PE', opciones);
}

// Configurar event listeners
function configurarEventListeners() {
  // Logout
  document.getElementById('btnLogout').addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.replace('/index.html');
  });
}

// Enmascarar número de cuenta
function maskCuenta(num) {
  if (!num) return '****';
  const parts = num.split('-');
  if (parts.length > 1) {
    return `••• - •••••• - ${parts[parts.length - 1].slice(-4)}`;
  }
  return `•••• •••• ${num.slice(-4)}`;
}

// Cargar cuentas del usuario
async function cargarCuentas() {
  const { data: cuentas, error } = await supabase
    .from('cuentas')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('tipo');

  const container = document.getElementById('cuentasContainer');

  if (error) {
    console.error('Error cargando cuentas:', error);
    container.innerHTML = `
      <div class="col-12">
        <div class="alert alert-danger">Error al cargar las cuentas</div>
      </div>
    `;
    return;
  }

  if (!cuentas || cuentas.length === 0) {
    container.innerHTML = `
      <div class="col-12">
        <div class="alert alert-info">No se encontraron cuentas asociadas.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = cuentas.map(c => `
    <div class="col-12 col-md-6 col-xl-4">
      <div class="card card-saldo p-3 ${c.tipo}">
        <div class="d-flex justify-content-between align-items-start mb-2">
          <div>
            <span class="badge ${c.tipo === 'corriente' ? 'bg-primary' : 'bg-success'} mb-1">
              ${c.tipo === 'corriente' ? 'Cuenta Corriente' : 'Cuenta de Ahorro'}
            </span>
            <div class="cuenta-numero">${maskCuenta(c.numero_cuenta)}</div>
          </div>
          <i class="bi ${c.tipo === 'corriente' ? 'bi-credit-card' : 'bi-piggy-bank'} fs-3 text-muted"></i>
        </div>
        <div class="monto">${formatSoles(c.saldo)}</div>
        <div class="text-muted small mt-1">${c.moneda} · Saldo disponible</div>
      </div>
    </div>
  `).join('');
}

// Cargar últimas 5 transacciones
async function cargarTransaccionesRecientes() {
  const { data: transacciones, error } = await supabase
    .from('transacciones')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('fecha', { ascending: false })
    .limit(5);

  const txnContainer = document.getElementById('txnRecientes');

  if (error) {
    console.error('Error cargando transacciones:', error);
    txnContainer.innerHTML = `
      <p class="text-danger text-center py-3">Error al cargar movimientos</p>
    `;
    return;
  }

  if (!transacciones || transacciones.length === 0) {
    txnContainer.innerHTML = `
      <p class="text-muted text-center py-3">Sin movimientos recientes.</p>
    `;
    return;
  }

  txnContainer.innerHTML = `
    <div class="table-responsive">
      <table class="table table-hover mb-0">
        <tbody>
          ${transacciones.map(t => `
            <tr>
              <td class="ps-3">
                <div class="d-flex align-items-center gap-3">
                  <div class="rounded-circle d-flex align-items-center justify-content-center
                    ${t.tipo === 'debito' ? 'bg-danger' : 'bg-success'} bg-opacity-10"
                    style="width:36px;height:36px">
                    <i class="bi ${t.tipo === 'debito' ? 'bi-arrow-up-right text-danger' : 'bi-arrow-down-left text-success'}"></i>
                  </div>
                  <div>
                    <div class="fw-semibold small">${escapeHtml(t.descripcion)}</div>
                    <div class="text-muted" style="font-size:.75rem">${formatFecha(t.fecha)}</div>
                  </div>
                </div>
              </td>
              <td class="text-end pe-3 align-middle">
                <span class="${t.tipo === 'debito' ? 'monto-debito' : 'monto-credito'}">
                  ${t.tipo === 'debito' ? '- ' : '+ '}${formatSoles(t.monto)}
                </span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
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
