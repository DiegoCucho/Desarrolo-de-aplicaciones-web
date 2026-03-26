// js/ux-validacion.js
// Validación en tiempo real para formulario de pagos

export function initValidacionPagos() {
    const inputs = {
        servicioRadios: document.querySelectorAll('input[name="servicioRadio"]'),
        contrato: document.getElementById('contrato'),
        monto: document.getElementById('montoPago'),
        cuenta: document.getElementById('cuentaOrigen')
    };
    
    function validarCampo(campo, valor, reglas) {
        if (!campo) return true;
        
        let valido = true;
        let mensaje = '';
        
        if (reglas.required && (!valor || valor === '')) {
            valido = false;
            mensaje = reglas.mensajeRequerido || 'Este campo es obligatorio.';
        } else if (reglas.min && parseFloat(valor) < reglas.min) {
            valido = false;
            mensaje = reglas.mensajeMin || `El valor mínimo es ${reglas.min}.`;
        } else if (reglas.minLength && valor.length < reglas.minLength) {
            valido = false;
            mensaje = reglas.mensajeMinLength || `Mínimo ${reglas.minLength} caracteres.`;
        }
        
        if (valido) {
            campo.classList.remove('is-invalid');
            campo.classList.add('is-valid');
        } else {
            campo.classList.remove('is-valid');
            campo.classList.add('is-invalid');
            const feedback = campo.nextElementSibling?.classList.contains('invalid-feedback') 
                ? campo.nextElementSibling 
                : campo.parentElement?.querySelector('.invalid-feedback');
            if (feedback) feedback.textContent = mensaje;
        }
        
        return valido;
    }
    
    function validarServicio() {
        const seleccionado = Array.from(inputs.servicioRadios).some(radio => radio.checked);
        const btns = document.querySelectorAll('.btn-check');
        
        btns.forEach(radio => {
            const label = radio.closest('.col-6')?.querySelector('label');
            if (label) {
                if (!seleccionado && !radio.checked) {
                    label.classList.add('border-danger');
                } else {
                    label.classList.remove('border-danger');
                }
            }
        });
        
        return seleccionado;
    }
    
    function validarTodo() {
        const validoServicio = validarServicio();
        const validoContrato = validarCampo(inputs.contrato, inputs.contrato?.value, {
            required: true,
            minLength: 5,
            mensajeMinLength: 'El número de contrato debe tener al menos 5 caracteres.'
        });
        const validoMonto = validarCampo(inputs.monto, inputs.monto?.value, {
            required: true,
            min: 1,
            mensajeMin: 'El monto debe ser mayor a S/ 0.00'
        });
        const validoCuenta = validarCampo(inputs.cuenta, inputs.cuenta?.value, {
            required: true,
            mensajeRequerido: 'Selecciona una cuenta de origen.'
        });
        
        return validoServicio && validoContrato && validoMonto && validoCuenta;
    }
    
    if (inputs.contrato) {
        inputs.contrato.addEventListener('input', () => validarTodo());
        inputs.contrato.addEventListener('blur', () => validarTodo());
    }
    
    if (inputs.monto) {
        inputs.monto.addEventListener('input', () => validarTodo());
        inputs.monto.addEventListener('blur', () => validarTodo());
    }
    
    if (inputs.cuenta) {
        inputs.cuenta.addEventListener('change', () => validarTodo());
    }
    
    inputs.servicioRadios.forEach(radio => {
        radio.addEventListener('change', () => validarTodo());
    });
    
    const tooltips = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    if (tooltips.length > 0 && typeof bootstrap !== 'undefined') {
        tooltips.forEach(el => new bootstrap.Tooltip(el));
    }
    
    return { validarTodo };
}
