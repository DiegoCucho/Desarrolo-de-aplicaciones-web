import { supabase, requireAuth, formatSoles, formatFecha, showToast } from './supabase.js';

let currentUser = null;
let modalExito = null;

// Fórmula de amortización francesa: C = P × [r(1+r)^n] / [(1+r)^n - 1]
function calcularCuota(monto, plazoMeses, tasaAnual) {
  const r = (tasaAnual / 100) / 12; // tasa mensual
  const n = plazoMeses;
  if (r === 0) return monto / n;
  const factor = Math.pow(1 + r, n);
  return monto * (r * factor) / (factor - 1);
}

// Actualizar simulador y campos del formulario
function actualizarSimulador() {
  const monto = parseInt(document.getElementById('sliderMonto').value);
  const plazo = parseInt(document.getElementById('selectPlazo').value);
  const tasa = parseFloat(document.getElementById('selectTasa').value);
  const cuota = calcularCuota(monto, plazo, tasa);
  const total = cuota * plazo;
  const intereses = total - monto;

  // Actualizar visualización del simulador
  document.getElementById('montoLabel').textContent = formatSoles(monto);
  document.getElementById('cuotaValor').textContent = formatSoles(cuota);
  document.getElementById('totalPagar').textContent = formatSoles(total);
  document.getElementById('totalInteres').textContent = formatSoles(intereses);

  // Sincronizar con el formulario
  document.getElementById('solMonto').value = monto.toLocaleString('es-PE');
  document.getElementById('solPlazo').value = `${plazo} meses`;
  document.getElementById('solTasa').value = `${tasa}% TEA`;
  document.getElementById('solCuota').value = cuota.toFixed(2);
}

// Configurar event listeners del simulador
function configurarSimulador() {
  const elementos = ['sliderMonto', 'selectPlazo', 'selectTasa'];
  elementos.forEach(id => {
    document.getElementById(id).addEventListener('input', actualizarSimulador);
  });
  actualizarSimulador();
}

// Validar formulario con Bootstrap
function validarFormulario() {
  const form = document.getElementById('formPrestamo');
  let isValid = true;

  const proposito = document.getElementById('proposito').value;
  const ingresos = parseFloat(document.getElementById('ingresos').value);
  const chkTerminos = document.getElementById('chkTerminos').checked;

  // Resetear validaciones
  form.classList.remove('was-validated');

  if (!proposito) {
    document.getElementById('proposito').classList.add('is-invalid');
    isValid = false;
  } else {
    document.getElementById('proposito').classList.remove('is-invalid');
  }

  if (!ingresos || ingresos <= 0) {
    document.getElementById('ingresos').classList.add('is-invalid');
    isValid = false;
  } else {
    document.getElementById('ingresos').classList.remove('is-invalid');
  }

  if (!chkTerminos) {
    document.getElementById('chkTerminos').classList.add('is-invalid');
    isValid = false;
  } else {
    document.getElementById('chkTerminos').classList.remove('is-invalid');
  }

  if (!isValid) {
    form.classList.add('was-validated');
  }

  return isValid;
}

// Enviar solicitud de préstamo
async function enviarSolicitud(e) {
  e.preventDefault();

  if (!validarFormulario()) {
    return;
  }

  const proposito = document.getElementById('proposito').value;
  const ingresos = parseFloat(document.getElementById('ingresos').value);
  const monto = parseInt(document.getElementById('sliderMonto').value);
  const plazo = parseInt(document.getElementById('selectPlazo').value);
  const tasa = parseFloat(document.getElementById('selectTasa').value);
  const cuota = calcularCuota(monto, plazo, tasa);

  const btnText = document.getElementById('btnSolText');
  const btnSpinner = document.getElementById('btnSolSpinner');

  btnText.classList.add('d-none');
  btnSpinner.classList.remove('d-none');

  const { data, error } = await supabase.from('solicitudes_prestamo').insert({
    user_id: currentUser.id,
    monto,
    plazo_meses: plazo,
    tasa_anual: tasa,
    cuota_mensual: parseFloat(cuota.toFixed(2)),
    ingresos_mensuales: ingresos,
    proposito,
    estado: 'pendiente'
  }).select().single();

  btnText.classList.remove('d-none');
  btnSpinner.classList.add('d-none');

  if (error) {
    console.error('Error al enviar solicitud:', error);
    showToast('Error al enviar la solicitud. Intenta nuevamente.', 'danger');
    return;
  }

  // Mostrar modal de éxito
  document.getElementById('numSolicitud').textContent = data.id.slice(0, 8).toUpperCase();
  document.getElementById('exitoMonto').textContent = formatSoles(monto);
  document.getElementById('exitoCuota').textContent = formatSoles(cuota);
  modalExito.show();

  // Resetear formulario
  document.getElementById('formPrestamo').reset();
  document.getElementById('formPrestamo').classList.remove('was-validated');
  
  // Resetear campos de validación
  document.getElementById('proposito').classList.remove('is-invalid');
  document.getElementById('ingresos').classList.remove('is-invalid');
  document.getElementById('chkTerminos').classList.remove('is-invalid');

  // Actualizar simulador y recargar solicitudes
  actualizarSimulador();
  await cargarSolicitudes();
}

