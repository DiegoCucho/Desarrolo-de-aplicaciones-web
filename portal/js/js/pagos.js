import { supabase, requireAuth, formatSoles, formatFecha, showToast } from './supabase.js';

// Estado de la aplicación
let datosPago = null;
let modalConfirmar = null;
let currentUser = null;

// Iconos por tipo de servicio para el historial
const iconosServicio = {
  agua: 'droplet',
  luz: 'lightning',
  cable: 'tv',
  telefono: 'phone',
  gas: 'fire'
};

// Inicialización de la página
async function init() {
  try {
    // Autenticación
    currentUser = await requireAuth();
    
    // Inicializar componentes Bootstrap
    modalConfirmar = new bootstrap.Modal(document.getElementById('modalConfirmar'));
    
    // Configurar UI
    setupEventListeners();
    await cargarCuentas();
    await cargarHistorial();
    mostrarNombreUsuario();
    
  } catch (error) {
    console.error('Error en inicialización:', error);
    window.location.replace('/index.html');
  }
}

// Mostrar nombre del usuario en la navbar
function mostrarNombreUsuario() {
  const nombreElement = document.getElementById('userName');
  const nombre = currentUser.user_metadata?.full_name?.split(' ')[0] || currentUser.email;
  nombreElement.textContent = nombre;
}

// Cargar cuentas del usuario
async function cargarCuentas() {
  const { data: cuentas, error } = await supabase
    .from('cuentas')
    .select('*')
    .eq('user_id', currentUser.id);

  const selectCuenta = document.getElementById('cuentaOrigen');
  
  if (error) {
    console.error('Error cargando cuentas:', error);
    selectCuenta.innerHTML = '<option value="">Error al cargar cuentas</option>';
    return;
  }
  
  if (cuentas && cuentas.length > 0) {
    selectCuenta.innerHTML = cuentas.map(c => `
      <option value="${c.id}">
        ${c.tipo === 'corriente' ? 'Cta. Corriente' : 'Cta. Ahorro'} — ${formatSoles(c.saldo)}
      </option>
    `).join('');
  } else {
    selectCuenta.innerHTML = '<option value="">No hay cuentas disponibles</option>';
  }
}

// Validar formulario antes de mostrar modal
function validarFormulario() {
  const servicio = document.querySelector('input[name="servicioRadio"]:checked');
  const contrato = document.getElementById('contrato').value.trim();
  const monto = parseFloat(document.getElementById('montoPago').value);
  const cuentaId = document.getElementById('cuentaOrigen').value;
  
  // Resetear validaciones
  const form = document.getElementById('formPago');
  form.classList.remove('was-validated');
  
  let isValid = true;
  
  if (!servicio) {
    document.getElementById('servicioFeedback').style.display = 'block';
    isValid = false;
  } else {
    document.getElementById('servicioFeedback').style.display = 'none';
  }
  
  if (!contrato) {
    document.getElementById('contrato').classList.add('is-invalid');
    isValid = false;
  } else {
    document.getElementById('contrato').classList.remove('is-invalid');
  }
  
  if (!monto || monto <= 0) {
    document.getElementById('montoPago').classList.add('is-invalid');
    isValid = false;
  } else {
    document.getElementById('montoPago').classList.remove('is-invalid');
  }
  
  if (!cuentaId) {
    document.getElementById('cuentaOrigen').classList.add('is-invalid');
    isValid = false;
  } else {
    document.getElementById('cuentaOrigen').classList.remove('is-invalid');
  }
  
  if (!isValid) {
    return null;
  }
  
  const selectCuenta = document.getElementById('cuentaOrigen');
  const cuentaLabel = selectCuenta.options[selectCuenta.selectedIndex]?.text;
  
  return {
    servicio: servicio.value,
    contrato: contrato,
    monto: monto,
    cuentaId: cuentaId,
    cuentaLabel: cuentaLabel
  };
}

// Llenar y mostrar modal de confirmación
function mostrarModalConfirmacion(pagoData) {
  document.getElementById('confServicio').textContent = pagoData.servicio.toUpperCase();
  document.getElementById('confContrato').textContent = pagoData.contrato;
  document.getElementById('confMonto').textContent = formatSoles(pagoData.monto);
  document.getElementById('confCuenta').textContent = pagoData.cuentaLabel;
  
  modalConfirmar.show();
}

