// ============================================================
// js/modulo.js — Lógica de negocio del Portal Financiero
// Mi Banco · MVP v1.0
//
// Importar en cada módulo HTML así:
//   import { iniciarDashboard } from '../js/modulo.js';
//
// Depende de:
//   - js/supabase.js  → supabase, requireAuth, formatSoles,
//                       formatFecha, showToast, setLoading
// ============================================================

import {
  supabase,
  requireAuth,
  formatSoles,
  formatFecha,
  showToast,
} from './supabase.js';


// ────────────────────────────────────────────────────────────
// SECCIÓN: UTILIDADES COMPARTIDAS
// ────────────────────────────────────────────────────────────

/**
 * Muestra/oculta el spinner de un botón de formulario.
 *
 * @param {string} textId   - ID del elemento con el texto normal del botón.
 * @param {string} spinnerId - ID del elemento con el spinner.
 * @param {boolean} loading  - true para mostrar spinner, false para restaurar texto.
 */
export function toggleBtnSpinner(textId, spinnerId, loading) {
  const textEl    = document.getElementById(textId);
  const spinnerEl = document.getElementById(spinnerId);
  if (!textEl || !spinnerEl) return;
  textEl.classList.toggle('d-none', loading);
  spinnerEl.classList.toggle('d-none', !loading);
}

/**
 * Enmascara un número de cuenta bancaria, mostrando solo los últimos 4 dígitos.
 * Ejemplo: "019-1234567" → "••• - •••••• - 4567"
 *
 * @param {string} num - Número de cuenta en formato string.
 * @returns {string}   - Número enmascarado.
 */
export function maskCuenta(num) {
  if (!num || typeof num !== 'string') return '****';
  const parts = num.split('-');
  return parts.length > 1
    ? `••• - •••••• - ${parts[parts.length - 1].slice(-4)}`
    : `•••• •••• ${num.slice(-4)}`;
}

/**
 * Inicializa el botón de cerrar sesión (logout).
 * Cierra la sesión en Supabase y redirige al login.
 *
 * @param {string} [btnId='btnLogout'] - ID del botón de logout en el DOM.
 */
export function initLogout(btnId = 'btnLogout') {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.replace('/index.html');
  });
}

/**
 * Muestra el nombre del usuario en el navbar.
 *
 * @param {import('@supabase/supabase-js').User} user - Objeto usuario de Supabase.
 * @param {string} [elementId='userName'] - ID del elemento donde se renderiza el nombre.
 */
export function renderUserName(user, elementId = 'userName') {
  const el = document.getElementById(elementId);
  if (!el || !user) return;
  el.textContent = user.user_metadata?.full_name?.split(' ')[0] || user.email;
}


// ────────────────────────────────────────────────────────────
// SECCIÓN: AUTH — LOGIN / REGISTRO
// ────────────────────────────────────────────────────────────

/**
 * Inicializa la página de Login.
 * - Redirige al dashboard si ya hay sesión activa.
 * - Maneja el toggle de mostrar/ocultar contraseña.
 * - Procesa el submit del formulario con Supabase Auth.
 *
 * @returns {Promise<void>}
 */
export async function iniciarLogin() {
  // Si ya hay sesión activa → dashboard
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    window.location.replace('/modulos/dashboard.html');
    return;
  }

  // Toggle ver/ocultar contraseña
  document.getElementById('togglePwd')?.addEventListener('click', () => {
    const input = document.getElementById('password');
    const icon  = document.querySelector('#togglePwd i');
    if (!input) return;
    const isPassword = input.type === 'password';
    input.type    = isPassword ? 'text' : 'password';
    icon.className = isPassword ? 'bi bi-eye-slash' : 'bi bi-eye';
  });

  // Submit login
  document.getElementById('formLogin')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email    = document.getElementById('email')?.value.trim();
    const password = document.getElementById('password')?.value;

    if (!email || !password) return;

    toggleBtnSpinner('btnLoginText', 'btnLoginSpinner', true);
    document.getElementById('alertError')?.classList.add('d-none');

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    toggleBtnSpinner('btnLoginText', 'btnLoginSpinner', false);

    if (error) {
      const alertMsg = document.getElementById('alertMsg');
      if (alertMsg) alertMsg.textContent = 'Correo o contraseña incorrectos. Verifica tus datos.';
      document.getElementById('alertError')?.classList.remove('d-none');
      return;
    }

    window.location.replace('/modulos/dashboard.html');
  });
}

/**
 * Valida en tiempo real que las contraseñas del formulario de registro coincidan.
 */
function _validarContrasenas() {
  const pwd     = document.getElementById('password')?.value || '';
  const confirm = document.getElementById('passwordConfirm')?.value || '';
  const mismatch = document.getElementById('pwdMismatch');
  if (mismatch) {
    mismatch.classList.toggle('d-none', pwd === confirm || confirm === '');
  }
}