// Cargar historial de solicitudes
async function cargarSolicitudes() {
  const { data: solicitudes, error } = await supabase
    .from('solicitudes_prestamo')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false })
    .limit(5);

  const container = document.getElementById('listaSolicitudes');

  if (error) {
    console.error('Error cargando solicitudes:', error);
    container.innerHTML = `
      <p class="text-danger text-center py-3 small">
        <i class="bi bi-exclamation-triangle"></i> Error al cargar solicitudes
      </p>`;
    return;
  }

  if (!solicitudes || solicitudes.length === 0) {
    container.innerHTML = `
      <p class="text-muted text-center py-3 small">
        <i class="bi bi-inbox me-2"></i>Sin solicitudes previas.
      </p>`;
    return;
  }

  const estadoColor = {
    pendiente: 'warning',
    aprobado: 'success',
    rechazado: 'danger'
  };

  container.innerHTML = `
    <ul class="list-group list-group-flush">
      ${solicitudes.map(s => `
        <li class="list-group-item d-flex justify-content-between align-items-center px-3">
          <div>
            <div class="fw-semibold small">${formatSoles(s.monto)} · ${s.plazo_meses} meses</div>
            <div class="text-muted" style="font-size:.75rem">
              ID: ${s.id.slice(0, 8).toUpperCase()} · ${formatFecha(s.created_at)}
            </div>
          </div>
          <span class="badge bg-${estadoColor[s.estado] || 'secondary'} text-capitalize">
            ${s.estado === 'pendiente' ? 'En evaluación' : s.estado}
          </span>
        </li>
      `).join('')}
    </ul>`;
}

// Configurar event listeners del formulario
function configurarFormulario() {
  const form = document.getElementById('formPrestamo');
  form.addEventListener('submit', enviarSolicitud);

  // Limpiar validaciones al escribir
  document.getElementById('proposito').addEventListener('change', (e) => {
    if (e.target.value) {
      e.target.classList.remove('is-invalid');
    }
  });

  document.getElementById('ingresos').addEventListener('input', (e) => {
    if (parseFloat(e.target.value) > 0) {
      e.target.classList.remove('is-invalid');
    }
  });

  document.getElementById('chkTerminos').addEventListener('change', (e) => {
    if (e.target.checked) {
      e.target.classList.remove('is-invalid');
    }
  });
}

// Mostrar nombre del usuario
function mostrarNombreUsuario() {
  const nombreElement = document.getElementById('userName');
  const nombre = currentUser.user_metadata?.full_name?.split(' ')[0] || currentUser.email;
  nombreElement.textContent = nombre;
}

// Configurar logout
function configurarLogout() {
  document.getElementById('btnLogout').addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.replace('/index.html');
  });
}

// Inicializar página
async function init() {
  try {
    // Autenticación
    currentUser = await requireAuth();
    
    // Inicializar modal
    modalExito = new bootstrap.Modal(document.getElementById('modalExito'));
    
    // Configurar UI
    mostrarNombreUsuario();
    configurarLogout();
    configurarSimulador();
    configurarFormulario();
    
    // Cargar datos
    await cargarSolicitudes();
    
  } catch (error) {
    console.error('Error en inicialización:', error);
    window.location.replace('/index.html');
  }
}

// Iniciar aplicación
init();
