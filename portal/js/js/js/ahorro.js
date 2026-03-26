import { supabase, requireAuth, formatSoles, formatFecha, showToast } from './supabase.js';

let currentUser = null;

// Inicializar página
async function init() {
  try {
    currentUser = await requireAuth();
    mostrarNombreUsuario();
    configurarEventListeners();
    await cargarDatosAhorro();
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
  document.getElementById('btnLogout').addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.replace('/index.html');
  });
}

// Cargar todos los datos de ahorro
async function cargarDatosAhorro() {
  // Ocultar spinner, mostrar contenido
  document.getElementById('loadingAhorro').classList.add('d-none');
  document.getElementById('contenidoAhorro').classList.remove('d-none');
  
  await Promise.all([
    cargarCuentaAhorro(),
    cargarMovimientos()
  ]);
}

// Cargar cuenta de ahorro y métricas
async function cargarCuentaAhorro() {
  const { data: ahorro, error: ahorroError } = await supabase
    .from('cuentas_ahorro')
    .select('*')
    .eq('user_id', currentUser.id)
    .single();
  
  if (ahorroError) {
    console.error('Error cargando cuenta ahorro:', ahorroError);
    showToast('Error al cargar datos de ahorro', 'danger');
    return;
  }
  
  const { data: cuentaAhorro } = await supabase
    .from('cuentas')
    .select('*')
    .eq('user_id', currentUser.id)
    .eq('tipo', 'ahorro')
    .single();
  
  if (ahorro) {
    const saldo = parseFloat(ahorro.saldo);
    const meta = parseFloat(ahorro.meta_ahorro);
    const pct = Math.min(Math.round((saldo / meta) * 100), 100);
    const falta = meta - saldo;
    
    // Datos principales
    document.getElementById('saldoAhorro').textContent = formatSoles(saldo);
    document.getElementById('tasaAhorro').textContent = `${ahorro.tasa_interes}%`;
    document.getElementById('fechaApertura').textContent = formatFecha(ahorro.fecha_apertura);
    document.getElementById('metaAhorro').textContent = formatSoles(meta);
    
    // Barra de progreso
    document.getElementById('saldoProgreso').textContent = formatSoles(saldo);
    document.getElementById('metaProgreso').textContent = formatSoles(meta);
    document.getElementById('pctProgreso').textContent = `${pct}%`;
    document.getElementById('faltaProgreso').textContent = `Falta: ${formatSoles(Math.max(falta, 0))}`;
    document.getElementById('metaLabel').textContent = `Meta: ${formatSoles(meta)}`;
    document.getElementById('barraProgreso').style.width = `${pct}%`;
    document.getElementById('barraProgreso').textContent = pct >= 10 ? `${pct}%` : '';
    
    // Número de cuenta enmascarado
    if (cuentaAhorro) {
      const num = cuentaAhorro.numero_cuenta;
      document.getElementById('numCuentaAhorro').textContent = `••• ••• ${num.slice(-4)}`;
    }
    
    // Proyección de crecimiento
    generarProyeccion(saldo, ahorro.tasa_interes);
  }
}

// Generar tabla de proyección a 12 meses
function generarProyeccion(saldoInicial, tasaAnual) {
  const tasaMensual = tasaAnual / 100 / 12;
  let saldoProyectado = saldoInicial;
  const filas = [];
  
  for (let mes = 1; mes <= 12; mes++) {
    const interes = saldoProyectado * tasaMensual;
    saldoProyectado += interes;
    const fecha = new Date();
    fecha.setMonth(fecha.getMonth() + mes);
    filas.push(`
      <tr>
        <td>${fecha.toLocaleDateString('es-PE', { month: 'short', year: 'numeric' })}</td>
        <td class="text-end fw-semibold">${formatSoles(saldoProyectado)}</td>
        <td class="text-end text-success">${formatSoles(interes)}</td>
      </tr>
    `);
  }
  
  document.getElementById('tablaProyeccion').innerHTML = filas.join('');
}

// Cargar movimientos de la cuenta
async function cargarMovimientos() {
  const { data: cuentaAhorro } = await supabase
    .from('cuentas')
    .select('id')
    .eq('user_id', currentUser.id)
    .eq('tipo', 'ahorro')
    .single();
  
  if (!cuentaAhorro) return;
  
  const { data: movimientos, error } = await supabase
    .from('transacciones')
    .select('*')
    .eq('user_id', currentUser.id)
    .eq('cuenta_id', cuentaAhorro.id)
    .order('fecha', { ascending: false })
    .limit(10);
  
  const tbody = document.getElementById('movAhorro');
  
  if (error) {
    console.error('Error cargando movimientos:', error);
    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-3 text-danger">Error al cargar movimientos</td></tr>';
    return;
  }
  
  if (movimientos && movimientos.length > 0) {
    tbody.innerHTML = movimientos.map(m => `
      <tr>
        <td class="ps-3 text-muted small">${formatFecha(m.fecha)}</td>
        <td class="fw-semibold small">${m.descripcion}</td>
        <td>
          <span class="badge ${m.tipo === 'debito' ? 'bg-danger' : 'bg-success'} px-2 py-1">
            ${m.tipo === 'debito' ? 'Retiro' : 'Depósito'}
          </span>
        </td>
        <td class="text-end pe-3">
          <span class="${m.tipo === 'debito' ? 'text-danger' : 'text-success'} fw-bold">
            ${m.tipo === 'debito' ? '- ' : '+ '}${formatSoles(m.monto)}
          </span>
        </td>
      </tr>
    `).join('');
  } else {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-3 text-muted">No hay movimientos registrados</td></tr>';
  }
}

// Iniciar
init();