/**
 * Crea cuentas y transacciones de demostración para un nuevo usuario registrado.
 *
 * @param {string} userId - UUID del usuario recién creado en Supabase Auth.
 * @returns {Promise<void>}
 */
async function _crearCuentasDemo(userId) {
  if (!userId) {
    console.error('[modulo.js] crearCuentasDemo: userId es requerido.');
    return;
  }

  const numeroCorriente = '019-' + Math.floor(Math.random() * 9000000 + 1000000);
  const numeroAhorro    = '019-' + Math.floor(Math.random() * 9000000 + 1000000);

  const { data: cc, error: errCC } = await supabase
    .from('cuentas')
    .insert({ user_id: userId, tipo: 'corriente', numero_cuenta: numeroCorriente, saldo: 4250.00, moneda: 'PEN' })
    .select()
    .single();

  if (errCC) {
    console.error('[modulo.js] Error creando cuenta corriente:', errCC.message);
    return;
  }

  const { data: ca, error: errCA } = await supabase
    .from('cuentas')
    .insert({ user_id: userId, tipo: 'ahorro', numero_cuenta: numeroAhorro, saldo: 12875.50, moneda: 'PEN' })
    .select()
    .single();

  if (errCA) {
    console.error('[modulo.js] Error creando cuenta ahorro:', errCA.message);
    return;
  }

  await supabase.from('cuentas_ahorro').insert({
    user_id:        userId,
    saldo:          12875.50,
    meta_ahorro:    20000,
    tasa_interes:   3.5,
    fecha_apertura: new Date().toISOString().split('T')[0],
  });

  const txns = [
    { user_id: userId, cuenta_id: cc.id, tipo: 'debito',  descripcion: 'Pago servicio agua SEDAPAL', monto: 85.00 },
    { user_id: userId, cuenta_id: cc.id, tipo: 'credito', descripcion: 'Transferencia recibida',     monto: 500.00 },
    { user_id: userId, cuenta_id: cc.id, tipo: 'debito',  descripcion: 'Compra supermercado WONG',   monto: 230.50 },
    { user_id: userId, cuenta_id: cc.id, tipo: 'debito',  descripcion: 'Pago Netflix',               monto: 39.90 },
    { user_id: userId, cuenta_id: cc.id, tipo: 'credito', descripcion: 'Depósito sueldo',            monto: 3500.00 },
    { user_id: userId, cuenta_id: ca.id, tipo: 'credito', descripcion: 'Depósito ahorro programado', monto: 1000.00 },
    { user_id: userId, cuenta_id: cc.id, tipo: 'debito',  descripcion: 'Pago luz ENEL',              monto: 120.00 },
    { user_id: userId, cuenta_id: cc.id, tipo: 'credito', descripcion: 'Devolución compra',          monto: 150.00 },
  ];

  const { error: errTxn } = await supabase.from('transacciones').insert(txns);
  if (errTxn) {
    console.error('[modulo.js] Error insertando transacciones demo:', errTxn.message);
  }
}

/**
 * Inicializa la página de Registro.
 * - Validación en tiempo real de contraseñas.
 * - Registro en Supabase Auth.
 * - Creación de cuentas y datos demo automáticamente.
 *
 * @returns {Promise<void>}
 */
export async function iniciarRegistro() {
  document.getElementById('passwordConfirm')?.addEventListener('input', _validarContrasenas);

  document.getElementById('formRegistro')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nombre   = document.getElementById('nombre')?.value.trim();
    const email    = document.getElementById('email')?.value.trim();
    const password = document.getElementById('password')?.value;
    const confirm  = document.getElementById('passwordConfirm')?.value;

    // Validaciones de cliente
    if (!nombre || nombre.length < 3) {
      showToast('El nombre debe tener al menos 3 caracteres.', 'warning');
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast('Ingresa un correo electrónico válido.', 'warning');
      return;
    }
    if (password.length < 8) {
      showToast('La contraseña debe tener al menos 8 caracteres.', 'warning');
      return;
    }
    if (password !== confirm) {
      document.getElementById('pwdMismatch')?.classList.remove('d-none');
      return;
    }

    toggleBtnSpinner('btnText', 'btnSpinner', true);
    document.getElementById('alertError')?.classList.add('d-none');

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: nombre } },
    });

    toggleBtnSpinner('btnText', 'btnSpinner', false);

    if (error) {
      let msg = 'Error al crear la cuenta.';
      if (error.message.includes('already registered')) msg = 'Este correo ya está registrado.';
      const alertMsg = document.getElementById('alertMsg');
      if (alertMsg) alertMsg.textContent = msg;
      document.getElementById('alertError')?.classList.remove('d-none');
      return;
    }

    document.getElementById('alertSuccess')?.classList.remove('d-none');
    document.getElementById('formRegistro')?.reset();

    if (data.user) await _crearCuentasDemo(data.user.id);
  });
}


