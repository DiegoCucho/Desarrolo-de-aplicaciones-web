
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