// Procesar el pago confirmado
async function procesarPago() {
  if (!datosPago) return;
  
  const btnText = document.getElementById('btnConfText');
  const btnSpinner = document.getElementById('btnConfSpinner');
  
  btnText.classList.add('d-none');
  btnSpinner.classList.remove('d-none');
  
  const { error } = await supabase.from('pagos').insert({
    user_id: currentUser.id,
    servicio: datosPago.servicio,
    numero_contrato: datosPago.contrato,
    monto: datosPago.monto,
    estado: 'completado'
  });
  
  btnText.classList.remove('d-none');
  btnSpinner.classList.add('d-none');
  modalConfirmar.hide();
  
  if (error) {
    console.error('Error al guardar pago:', error);
    showToast('Error al procesar el pago. Intenta nuevamente.', 'danger');
    return;
  }
  
  showToast(
    `Pago de ${datosPago.servicio.toUpperCase()} realizado con éxito por ${formatSoles(datosPago.monto)}`,
    'success'
  );
  
  // Resetear formulario
  const form = document.getElementById('formPago');
  form.reset();
  form.classList.remove('was-validated');
  
  // Resetear radio buttons visualmente
  document.querySelectorAll('.btn-check').forEach(radio => {
    radio.checked = false;
  });
  
  datosPago = null;
  
  // Recargar historial
  await cargarHistorial();
}

// Cargar historial de pagos
async function cargarHistorial() {
  const { data: pagos, error } = await supabase
    .from('pagos')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('fecha', { ascending: false })
    .limit(10);
  
  const historialContainer = document.getElementById('historialPagos');
  
  if (error) {
    console.error('Error cargando historial:', error);
    historialContainer.innerHTML = `
      <p class="text-danger text-center py-4">
        <i class="bi bi-exclamation-triangle"></i> Error al cargar historial
      </p>`;
    return;
  }
  
  if (!pagos || pagos.length === 0) {
    historialContainer.innerHTML = `
      <p class="text-muted text-center py-4">
        <i class="bi bi-inbox me-2"></i>Sin pagos registrados aún.
      </p>`;
    return;
  }
  
  historialContainer.innerHTML = `
    <ul class="list-group list-group-flush">
      ${pagos.map(p => `
        <li class="list-group-item d-flex justify-content-between align-items-center px-3">
          <div class="d-flex align-items-center gap-3">
            <div class="rounded-circle bg-primary bg-opacity-10 d-flex align-items-center justify-content-center"
                 style="width:36px;height:36px">
              <i class="bi bi-${iconosServicio[p.servicio] || 'receipt'} text-primary"></i>
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

// Configurar todos los event listeners
function setupEventListeners() {
  // Submit del formulario
  document.getElementById('formPago').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const pagoData = validarFormulario();
    if (pagoData) {
      datosPago = pagoData;
      mostrarModalConfirmacion(pagoData);
    }
  });
  
  // Botón confirmar pago en modal
  document.getElementById('btnConfirmarPago').addEventListener('click', () => {
    procesarPago();
  });
  
  // Botón logout
  document.getElementById('btnLogout').addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.replace('/index.html');
  });
  
  // Limpiar validaciones al escribir en campos
  document.getElementById('contrato').addEventListener('input', (e) => {
    if (e.target.value.trim()) {
      e.target.classList.remove('is-invalid');
    }
  });
  
  document.getElementById('montoPago').addEventListener('input', (e) => {
    if (parseFloat(e.target.value) > 0) {
      e.target.classList.remove('is-invalid');
    }
  });
  
  document.getElementById('cuentaOrigen').addEventListener('change', (e) => {
    if (e.target.value) {
      e.target.classList.remove('is-invalid');
    }
  });
  
  // Radio buttons de servicio - limpiar feedback al seleccionar
  document.querySelectorAll('input[name="servicioRadio"]').forEach(radio => {
    radio.addEventListener('change', () => {
      document.getElementById('servicioFeedback').style.display = 'none';
    });
  });
}

// Iniciar aplicación
init();