// ────────────────────────────────────────────────────────────
// SECCIÓN: DASHBOARD (M2)
// ────────────────────────────────────────────────────────────

/**
 * Renderiza las tarjetas de saldo de las cuentas del usuario.
 *
 * @param {Array<Object>} cuentas - Array de objetos de cuenta desde Supabase.
 */
function _renderCuentas(cuentas) {
  const container = document.getElementById('cuentasContainer');
  if (!container) return;

  if (!cuentas || cuentas.length === 0) {
    container.innerHTML = `<div class="col-12">
      <div class="alert alert-info">No se encontraron cuentas asociadas.</div>
    </div>`;
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

/**
 * Renderiza los últimos movimientos (transacciones) en el dashboard.
 *
 * @param {Array<Object>} txns - Array de transacciones desde Supabase.
 */
function _renderUltimosTxn(txns) {
  const txnEl = document.getElementById('txnRecientes');
  if (!txnEl) return;

  if (!txns || txns.length === 0) {
    txnEl.innerHTML = `<p class="text-muted text-center py-3">Sin movimientos recientes.</p>`;
    return;
  }

  txnEl.innerHTML = `
    <div class="table-responsive">
      <table class="table table-hover mb-0">
        <tbody>
          ${txns.map(t => `
            <tr>
              <td class="ps-3">
                <div class="d-flex align-items-center gap-3">
                  <div class="rounded-circle d-flex align-items-center justify-content-center
                    ${t.tipo === 'debito' ? 'bg-danger' : 'bg-success'} bg-opacity-10"
                    style="width:36px;height:36px">
                    <i class="bi ${t.tipo === 'debito' ? 'bi-arrow-up-right text-danger' : 'bi-arrow-down-left text-success'}"></i>
                  </div>
                  <div>
                    <div class="fw-semibold small">${t.descripcion}</div>
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
    </div>`;
}

/**
 * Inicializa el módulo Dashboard (M2).
 * - Verifica autenticación.
 * - Carga cuentas y últimos movimientos desde Supabase.
 * - Renderiza la fecha actual y el nombre de bienvenida.
 *
 * @returns {Promise<void>}
 */
export async function iniciarDashboard() {
  const user = await requireAuth();
  renderUserName(user);
  initLogout();

  const nombreDisplay = user.user_metadata?.full_name?.split(' ')[0] || user.email;
  const welcomeEl = document.getElementById('welcomeName');
  if (welcomeEl) welcomeEl.textContent = nombreDisplay;

  const fechaEl = document.getElementById('fechaHoy');
  if (fechaEl) {
    fechaEl.textContent = new Date().toLocaleDateString('es-PE', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  }

  // Cargar cuentas
  const { data: cuentas, error: errCuentas } = await supabase
    .from('cuentas')
    .select('*')
    .eq('user_id', user.id)
    .order('tipo');

  if (errCuentas) {
    console.error('[modulo.js] Error cargando cuentas:', errCuentas.message);
  }
  _renderCuentas(cuentas);

  // Cargar últimos 5 movimientos
  const { data: txns, error: errTxn } = await supabase
    .from('transacciones')
    .select('*')
    .eq('user_id', user.id)
    .order('fecha', { ascending: false })
    .limit(5);

  if (errTxn) {
    console.error('[modulo.js] Error cargando transacciones:', errTxn.message);
  }
  _renderUltimosTxn(txns);
}


// ────────────────────────────────────────────────────────────
// SECCIÓN: TRANSACCIONES (M3)
// ────────────────────────────────────────────────────────────

/**
 * Renderiza el resumen de totales (débitos, créditos, balance neto).
 *
 * @param {Array<Object>} txns - Array de transacciones.
 */
function _renderResumenTxn(txns) {
  const debitos  = txns.filter(t => t.tipo === 'debito').reduce((s, t)  => s + Number(t.monto), 0);
  const creditos = txns.filter(t => t.tipo === 'credito').reduce((s, t) => s + Number(t.monto), 0);
  const neto     = creditos - debitos;

  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setEl('resTotal',    txns.length);
  setEl('resDebitos',  formatSoles(debitos));
  setEl('resCreditoss', formatSoles(creditos));

  const netoEl = document.getElementById('resNeto');
  if (netoEl) {
    netoEl.textContent = formatSoles(Math.abs(neto));
    netoEl.className   = `fw-bold fs-5 ${neto >= 0 ? 'text-success' : 'text-danger'}`;
  }
}

/**
 * Renderiza la tabla de transacciones en el módulo M3.
 *
 * @param {Array<Object>} txns - Array de transacciones con join a cuentas.
 */
function _renderTablaTxn(txns) {
  const tbody = document.getElementById('txnBody');
  if (!tbody) return;

  if (!txns || txns.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">
      <i class="bi bi-inbox fs-2 d-block mb-2"></i>No se encontraron transacciones con esos filtros.
    </td></tr>`;
    return;
  }

  tbody.innerHTML = txns.map(t => `
    <tr>
      <td class="ps-3 text-muted small">${formatFecha(t.fecha)}</td>
      <td>
        <div class="d-flex align-items-center gap-2">
          <i class="bi ${t.tipo === 'debito' ? 'bi-arrow-up-right-circle text-danger' : 'bi-arrow-down-left-circle text-success'} fs-5"></i>
          <span class="fw-semibold small">${t.descripcion}</span>
        </div>
      </td>
      <td class="text-muted small">
        ${t.cuentas ? (t.cuentas.tipo === 'corriente' ? 'Cta. Corriente' : 'Cta. Ahorro') : '—'}
      </td>
      <td>
        <span class="badge ${t.tipo === 'debito' ? 'badge-debito' : 'badge-credito'} px-2 py-1">
          ${t.tipo === 'debito' ? 'Débito' : 'Crédito'}
        </span>
      </td>
      <td class="text-end pe-3">
        <span class="${t.tipo === 'debito' ? 'monto-debito' : 'monto-credito'} fw-bold">
          ${t.tipo === 'debito' ? '- ' : '+ '}${formatSoles(t.monto)}
        </span>
      </td>
    </tr>
  `).join('');
}

/**
 * Carga las transacciones aplicando los filtros del formulario.
 * Lanza la query a Supabase y actualiza tabla + resumen.
 *
 * @param {string} userId - UUID del usuario autenticado.
 * @returns {Promise<void>}
 */
async function _cargarTransacciones(userId) {
  const tipo  = document.getElementById('filtroTipo')?.value  || '';
  const desde = document.getElementById('filtroDesde')?.value || '';
  const hasta = document.getElementById('filtroHasta')?.value || '';

  let query = supabase
    .from('transacciones')
    .select('*, cuentas(tipo, numero_cuenta)')
    .eq('user_id', userId)
    .order('fecha', { ascending: false })
    .limit(20);

  if (tipo)  query = query.eq('tipo', tipo);
  if (desde) query = query.gte('fecha', desde);
  if (hasta) query = query.lte('fecha', hasta + 'T23:59:59');

  const { data: txns, error } = await query;

  if (error) {
    console.error('[modulo.js] Error cargando transacciones:', error.message);
    showToast('Error al cargar transacciones.', 'danger');
    return;
  }

  _renderTablaTxn(txns || []);
  _renderResumenTxn(txns || []);
}

/**
 * Inicializa el módulo de Transacciones (M3).
 * - Verifica autenticación.
 * - Conecta botones Filtrar y Limpiar.
 * - Carga la tabla inicial sin filtros.
 *
 * @returns {Promise<void>}
 */
export async function iniciarTransacciones() {
  const user = await requireAuth();
  renderUserName(user);
  initLogout();

  document.getElementById('btnFiltrar')?.addEventListener('click', () => _cargarTransacciones(user.id));

  document.getElementById('btnLimpiar')?.addEventListener('click', () => {
    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    setVal('filtroTipo',  '');
    setVal('filtroDesde', '');
    setVal('filtroHasta', '');
    _cargarTransacciones(user.id);
  });

  await _cargarTransacciones(user.id);
}


// ────────────────────────────────────────────────────────────
// SECCIÓN: PAGOS (M4)
// ────────────────────────────────────────────────────────────

/**
 * Renderiza el historial de pagos del usuario.
 *
 * @param {string} userId - UUID del usuario autenticado.
 * @returns {Promise<void>}
 */
async function _cargarHistorialPagos(userId) {
  const { data: pagos, error } = await supabase
    .from('pagos')
    .select('*')
    .eq('user_id', userId)
    .order('fecha', { ascending: false })
    .limit(10);

  const el = document.getElementById('historialPagos');
  if (!el) return;

  if (error) {
    console.error('[modulo.js] Error cargando historial de pagos:', error.message);
    el.innerHTML = `<p class="text-danger text-center py-3">Error al cargar pagos.</p>`;
    return;
  }

  const iconos = { agua: 'droplet', luz: 'lightning', cable: 'tv', telefono: 'phone', gas: 'fire' };

  if (!pagos || pagos.length === 0) {
    el.innerHTML = `<p class="text-muted text-center py-4">Sin pagos registrados aún.</p>`;
    return;
  }

  el.innerHTML = `
    <ul class="list-group list-group-flush">
      ${pagos.map(p => `
        <li class="list-group-item d-flex justify-content-between align-items-center px-3">
          <div class="d-flex align-items-center gap-3">
            <div class="rounded-circle bg-primary bg-opacity-10 d-flex align-items-center justify-content-center"
                 style="width:36px;height:36px">
              <i class="bi bi-${iconos[p.servicio] || 'receipt'} text-primary"></i>
            </div>
            <div>
              <div class="fw-semibold small text-capitalize">${p.servicio}</div>
              <div class="text-muted" style="font-size:.75rem">
                N° ${p.numero_contrato} · ${formatFecha(p.fecha)}
              </div>
            </div>
          </div>
          <div class="text-end">
            <div class="monto-debito fw-bold small">- ${formatSoles(p.monto)}</div>
            <span class="badge bg-success-subtle text-success" style="font-size:.7rem">Completado</span>
          </div>
        </li>
      `).join('')}
    </ul>`;
}

/**
 * Valida los datos del formulario de pago antes de abrir el modal de confirmación.
 *
 * @param {string|null} servicio   - Valor del radio seleccionado.
 * @param {string}      contrato   - Número de contrato ingresado.
 * @param {number}      monto      - Monto a pagar.
 * @param {string}      cuentaId   - ID de la cuenta seleccionada.
 * @returns {{ ok: boolean, mensaje: string }}
 */
function _validarFormularioPago(servicio, contrato, monto, cuentaId) {
  if (!servicio)                    return { ok: false, mensaje: 'Selecciona un tipo de servicio.' };
  if (!contrato || contrato.length < 4) return { ok: false, mensaje: 'Ingresa un número de contrato válido (mínimo 4 caracteres).' };
  if (!monto || isNaN(monto) || monto <= 0) return { ok: false, mensaje: 'Ingresa un monto válido mayor a 0.' };
  if (monto > 99999.99)             return { ok: false, mensaje: 'El monto no puede exceder S/ 99,999.99.' };
  if (!cuentaId)                    return { ok: false, mensaje: 'Selecciona una cuenta de origen.' };
  return { ok: true, mensaje: '' };
}

/**
 * Inicializa el módulo de Pagos (M4).
 * - Verifica autenticación y carga las cuentas del usuario.
 * - Maneja el flujo de formulario → modal de confirmación → guardado en Supabase.
 * - Carga el historial de pagos al inicio.
 *
 * @returns {Promise<void>}
 */
export async function iniciarPagos() {
  const user = await requireAuth();
  renderUserName(user);
  initLogout();

  // Cargar cuentas en el select
  const { data: cuentas, error: errCuentas } = await supabase
    .from('cuentas')
    .select('*')
    .eq('user_id', user.id);

  if (errCuentas) {
    console.error('[modulo.js] Error cargando cuentas para pagos:', errCuentas.message);
  }

  const selectCuenta = document.getElementById('cuentaOrigen');
  if (selectCuenta && cuentas && cuentas.length > 0) {
    selectCuenta.innerHTML = cuentas.map(c =>
      `<option value="${c.id}">${c.tipo === 'corriente' ? 'Cta. Corriente' : 'Cta. Ahorro'} — ${formatSoles(c.saldo)}</option>`
    ).join('');
  }

  // Modal de confirmación
  const modalEl = document.getElementById('modalConfirmar');
  const modal   = modalEl ? new bootstrap.Modal(modalEl) : null;
  let datosPago = null;

  // Submit formulario → abrir modal
  document.getElementById('formPago')?.addEventListener('submit', (e) => {
    e.preventDefault();

    const servicio    = document.querySelector('input[name="servicioRadio"]:checked')?.value || null;
    const contrato    = document.getElementById('contrato')?.value.trim() || '';
    const monto       = parseFloat(document.getElementById('montoPago')?.value || '0');
    const cuentaId    = selectCuenta?.value || '';
    const cuentaLabel = selectCuenta?.options[selectCuenta?.selectedIndex]?.text || '';

    const { ok, mensaje } = _validarFormularioPago(servicio, contrato, monto, cuentaId);
    if (!ok) { showToast(mensaje, 'warning'); return; }

    datosPago = { servicio, contrato, monto, cuentaId, cuentaLabel };

    // Llenar modal con los datos
    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setEl('confServicio', servicio.toUpperCase());
    setEl('confContrato', contrato);
    setEl('confMonto',    formatSoles(monto));
    setEl('confCuenta',   cuentaLabel);

    modal?.show();
  });

  // Confirmar pago → insertar en Supabase
  document.getElementById('btnConfirmarPago')?.addEventListener('click', async () => {
    if (!datosPago) return;

    toggleBtnSpinner('btnConfText', 'btnConfSpinner', true);

    const { error } = await supabase.from('pagos').insert({
      user_id:         user.id,
      servicio:        datosPago.servicio,
      numero_contrato: datosPago.contrato,
      monto:           datosPago.monto,
      estado:          'completado',
    });

    toggleBtnSpinner('btnConfText', 'btnConfSpinner', false);
    modal?.hide();

    if (error) {
      console.error('[modulo.js] Error al registrar pago:', error.message);
      showToast('Error al procesar el pago. Intenta nuevamente.', 'danger');
      return;
    }

    showToast(`Pago de ${datosPago.servicio.toUpperCase()} realizado con éxito por ${formatSoles(datosPago.monto)}`, 'success');
    document.getElementById('formPago')?.reset();
    datosPago = null;
    await _cargarHistorialPagos(user.id);
  });

  await _cargarHistorialPagos(user.id);
}


// ────────────────────────────────────────────────────────────
// SECCIÓN: PRÉSTAMOS (M5)
// ────────────────────────────────────────────────────────────

/**
 * Calcula la cuota mensual usando la fórmula de amortización francesa.
 * C = P × [r(1+r)^n] / [(1+r)^n - 1]
 *
 * @param {number} monto      - Monto del préstamo (P).
 * @param {number} plazoMeses - Número de cuotas (n).
 * @param {number} tasaAnual  - Tasa de interés anual en % (ej: 24 para 24%).
 * @returns {number}          - Cuota mensual calculada.
 */
export function calcularCuota(monto, plazoMeses, tasaAnual) {
  if (!monto || monto <= 0)       throw new Error('El monto debe ser mayor a 0.');
  if (!plazoMeses || plazoMeses <= 0) throw new Error('El plazo debe ser mayor a 0.');
  if (tasaAnual < 0)              throw new Error('La tasa no puede ser negativa.');

  const r = (tasaAnual / 100) / 12; // tasa mensual
  const n = plazoMeses;
  if (r === 0) return monto / n;    // sin interés
  const factor = Math.pow(1 + r, n);
  return monto * (r * factor) / (factor - 1);
}

/**
 * Actualiza los campos del simulador y el formulario sincronizado.
 * Se invoca al cambiar cualquier input del simulador.
 */
function _actualizarSimulador() {
  const monto = parseInt(document.getElementById('sliderMonto')?.value || '0');
  const plazo = parseInt(document.getElementById('selectPlazo')?.value || '12');
  const tasa  = parseFloat(document.getElementById('selectTasa')?.value || '24');

  let cuota, total, intereses;
  try {
    cuota     = calcularCuota(monto, plazo, tasa);
    total     = cuota * plazo;
    intereses = total - monto;
  } catch (err) {
    console.error('[modulo.js] Error en cálculo de cuota:', err.message);
    return;
  }

  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setEl('montoLabel',   formatSoles(monto));
  setEl('cuotaValor',   formatSoles(cuota));
  setEl('totalPagar',   formatSoles(total));
  setEl('totalInteres', formatSoles(intereses));

  // Sincronizar con el formulario de solicitud (readonly)
  const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  setVal('solMonto', monto.toLocaleString('es-PE'));
  setVal('solPlazo', `${plazo} meses`);
  setVal('solTasa',  `${tasa}% TEA`);
  setVal('solCuota', cuota.toFixed(2));
}

/**
 * Carga y renderiza el historial de solicitudes de préstamo del usuario.
 *
 * @param {string} userId - UUID del usuario autenticado.
 * @returns {Promise<void>}
 */
async function _cargarSolicitudesPrestamo(userId) {
  const { data: sols, error } = await supabase
    .from('solicitudes_prestamo')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(5);

  const el = document.getElementById('listaSolicitudes');
  if (!el) return;

  if (error) {
    console.error('[modulo.js] Error cargando solicitudes:', error.message);
    el.innerHTML = `<p class="text-danger text-center py-3 small">Error al cargar solicitudes.</p>`;
    return;
  }

  if (!sols || sols.length === 0) {
    el.innerHTML = `<p class="text-muted text-center py-3 small">Sin solicitudes previas.</p>`;
    return;
  }

  const estadoColor = { pendiente: 'warning', aprobado: 'success', rechazado: 'danger' };

  el.innerHTML = `
    <ul class="list-group list-group-flush">
      ${sols.map(s => `
        <li class="list-group-item d-flex justify-content-between align-items-center px-3">
          <div>
            <div class="fw-semibold small">${formatSoles(s.monto)} · ${s.plazo_meses} meses</div>
            <div class="text-muted" style="font-size:.75rem">
              ID: ${s.id.slice(0, 8).toUpperCase()} · ${formatFecha(s.created_at)}
            </div>
          </div>
          <span class="badge bg-${estadoColor[s.estado] || 'secondary'} text-capitalize">
            ${s.estado}
          </span>
        </li>
      `).join('')}
    </ul>`;
}

/**
 * Valida los datos del formulario de solicitud de préstamo.
 *
 * @param {string} proposito - Propósito seleccionado.
 * @param {number} ingresos  - Ingresos mensuales declarados.
 * @param {number} monto     - Monto del préstamo.
 * @param {boolean} terminos - Si el checkbox de términos está marcado.
 * @returns {{ ok: boolean, mensaje: string }}
 */
function _validarFormularioPrestamo(proposito, ingresos, monto, terminos) {
  if (!proposito)                         return { ok: false, mensaje: 'Selecciona el propósito del préstamo.' };
  if (!ingresos || isNaN(ingresos) || ingresos <= 0) return { ok: false, mensaje: 'Ingresa tus ingresos mensuales.' };
  if (ingresos < 500)                     return { ok: false, mensaje: 'Los ingresos mínimos requeridos son S/ 500.' };
  if (monto > ingresos * 60)              return { ok: false, mensaje: 'El monto solicitado excede el máximo permitido según tus ingresos.' };
  if (!terminos)                          return { ok: false, mensaje: 'Debes aceptar los términos y condiciones.' };
  return { ok: true, mensaje: '' };
}

/**
 * Inicializa el módulo de Préstamos (M5).
 * - Verifica autenticación.
 * - Conecta el simulador a los inputs de rango y select.
 * - Maneja el envío de la solicitud a Supabase.
 * - Carga el historial de solicitudes al inicio.
 *
 * @returns {Promise<void>}
 */
export async function iniciarPrestamos() {
  const user = await requireAuth();
  renderUserName(user);
  initLogout();

  // Conectar simulador
  ['sliderMonto', 'selectPlazo', 'selectTasa'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', _actualizarSimulador);
  });
  _actualizarSimulador();

  const modalExitoEl = document.getElementById('modalExito');
  const modalExito   = modalExitoEl ? new bootstrap.Modal(modalExitoEl) : null;

  // Submit formulario de solicitud
  document.getElementById('formPrestamo')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const proposito = document.getElementById('proposito')?.value || '';
    const ingresos  = parseFloat(document.getElementById('ingresos')?.value || '0');
    const monto     = parseInt(document.getElementById('sliderMonto')?.value || '0');
    const plazo     = parseInt(document.getElementById('selectPlazo')?.value || '12');
    const tasa      = parseFloat(document.getElementById('selectTasa')?.value || '24');
    const terminos  = document.getElementById('chkTerminos')?.checked || false;

    const { ok, mensaje } = _validarFormularioPrestamo(proposito, ingresos, monto, terminos);
    if (!ok) { showToast(mensaje, 'warning'); return; }

    let cuota;
    try {
      cuota = calcularCuota(monto, plazo, tasa);
    } catch (err) {
      showToast('Error al calcular la cuota. Verifica los parámetros.', 'danger');
      return;
    }

    toggleBtnSpinner('btnSolText', 'btnSolSpinner', true);

    const { data, error } = await supabase
      .from('solicitudes_prestamo')
      .insert({
        user_id:       user.id,
        monto,
        plazo_meses:   plazo,
        tasa_anual:    tasa,
        cuota_mensual: parseFloat(cuota.toFixed(2)),
        proposito,
        estado:        'pendiente',
      })
      .select()
      .single();

    toggleBtnSpinner('btnSolText', 'btnSolSpinner', false);

    if (error) {
      console.error('[modulo.js] Error al enviar solicitud de préstamo:', error.message);
      showToast('Error al enviar la solicitud. Intenta nuevamente.', 'danger');
      return;
    }

    // Mostrar modal de éxito
    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setEl('numSolicitud', data.id.slice(0, 8).toUpperCase());
    setEl('exitoMonto',   formatSoles(monto));
    setEl('exitoCuota',   formatSoles(cuota));
    modalExito?.show();

    document.getElementById('formPrestamo')?.reset();
    _actualizarSimulador();
    await _cargarSolicitudesPrestamo(user.id);
  });

  await _cargarSolicitudesPrestamo(user.id);
}


// ────────────────────────────────────────────────────────────
// SECCIÓN: AHORRO (M6)
// ────────────────────────────────────────────────────────────

/**
 * Genera la proyección de crecimiento del ahorro a N meses.
 *
 * @param {number} saldoInicial  - Saldo actual de la cuenta de ahorro.
 * @param {number} tasaAnual     - Tasa de interés anual en %.
 * @param {number} [meses=12]   - Número de meses a proyectar.
 * @returns {Array<{fecha: string, saldo: number, interes: number}>}
 */
export function proyectarAhorro(saldoInicial, tasaAnual, meses = 12) {
  if (saldoInicial < 0) throw new Error('El saldo inicial no puede ser negativo.');
  if (tasaAnual < 0)    throw new Error('La tasa no puede ser negativa.');
  if (meses <= 0)       throw new Error('El número de meses debe ser mayor a 0.');

  const tasaMensual = tasaAnual / 100 / 12;
  let saldo = saldoInicial;
  const resultado = [];

  for (let mes = 1; mes <= meses; mes++) {
    const interes = saldo * tasaMensual;
    saldo += interes;
    const fecha = new Date();
    fecha.setMonth(fecha.getMonth() + mes);
    resultado.push({
      fecha:  fecha.toLocaleDateString('es-PE', { month: 'short', year: 'numeric' }),
      saldo:  saldo,
      interes: interes,
    });
  }
  return resultado;
}

/**
 * Inicializa el módulo de Ahorro (M6).
 * - Verifica autenticación.
 * - Carga datos de la cuenta de ahorro y los movimientos.
 * - Renderiza barra de progreso y tabla de proyección.
 *
 * @returns {Promise<void>}
 */
export async function iniciarAhorro() {
  const user = await requireAuth();
  renderUserName(user);
  initLogout();

  const { data: ahorro, error: errAhorro } = await supabase
    .from('cuentas_ahorro')
    .select('*')
    .eq('user_id', user.id)
    .single();

  const { data: cuentaAhorro, error: errCuenta } = await supabase
    .from('cuentas')
    .select('*')
    .eq('user_id', user.id)
    .eq('tipo', 'ahorro')
    .single();

  // Ocultar spinner y mostrar contenido
  document.getElementById('loadingAhorro')?.classList.add('d-none');
  document.getElementById('contenidoAhorro')?.classList.remove('d-none');

  if (errAhorro) {
    console.error('[modulo.js] Error cargando cuenta de ahorro:', errAhorro.message);
    showToast('Error al cargar la cuenta de ahorro.', 'danger');
    return;
  }

  if (ahorro) {
    const saldo = parseFloat(ahorro.saldo);
    const meta  = parseFloat(ahorro.meta_ahorro);
    const pct   = Math.min(Math.round((saldo / meta) * 100), 100);
    const falta = Math.max(meta - saldo, 0);

    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setEl('saldoAhorro',    formatSoles(saldo));
    setEl('tasaAhorro',     `${ahorro.tasa_interes}%`);
    setEl('fechaApertura',  formatFecha(ahorro.fecha_apertura));
    setEl('metaAhorro',     formatSoles(meta));
    setEl('saldoProgreso',  formatSoles(saldo));
    setEl('metaProgreso',   formatSoles(meta));
    setEl('pctProgreso',    `${pct}%`);
    setEl('faltaProgreso',  `Falta: ${formatSoles(falta)}`);
    setEl('metaLabel',      `Meta: ${formatSoles(meta)}`);

    const barra = document.getElementById('barraProgreso');
    if (barra) {
      barra.style.width  = `${pct}%`;
      barra.textContent  = pct >= 10 ? `${pct}%` : '';
    }

    // Número enmascarado de cuenta
    if (cuentaAhorro && !errCuenta) {
      const numEl = document.getElementById('numCuentaAhorro');
      if (numEl) numEl.textContent = `••• ••• ${cuentaAhorro.numero_cuenta.slice(-4)}`;
    }

    // Tabla de proyección a 12 meses
    let proyeccion;
    try {
      proyeccion = proyectarAhorro(saldo, ahorro.tasa_interes, 12);
    } catch (err) {
      console.error('[modulo.js] Error en proyección de ahorro:', err.message);
      proyeccion = [];
    }

    const tablaEl = document.getElementById('tablaProyeccion');
    if (tablaEl) {
      tablaEl.innerHTML = proyeccion.map(row => `
        <tr>
          <td>${row.fecha}</td>
          <td class="text-end fw-semibold">${formatSoles(row.saldo)}</td>
          <td class="text-end text-success">${formatSoles(row.interes)}</td>
        </tr>
      `).join('');
    }
  }

  // Movimientos de la cuenta de ahorro
  if (cuentaAhorro && !errCuenta) {
    const { data: movs, error: errMovs } = await supabase
      .from('transacciones')
      .select('*')
      .eq('user_id', user.id)
      .eq('cuenta_id', cuentaAhorro.id)
      .order('fecha', { ascending: false })
      .limit(10);

    if (errMovs) {
      console.error('[modulo.js] Error cargando movimientos de ahorro:', errMovs.message);
    }

    const tbody = document.getElementById('movAhorro');
    if (tbody && movs && movs.length > 0) {
      tbody.innerHTML = movs.map(m => `
        <tr>
          <td class="ps-3 text-muted small">${formatFecha(m.fecha)}</td>
          <td class="fw-semibold small">${m.descripcion}</td>
          <td>
            <span class="badge ${m.tipo === 'debito' ? 'badge-debito' : 'badge-credito'} px-2 py-1">
              ${m.tipo === 'debito' ? 'Retiro' : 'Depósito'}
            </span>
          </td>
          <td class="text-end pe-3">
            <span class="${m.tipo === 'debito' ? 'monto-debito' : 'monto-credito'} fw-bold">
              ${m.tipo === 'debito' ? '- ' : '+ '}${formatSoles(m.monto)}
            </span>
          </td>
        </tr>
      `).join('');
    }
  }
}
