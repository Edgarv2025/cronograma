/**
 * ARTYENTO - Aplicación Web de Cronograma & Gestión de Eventos
 * Versión Standalone sin dependencias ni restricciones CORS (funciona con doble clic directo file:// y en servidor web).
 */

(function () {
  'use strict';

  const STORAGE_KEY_EVENTOS = 'artyento_eventos_v2';
  const STORAGE_KEY_ENCUESTAS = 'artyento_encuestas_v2';
  const STORAGE_KEY_ENCARGADOS = 'artyento_encargados_v1';
  const DIAS_VISIBLES_CALENDARIO = new Set([4, 5, 6, 0]);
  const DIAS_FESTIVOS_2026 = new Set([
    '2026-01-01', '2026-01-12', '2026-03-23', '2026-04-02', '2026-04-03',
    '2026-05-01', '2026-05-18', '2026-06-08', '2026-06-15', '2026-06-29',
    '2026-07-20', '2026-08-07', '2026-08-17', '2026-10-12', '2026-11-02',
    '2026-11-16', '2026-12-08', '2026-12-25'
  ]);

  function esDiaOperativo(fechaStr, diaSemana) {
    return DIAS_VISIBLES_CALENDARIO.has(diaSemana) || DIAS_FESTIVOS_2026.has(fechaStr);
  }

  // =========================================================================
  // 1. UTILIDADES Y FORMATEADORES
  // =========================================================================

  function formatCOP(monto) {
    const valor = Number(monto) || 0;
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(valor);
  }

  function formatFecha(fechaStr) {
    if (!fechaStr) return '';
    const [year, month, day] = fechaStr.split('-').map(Number);
    const fecha = new Date(year, month - 1, day);
    return new Intl.DateTimeFormat('es-CO', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(fecha);
  }

  async function seleccionarContactoTelefono({ telefonoInput, nombreInput = null }) {
    if (!navigator.contacts || typeof navigator.contacts.select !== 'function') {
      showToast('La selección de contactos no está disponible en este navegador. Escribe el número manualmente.', 'warning');
      return;
    }

    try {
      const contactos = await navigator.contacts.select(['name', 'tel'], { multiple: false });
      const contacto = contactos && contactos[0];
      const telefono = contacto && Array.isArray(contacto.tel) ? contacto.tel[0] : '';
      if (!telefono) {
        showToast('El contacto seleccionado no tiene un número telefónico.', 'warning');
        return;
      }

      telefonoInput.value = telefono;
      if (nombreInput && !nombreInput.value.trim() && contacto.name) {
        nombreInput.value = Array.isArray(contacto.name) ? contacto.name[0] : contacto.name;
      }
      telefonoInput.dispatchEvent(new Event('input', { bubbles: true }));
      showToast('Contacto seleccionado.', 'success');
    } catch (error) {
      if (error.name !== 'AbortError') {
        showToast('No se pudo acceder a los contactos. Escribe el número manualmente.', 'warning');
      }
    }
  }

  function inicializarSelectorContactos() {
    const telefonoEvento = document.getElementById('form-telefono');
    const nombreEvento = document.getElementById('form-contacto');
    const botonEvento = document.getElementById('btn-seleccionar-telefono');
    if (botonEvento && telefonoEvento) {
      botonEvento.onclick = () => seleccionarContactoTelefono({
        telefonoInput: telefonoEvento,
        nombreInput: nombreEvento
      });
    }

    const telefonoEncargado = document.getElementById('encargado-whatsapp-telefono');
    const botonEncargado = document.getElementById('btn-seleccionar-telefono-encargado');
    if (botonEncargado && telefonoEncargado) {
      botonEncargado.onclick = () => seleccionarContactoTelefono({
        telefonoInput: telefonoEncargado
      });
    }
  }

  function formatHora12(hora24) {
    if (!hora24) return '';
    const [h, m] = hora24.split(':').map(Number);
    const ampm = h >= 12 ? 'p. m.' : 'a. m.';
    const h12 = h % 12 || 12;
    const mStr = m < 10 ? `0${m}` : m;
    return `${h12}:${mStr} ${ampm}`;
  }

  function formatRangoHorario(evento) {
    if (!evento) return '';
    if (evento.horarioPorConfirmar || !evento.horaInicio || !evento.horaFinalizacion) {
      return 'Por confirmar';
    }
    return `${formatHora12(evento.horaInicio)} - ${formatHora12(evento.horaFinalizacion)}`;
  }

  function horaToMinutes(horaStr) {
    if (!horaStr) return 0;
    const [h, m] = horaStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  }

  function calcularEstadoPago(valorTotal, abono) {
    const valor = Number(valorTotal) || 0;
    const ab = Number(abono) || 0;
    const saldo = valor - ab;

    if (saldo <= 0 && valor > 0) return { estado: 'pagado', label: 'Pagado', class: 'badge-success' };
    if (ab > 0 && saldo > 0) return { estado: 'abono_parcial', label: 'Abono Parcial', class: 'badge-warning' };
    return { estado: 'pendiente', label: 'Pendiente', class: 'badge-danger' };
  }

  function generarIdEvento(eventosExistentes = []) {
    const year = 2026;
    const prefijo = `EVT-${year}-`;
    let maxNum = 0;

    eventosExistentes.forEach(e => {
      if (e.id && e.id.startsWith(prefijo)) {
        const numPart = parseInt(e.id.replace(prefijo, ''), 10);
        if (!isNaN(numPart) && numPart > maxNum) {
          maxNum = numPart;
        }
      }
    });

    const nextNum = String(maxNum + 1).padStart(3, '0');
    return `${prefijo}${nextNum}`;
  }

  // =========================================================================
  // 2. DATOS REALES: ABSALÓN EVENTOS (LILIANA & EDWIN)
  // =========================================================================

  function generarDatosIniciales() {
    const year = 2026;
    const lista = [];

    // 1. Evento 12 de septiembre: Edwin - Plan Prestige en Hotel Habitel
    lista.push({
      id: `EVT-${year}-001`,
      fecha: '2026-09-12',
      descripcionServicio: 'Plan Prestige',
      cliente: 'Absalón Eventos',
      contacto: 'Edwiin',
      telefono: '+57 3057148113',
      direccion: 'Hotel Habitel, Bogotá',
      horarioPorConfirmar: false,
      horaInicio: '15:00',
      horaFinalizacion: '21:00',
      valor: 600000,
      abono: 150000,
      saldo: 450000,
      encargado: 'Edwiin / ARTYENTO',
      observaciones: 'Servicio Plan Prestige en Hotel Habitel. Horario de 3:00 p. m. a 9:00 p. m. Contacto: Edwiin (+57 3057148113). Abono de $150.000 recibido. Saldo restante: $450.000.',
      estadoPago: 'abono_parcial',
      estadoEncuesta: 'pendiente',
      encuesta: null
    });

    // 2. Fechas reservadas para Liliana (Absalón Eventos) - Plan Elegance en Hacienda Villa Sofía Subachoque
    const fechasLiliana = [
      // Septiembre (26)
      '2026-09-26',
      // Octubre (10, 24, 31)
      '2026-10-10', '2026-10-24', '2026-10-31',
      // Noviembre (1, 7, 14, 15, 16, 21, 28)
      '2026-11-01', '2026-11-07', '2026-11-14', '2026-11-15', '2026-11-16', '2026-11-21', '2026-11-28',
      // Diciembre (5, 11, 12, 18, 19, 20, 26)
      '2026-12-05', '2026-12-11', '2026-12-12', '2026-12-18', '2026-12-19', '2026-12-20', '2026-12-26'
    ];

    let idNum = 1;
    fechasLiliana.forEach(fecha => {
      idNum++;
      lista.push({
        id: `EVT-${year}-${String(idNum).padStart(3, '0')}`,
        fecha: fecha,
        descripcionServicio: 'Plan Elegance',
        cliente: 'Absalón Eventos',
        contacto: 'Liliana',
        telefono: '+57 3224389761',
        direccion: 'Hacienda Villa Sofía, Subachoque',
        horarioPorConfirmar: true,
        horaInicio: '',
        horaFinalizacion: '',
        valor: 500000,
        abono: 0,
        saldo: 500000,
        encargado: 'Edgar dj cool',
        observaciones: 'Reserva confirmada de fecha para Plan Elegance en Hacienda Villa Sofía, Subachoque. Valor de venta $500.000, sin abono. Horarios por confirmar con Liliana.',
        estadoPago: 'pendiente',
        estadoEncuesta: 'pendiente',
        encuesta: null
      });
    });

    return lista;
  }

  // =========================================================================
  // 3. CAPA DE ALMACENAMIENTO (STORE)
  // =========================================================================

  const Store = {
    getEventos() {
      try {
        const data = localStorage.getItem(STORAGE_KEY_EVENTOS);
        if (!data) {
          const iniciales = generarDatosIniciales();
          this.saveAllEventos(iniciales);
          return iniciales;
        }
        const parsed = JSON.parse(data);
        const eventosReales = parsed.filter(e => e.id !== 'EVT-2026-050' && e.id !== 'EVT-2026-051');

        if (eventosReales.length !== parsed.length) {
          this.saveAllEventos(eventosReales);
          return eventosReales;
        }

        // Migrar únicamente las reservas de Liliana para conservar intactos los demás eventos.
        let huboCambiosLiliana = false;
        const eventosMigrados = parsed.map(evento => {
          if ((evento.contacto || '').trim().toLowerCase() !== 'liliana') return evento;
          const actualizado = {
            ...evento,
            valor: 500000,
            saldo: Math.max(0, 500000 - (Number(evento.abono) || 0)),
            encargado: 'Edgar dj cool',
            observaciones: (evento.observaciones || '').replace(/\$550\.000/g, '$500.000')
          };
          if (JSON.stringify(actualizado) !== JSON.stringify(evento)) huboCambiosLiliana = true;
          return actualizado;
        });
        if (huboCambiosLiliana) {
          this.saveAllEventos(eventosMigrados);
          return eventosMigrados;
        }

        // Migración automática: verificar que el evento de Edwin tenga $600.000
        const evEdwin = parsed.find(e => e.contacto && e.contacto.toLowerCase().includes('edw'));
        if (evEdwin && evEdwin.valor !== 600000) {
          const iniciales = generarDatosIniciales();
          this.saveAllEventos(iniciales);
          return iniciales;
        }

        return parsed;
      } catch (err) {
        console.error('Error al acceder a localStorage:', err);
        const iniciales = generarDatosIniciales();
        return iniciales;
      }
    },

    saveAllEventos(eventos) {
      try {
        localStorage.setItem(STORAGE_KEY_EVENTOS, JSON.stringify(eventos));
      } catch (err) {
        console.error('Error al guardar en localStorage:', err);
      }
    },

    getEncargados() {
      const predeterminados = ['Edgar dj cool', 'Diego dj ice'];
      const encargadosAnteriores = ['Carlos Morales', 'Valeria Henao', 'Mateo Osorio', 'Camila Gómez'];
      try {
        const guardados = JSON.parse(localStorage.getItem(STORAGE_KEY_ENCARGADOS) || 'null');
        const personalizados = Array.isArray(guardados)
          ? guardados.filter(nombre => nombre && !encargadosAnteriores.includes(nombre))
          : [];
        const lista = [...new Set([...predeterminados, ...personalizados])];
        if (JSON.stringify(guardados) !== JSON.stringify(lista)) {
          this.saveEncargados(lista);
        }
        return lista;
      } catch (err) {
        return predeterminados;
      }
    },

    saveEncargados(encargados) {
      const lista = [...new Set(['Edgar dj cool', 'Diego dj ice', ...encargados.map(nombre => nombre.trim()).filter(Boolean)])];
      localStorage.setItem(STORAGE_KEY_ENCARGADOS, JSON.stringify(lista));
      return lista;
    },

    getEventoById(id) {
      const eventos = this.getEventos();
      return eventos.find(e => e.id === id) || null;
    },

    saveEvento(eventoData) {
      const eventos = this.getEventos();
      const valor = Number(eventoData.valor) || 0;
      const abono = Number(eventoData.abono) || 0;
      const saldo = Math.max(0, valor - abono);
      const estadoPagoInfo = calcularEstadoPago(valor, abono);

      const horarioPorConfirmar = Boolean(eventoData.horarioPorConfirmar);

      const eventoCompleto = {
        ...eventoData,
        contacto: (eventoData.contacto || '').trim(),
        horarioPorConfirmar,
        horaInicio: horarioPorConfirmar ? '' : (eventoData.horaInicio || ''),
        horaFinalizacion: horarioPorConfirmar ? '' : (eventoData.horaFinalizacion || ''),
        valor,
        abono,
        saldo,
        estadoPago: estadoPagoInfo.estado
      };

      if (!eventoCompleto.id) {
        eventoCompleto.id = generarIdEvento(eventos);
        eventoCompleto.estadoEncuesta = 'pendiente';
        eventoCompleto.encuesta = null;
        eventos.push(eventoCompleto);
      } else {
        const index = eventos.findIndex(e => e.id === eventoCompleto.id);
        if (index !== -1) {
          eventoCompleto.estadoEncuesta = eventos[index].estadoEncuesta || 'pendiente';
          eventoCompleto.encuesta = eventos[index].encuesta || null;
          eventos[index] = eventoCompleto;
        } else {
          eventos.push(eventoCompleto);
        }
      }

      this.saveAllEventos(eventos);
      return eventoCompleto;
    },

    deleteEvento(id) {
      const eventos = this.getEventos();
      const filtrados = eventos.filter(e => e.id !== id);
      this.saveAllEventos(filtrados);
      return true;
    },

    // Detección informativa (Permite registrar múltiples eventos simultáneos sin bloqueo)
    checkConflict(fecha, horaInicio, horaFinalizacion, excludeId = null, horarioPorConfirmar = false) {
      if (!fecha) return null;

      const eventos = this.getEventos();
      const eventosMismaFecha = eventos.filter(e => e.fecha === fecha && e.id !== excludeId);

      if (horarioPorConfirmar || !horaInicio || !horaFinalizacion) {
        if (eventosMismaFecha.length > 0) {
          const ev = eventosMismaFecha[0];
          return {
            conflicto: false,
            advertencia: true,
            eventoExistente: ev,
            mensaje: `Aviso: Ya existe reserva programada para este día ("${ev.descripcionServicio}" de ${ev.cliente}).`
          };
        }
        return null;
      }

      const nuevoInicio = horaToMinutes(horaInicio);
      const nuevoFin = horaToMinutes(horaFinalizacion);

      for (const ev of eventosMismaFecha) {
        if (ev.horarioPorConfirmar || !ev.horaInicio || !ev.horaFinalizacion) {
          return {
            conflicto: false,
            advertencia: true,
            eventoExistente: ev,
            mensaje: `Aviso: El evento "${ev.descripcionServicio}" (${ev.cliente}) tiene horario por confirmar en esta misma fecha.`
          };
        }

        const existInicio = horaToMinutes(ev.horaInicio);
        const existFin = horaToMinutes(ev.horaFinalizacion);

        if (nuevoInicio < existFin && nuevoFin > existInicio) {
          return {
            conflicto: true,
            advertencia: false,
            eventoExistente: ev,
            mensaje: `Atención: Coincide en horario con "${ev.descripcionServicio}" (${formatHora12(ev.horaInicio)} - ${formatHora12(ev.horaFinalizacion)}) de ${ev.cliente}.`
          };
        }
      }

      return null;
    },

    marcarEncuestaEnviada(id) {
      const eventos = this.getEventos();
      const index = eventos.findIndex(e => e.id === id);
      if (index !== -1) {
        if (eventos[index].estadoEncuesta !== 'respondida') {
          eventos[index].estadoEncuesta = 'enviada';
          this.saveAllEventos(eventos);
        }
        return eventos[index];
      }
      return null;
    },

    getStats() {
      const eventos = this.getEventos();
      const hoy = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const hoyStr = `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-${pad(hoy.getDate())}`;
      const mesActualStr = `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}`;

      let eventosFinDeSemana = 0;
      let proximosEventos = 0;
      let eventosDelMes = 0;
      let pendientesPago = 0;
      let totalContratado = 0;
      let totalAbonado = 0;
      let totalPendienteCobrar = 0;

      let encuestasEnviadas = 0;
      let encuestasRespondidas = 0;
      let sumaSatisfaccion = 0;
      let sumaAtencion = 0;
      let sumaCalidad = 0;
      let recomiendanSi = 0;
      const ultimasEvaluaciones = [];

      const diasDelMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
      const diasOperativosMes = Array.from({ length: diasDelMes }, (_, indice) => {
        const fecha = new Date(hoy.getFullYear(), hoy.getMonth(), indice + 1);
        const fechaStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(indice + 1).padStart(2, '0')}`;
        return esDiaOperativo(fechaStr, fecha.getDay());
      }).filter(Boolean).length;
      const diasConEvento = new Set();
      const inicioFinDeSemana = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
      const diaActual = inicioFinDeSemana.getDay();
      if (diaActual >= 1 && diaActual <= 4) {
        inicioFinDeSemana.setDate(inicioFinDeSemana.getDate() + (5 - diaActual));
      } else if (diaActual === 0) {
        inicioFinDeSemana.setDate(inicioFinDeSemana.getDate() - 2);
      }
      const finFinDeSemana = new Date(inicioFinDeSemana);
      finFinDeSemana.setDate(inicioFinDeSemana.getDate() + 2);

      eventos.forEach(ev => {
        totalContratado += ev.valor || 0;
        totalAbonado += ev.abono || 0;
        totalPendienteCobrar += ev.saldo || 0;

        if (ev.saldo > 0) {
          pendientesPago++;
        }

        const fechaEvento = ev.fecha ? new Date(`${ev.fecha}T12:00:00`) : null;
        if (fechaEvento && fechaEvento >= inicioFinDeSemana && fechaEvento <= finFinDeSemana) {
          eventosFinDeSemana++;
        }

        if (ev.fecha >= hoyStr) {
          proximosEventos++;
        }

        if (ev.fecha && ev.fecha.startsWith(mesActualStr)) {
          eventosDelMes++;
          const diaNum = parseInt(ev.fecha.split('-')[2], 10);
          const diaEvento = new Date(`${ev.fecha}T12:00:00`).getDay();
          if (esDiaOperativo(ev.fecha, diaEvento)) {
            diasConEvento.add(diaNum);
          }
        }

        if (ev.estadoEncuesta === 'enviada' || ev.estadoEncuesta === 'respondida') {
          encuestasEnviadas++;
        }
        if (ev.estadoEncuesta === 'respondida' && ev.encuesta) {
          encuestasRespondidas++;
          sumaSatisfaccion += ev.encuesta.satisfaccion || 0;
          sumaAtencion += ev.encuesta.atencion || 0;
          sumaCalidad += ev.encuesta.calidad || 0;
          if (ev.encuesta.recomendaria) recomiendanSi++;

          ultimasEvaluaciones.push({
            eventoId: ev.id,
            cliente: ev.cliente,
            servicio: ev.descripcionServicio,
            fecha: ev.fecha,
            ...ev.encuesta
          });
        }
      });

      const fechasDisponiblesMes = Math.max(0, diasOperativosMes - diasConEvento.size);
      const promSatisfaccion = encuestasRespondidas > 0 ? (sumaSatisfaccion / encuestasRespondidas).toFixed(1) : '5.0';
      const promAtencion = encuestasRespondidas > 0 ? (sumaAtencion / encuestasRespondidas).toFixed(1) : '5.0';
      const promCalidad = encuestasRespondidas > 0 ? (sumaCalidad / encuestasRespondidas).toFixed(1) : '5.0';
      const pctRecomendacion = encuestasRespondidas > 0 ? Math.round((recomiendanSi / encuestasRespondidas) * 100) : 100;

      ultimasEvaluaciones.sort((a, b) => (b.fechaRespuesta || b.fecha).localeCompare(a.fechaRespuesta || a.fecha));

      return {
        eventosFinDeSemana,
        proximosEventos,
        eventosDelMes,
        fechasDisponiblesMes,
        pendientesPago,
        totalContratado,
        totalAbonado,
        totalPendienteCobrar,
        encuestasEnviadas,
        encuestasRespondidas,
        promSatisfaccion,
        promAtencion,
        promCalidad,
        pctRecomendacion,
        ultimasEvaluaciones: ultimasEvaluaciones.slice(0, 5)
      };
    },

    resetDemo() {
      const iniciales = generarDatosIniciales();
      this.saveAllEventos(iniciales);
      return iniciales;
    },

    clearAll() {
      this.saveAllEventos([]);
      return [];
    },

    exportToCSV(eventos = null) {
      const lista = eventos || this.getEventos();
      const headers = [
        'ID',
        'Fecha',
        'Servicio / Descripción',
        'Cliente',
        'Contacto',
        'Teléfono',
        'Dirección / Lugar',
        'Horario',
        'Hora Inicio',
        'Hora Finalización',
        'Valor Total (COP)',
        'Abono (COP)',
        'Saldo Pendiente (COP)',
        'Encargado',
        'Estado Pago',
        'Estado Encuesta',
        'Calificación Satisfacción',
        'Observaciones'
      ];

      const rows = lista.map(e => {
        const calif = e.encuesta ? `${e.encuesta.satisfaccion}/5` : 'Sin responder';
        const horarioStr = formatRangoHorario(e);

        return [
          `"${e.id || ''}"`,
          `"${e.fecha || ''}"`,
          `"${(e.descripcionServicio || '').replace(/"/g, '""')}"`,
          `"${(e.cliente || '').replace(/"/g, '""')}"`,
          `"${(e.contacto || '').replace(/"/g, '""')}"`,
          `"${(e.telefono || '').replace(/"/g, '""')}"`,
          `"${(e.direccion || '').replace(/"/g, '""')}"`,
          `"${horarioStr}"`,
          `"${e.horaInicio || ''}"`,
          `"${e.horaFinalizacion || ''}"`,
          e.valor || 0,
          e.abono || 0,
          e.saldo || 0,
          `"${(e.encargado || '').replace(/"/g, '""')}"`,
          `"${e.estadoPago || ''}"`,
          `"${e.estadoEncuesta || ''}"`,
          `"${calif}"`,
          `"${(e.observaciones || '').replace(/"/g, '""')}"`
        ].join(';');
      });

      const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `cronograma_artyento_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // =========================================================================
  // 4. MOTOR DE CALENDARIO & DISPONIBILIDAD
  // =========================================================================

  const MESES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  const DIAS_SEMANA_CORTO = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  class CalendarEngine {
    constructor() {
      const hoy = new Date();
      this.currentYear = hoy.getFullYear();
      this.currentMonth = hoy.getMonth();
    }

    nextMonth() {
      this.currentMonth++;
      if (this.currentMonth > 11) {
        this.currentMonth = 0;
        this.currentYear++;
      }
    }

    prevMonth() {
      this.currentMonth--;
      if (this.currentMonth < 0) {
        this.currentMonth = 11;
        this.currentYear--;
      }
    }

    goToToday() {
      const hoy = new Date();
      this.currentYear = hoy.getFullYear();
      this.currentMonth = hoy.getMonth();
    }

    setMonthYear(year, month) {
      this.currentYear = parseInt(year, 10);
      this.currentMonth = parseInt(month, 10);
    }

    getMonthName(monthIndex = this.currentMonth) {
      return MESES[monthIndex];
    }

    getDaysGrid() {
      const year = this.currentYear;
      const month = this.currentMonth;

      const firstDayDate = new Date(year, month, 1);
      let startingDay = firstDayDate.getDay() - 1;
      if (startingDay === -1) startingDay = 6;

      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const daysInPrevMonth = new Date(year, month, 0).getDate();

      const grid = [];
      const pad = (n) => String(n).padStart(2, '0');

      for (let i = startingDay - 1; i >= 0; i--) {
        const dayNum = daysInPrevMonth - i;
        const prevM = month === 0 ? 11 : month - 1;
        const prevY = month === 0 ? year - 1 : year;
        grid.push({
          dayNumber: dayNum,
          dateString: `${prevY}-${pad(prevM + 1)}-${pad(dayNum)}`,
          isCurrentMonth: false,
          isToday: false
        });
      }

      const hoy = new Date();
      const hoyStr = `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-${pad(hoy.getDate())}`;

      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${pad(month + 1)}-${pad(d)}`;
        grid.push({
          dayNumber: d,
          dateString: dateStr,
          isCurrentMonth: true,
          isToday: dateStr === hoyStr
        });
      }

      const remaining = (7 - (grid.length % 7)) % 7;
      for (let nextD = 1; nextD <= remaining; nextD++) {
        const nextM = month === 11 ? 0 : month + 1;
        const nextY = month === 11 ? year + 1 : year;
        grid.push({
          dayNumber: nextD,
          dateString: `${nextY}-${pad(nextM + 1)}-${pad(nextD)}`,
          isCurrentMonth: false,
          isToday: false
        });
      }

      return grid;
    }

    render(containerElement, labelElement, eventos = [], onDaySelect, onEventSelect) {
      if (!containerElement) return;

      if (labelElement) {
        labelElement.textContent = `${this.getMonthName()} ${this.currentYear}`;
      }

      const eventosPorFecha = {};
      eventos.forEach(ev => {
        if (!eventosPorFecha[ev.fecha]) eventosPorFecha[ev.fecha] = [];
        eventosPorFecha[ev.fecha].push(ev);
      });

      const grid = this.getDaysGrid();
      containerElement.innerHTML = '';

      grid.forEach(cell => {
        const dayEl = document.createElement('div');
        const esSabado = new Date(`${cell.dateString}T12:00:00`).getDay() === 6;
        dayEl.className = `calendar-day-cell ${cell.isCurrentMonth ? 'current-month' : 'other-month'} ${cell.isToday ? 'today' : ''} ${esSabado ? 'saturday' : ''}`;
        dayEl.dataset.date = cell.dateString;

        const dayEvents = eventosPorFecha[cell.dateString] || [];
        const hasEvents = dayEvents.length > 0;

        if (hasEvents) {
          dayEl.classList.add('has-events');
        }

        let dotsHtml = '';
        if (hasEvents) {
          const dotsCount = Math.min(dayEvents.length, 3);
          dotsHtml = `<div class="day-dots-wrap">` +
            Array(dotsCount).fill('<span class="mobile-event-dot"></span>').join('') +
            (dayEvents.length > 3 ? `<span style="font-size:9px;color:var(--color-primary);font-weight:700;">+${dayEvents.length - 3}</span>` : '') +
            `</div>`;
        }

        let eventsListHtml = '<div class="day-events-container">';
        dayEvents.forEach(ev => {
          const badgeTime = ev.horarioPorConfirmar ? 'Por confirmar' : (ev.horaInicio || 'Agendado');
          eventsListHtml += `
            <div class="event-chip" data-event-id="${ev.id}" title="${formatRangoHorario(ev)} - ${ev.descripcionServicio} (${ev.cliente})">
              <span>${badgeTime}</span> ${ev.descripcionServicio}
            </div>
          `;
        });
        eventsListHtml += '</div>';

        dayEl.innerHTML = `
          <div class="day-number">${cell.dayNumber}</div>
          ${eventsListHtml}
          ${dotsHtml}
        `;

        dayEl.addEventListener('click', (e) => {
          const chip = e.target.closest('.event-chip');
          if (chip && onEventSelect) {
            e.stopPropagation();
            const eventId = chip.dataset.eventId;
            const ev = eventos.find(item => item.id === eventId);
            if (ev) onEventSelect(ev);
          } else if (onDaySelect) {
            onDaySelect(cell.dateString, dayEvents);
          }
        });

        containerElement.appendChild(dayEl);
      });
    }

    renderDisponibilidad(containerElement, monthSelectVal, yearSelectVal, eventos = [], onBookDate) {
      if (!containerElement) return;

      const hoy = new Date();
      const year = yearSelectVal ? parseInt(yearSelectVal, 10) : hoy.getFullYear();
      const month = monthSelectVal !== undefined ? parseInt(monthSelectVal, 10) : hoy.getMonth();

      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const pad = (n) => String(n).padStart(2, '0');

      const eventosPorFecha = {};
      eventos.forEach(ev => {
        if (!eventosPorFecha[ev.fecha]) eventosPorFecha[ev.fecha] = [];
        eventosPorFecha[ev.fecha].push(ev);
      });

      containerElement.innerHTML = '';

      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${pad(month + 1)}-${pad(d)}`;
        const fechaObj = new Date(year, month, d);
        if (!esDiaOperativo(dateStr, fechaObj.getDay())) continue;
        const diaSemana = DIAS_SEMANA_CORTO[fechaObj.getDay() === 0 ? 6 : fechaObj.getDay() - 1];
        const evs = eventosPorFecha[dateStr] || [];

        let estadoClase = 'status-disponible';
        let estadoTexto = 'Disponible';
        let badgeClase = 'badge-success';
        let detalleOcupacion = '<span style="color:var(--color-success);font-weight:600;">Todo el día disponible</span>';

        if (evs.length === 0) {
          estadoClase = 'status-disponible';
          estadoTexto = 'Libre';
          badgeClase = 'badge-success';
        } else if (evs.some(e => e.horarioPorConfirmar)) {
          estadoClase = 'status-parcial';
          estadoTexto = 'Reservado';
          badgeClase = 'badge-warning';
          const listaReservas = evs.map(e => `${e.descripcionServicio} (${e.cliente || 'Reserva'})`).join(', ');
          detalleOcupacion = `
            <span><strong>Fecha con reserva:</strong> ${listaReservas}</span>
            <span style="color:var(--color-warning);font-size:11.5px;font-weight:600;">Horarios por confirmar</span>
          `;
        } else if (evs.length <= 2) {
          estadoClase = 'status-parcial';
          estadoTexto = 'Parcial';
          badgeClase = 'badge-warning';

          const horarios = evs.map(e => `${formatHora12(e.horaInicio)} - ${formatHora12(e.horaFinalizacion)}`).join(', ');
          detalleOcupacion = `
            <span><strong>Ocupado:</strong> ${horarios}</span>
            <span style="color:var(--color-warning);font-size:11px;">Franjas horarias libres disponibles</span>
          `;
        } else {
          estadoClase = 'status-ocupado';
          estadoTexto = 'Ocupado';
          badgeClase = 'badge-danger';
          detalleOcupacion = `<span><strong>${evs.length} eventos programados</strong></span>`;
        }

        const card = document.createElement('div');
        card.className = `avail-card ${estadoClase} ${fechaObj.getDay() === 6 ? 'saturday' : ''}`;
        card.innerHTML = `
          <div class="avail-card-header">
            <div>
              <div class="avail-date-num">${d} ${this.getMonthName(month)}</div>
              <div class="avail-date-name">${diaSemana} · ${dateStr}</div>
            </div>
            <span class="badge ${badgeClase}">${estadoTexto}</span>
          </div>
          <div class="avail-events-summary">
            ${detalleOcupacion}
          </div>
          <button class="btn btn-sm ${estadoClase === 'status-ocupado' ? 'btn-secondary' : 'btn-outline'} btn-block btn-reservar-dia" data-date="${dateStr}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
            ${estadoClase === 'status-ocupado' ? 'Ver detalles' : 'Reservar este día'}
          </button>
        `;

        card.querySelector('.btn-reservar-dia').addEventListener('click', (e) => {
          e.stopPropagation();
          if (onBookDate) {
            onBookDate(dateStr, evs);
          }
        });

        containerElement.appendChild(card);
      }
    }
  }

  // =========================================================================
  // 5. CONTROLADOR PRINCIPAL DE LA INTERFAZ
  // =========================================================================

  const calendar = new CalendarEngine();

  const AppState = {
    currentView: 'dashboard',
    selectedEventId: null,
    deleteTargetId: null,
    searchQuery: '',
    filterMonth: '',
    filterEstadoPago: '',
    filterEncargado: '',
    sortOrder: 'asc'
  };

  function showToast(mensaje, tipo = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;
    toast.innerHTML = `<span>${mensaje}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  function switchView(viewName) {
    AppState.currentView = viewName;

    document.querySelectorAll('.view-section').forEach(sec => {
      sec.classList.remove('active');
    });
    const targetSection = document.getElementById(`view-${viewName}`);
    if (targetSection) {
      targetSection.classList.add('active');
    }

    document.querySelectorAll('.sidebar .nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === viewName);
    });

    document.querySelectorAll('.bottom-nav .bottom-nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === viewName);
    });

    if (viewName === 'dashboard') {
      renderDashboard();
    } else if (viewName === 'calendar') {
      renderCalendarView();
    } else if (viewName === 'week') {
      renderWeekView();
    } else if (viewName === 'events') {
      renderEventsListView();
    } else if (viewName === 'availability') {
      renderAvailabilityView();
    } else if (viewName === 'form') {
      if (!AppState.selectedEventId) {
        resetEventForm();
      }
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderDashboard() {
    const stats = Store.getStats();

    const elFinDeSemana = document.getElementById('dash-eventos-fin-semana');
    const elProx = document.getElementById('dash-proximos');
    const elMes = document.getElementById('dash-mes');
    const elDisp = document.getElementById('dash-disponibles');
    const elPendPago = document.getElementById('dash-pend-pago');

    if (elFinDeSemana) elFinDeSemana.textContent = stats.eventosFinDeSemana;
    if (elProx) elProx.textContent = stats.proximosEventos;
    if (elMes) elMes.textContent = stats.eventosDelMes;
    if (elDisp) elDisp.textContent = stats.fechasDisponiblesMes;
    if (elPendPago) elPendPago.textContent = stats.pendientesPago;

    const elTotalContratado = document.getElementById('dash-total-contratado');
    const elTotalAbonado = document.getElementById('dash-total-abonado');
    const elTotalPendiente = document.getElementById('dash-total-pendiente');

    if (elTotalContratado) elTotalContratado.textContent = formatCOP(stats.totalContratado);
    if (elTotalAbonado) elTotalAbonado.textContent = formatCOP(stats.totalAbonado);
    if (elTotalPendiente) elTotalPendiente.textContent = formatCOP(stats.totalPendienteCobrar);

    const elSatEnviadas = document.getElementById('sat-enviadas');
    const elSatRespondidas = document.getElementById('sat-respondidas');
    const elSatPromedio = document.getElementById('sat-promedio');
    const elSatRecomienda = document.getElementById('sat-recomienda');
    const elReviewsContainer = document.getElementById('dash-recent-reviews');

    if (elSatEnviadas) elSatEnviadas.textContent = stats.encuestasEnviadas;
    if (elSatRespondidas) elSatRespondidas.textContent = stats.encuestasRespondidas;
    if (elSatPromedio) elSatPromedio.innerHTML = `${stats.promSatisfaccion} <span class="star">★</span>`;
    if (elSatRecomienda) elSatRecomienda.textContent = `${stats.pctRecomendacion}%`;

    if (elReviewsContainer) {
      if (stats.ultimasEvaluaciones.length === 0) {
        elReviewsContainer.innerHTML = `
          <div style="text-align:center;padding:16px;color:var(--text-muted);font-size:13px;">
            Aún no se han recibido respuestas de encuestas de clientes.
          </div>
        `;
      } else {
        elReviewsContainer.innerHTML = stats.ultimasEvaluaciones.map(rev => `
          <div class="review-card">
            <div class="review-card-header">
              <span class="review-client-name">${rev.cliente}</span>
              <span class="review-stars">${'★'.repeat(rev.satisfaccion)}${'☆'.repeat(5 - rev.satisfaccion)}</span>
            </div>
            <div class="review-service-date">${rev.servicio} · ${formatFecha(rev.fechaRespuesta || rev.fecha)}</div>
            <div class="review-comment">"${rev.comentarios || 'Sin comentarios adicionales.'}"</div>
          </div>
        `).join('');
      }
    }
  }

  function actualizarListadosEncargados(valorSeleccionado = '') {
    const encargados = Store.getEncargados();
    const formSelect = document.getElementById('form-encargado');
    const filterSelect = document.getElementById('filter-encargado');
    const filtroActual = filterSelect ? filterSelect.value : '';

    if (formSelect) {
      formSelect.innerHTML = '<option value="">Sin asignar</option>';
      encargados.forEach(nombre => {
        const option = document.createElement('option');
        option.value = nombre;
        option.textContent = nombre;
        formSelect.appendChild(option);
      });
      formSelect.value = valorSeleccionado;
    }

    if (filterSelect) {
      filterSelect.innerHTML = '<option value="">Encargado: Todos</option>';
      encargados.forEach(nombre => {
        const option = document.createElement('option');
        option.value = nombre;
        option.textContent = nombre;
        filterSelect.appendChild(option);
      });
      filterSelect.value = encargados.includes(filtroActual) ? filtroActual : '';
    }
  }

  function inicializarEncargados() {
    actualizarListadosEncargados();

    const inputNuevo = document.getElementById('nuevo-encargado');
    const btnAgregar = document.getElementById('btn-agregar-encargado');
    const btnEliminar = document.getElementById('btn-eliminar-encargado');
    const formSelect = document.getElementById('form-encargado');

    if (btnAgregar) {
      btnAgregar.onclick = () => {
        const nombre = inputNuevo ? inputNuevo.value.trim() : '';
        if (!nombre) return;
        const encargados = Store.saveEncargados([...Store.getEncargados(), nombre]);
        actualizarListadosEncargados(nombre);
        if (inputNuevo) inputNuevo.value = '';
        showToast(`Encargado agregado: ${nombre}`, 'success');
      };
    }

    if (btnEliminar) {
      btnEliminar.onclick = () => {
        const nombre = formSelect ? formSelect.value : '';
        if (!nombre) return;
        const encargados = Store.getEncargados().filter(item => item !== nombre);
        Store.saveEncargados(encargados);
        actualizarListadosEncargados();
        showToast(`Encargado eliminado: ${nombre}`, 'warning');
      };
    }
  }

  function renderCalendarView() {
    const container = document.getElementById('calendar-days-container');
    const label = document.getElementById('calendar-month-name');
    const eventos = Store.getEventos().filter(evento => {
      const dia = new Date(`${evento.fecha}T12:00:00`).getDay();
      return esDiaOperativo(evento.fecha, dia);
    });

    calendar.render(
      container,
      label,
      eventos,
      (fecha, eventosDelDia) => {
        openDayDetailsModal(fecha, eventosDelDia);
      },
      (evento) => {
        openEventDetailsModal(evento);
      }
    );
  }

  function getNumeroSemanaISO(fecha) {
    const fechaUTC = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()));
    const dia = fechaUTC.getUTCDay() || 7;
    fechaUTC.setUTCDate(fechaUTC.getUTCDate() + 4 - dia);
    const inicioAno = new Date(Date.UTC(fechaUTC.getUTCFullYear(), 0, 1));
    return Math.ceil((((fechaUTC - inicioAno) / 86400000) + 1) / 7);
  }

  function getInicioSemanaISO(year, week) {
    const inicio = new Date(year, 0, 4, 12);
    const dia = inicio.getDay() || 7;
    inicio.setDate(inicio.getDate() - dia + 1 + ((week - 1) * 7));
    return inicio;
  }

  function formatFechaCompleta(fecha) {
    return new Intl.DateTimeFormat('es-CO', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(fecha);
  }

  function renderWeekView() {
    const yearSelect = document.getElementById('week-year-select');
    const weekInput = document.getElementById('week-number-input');
    const rangeLabel = document.getElementById('week-range-label');
    const container = document.getElementById('week-events-list');
    if (!container) return;

    const hoy = new Date();
    const year = parseInt(yearSelect ? yearSelect.value : hoy.getFullYear(), 10);
    let week = parseInt(weekInput ? weekInput.value : getNumeroSemanaISO(hoy), 10);
    week = Math.max(1, Math.min(53, Number.isNaN(week) ? 1 : week));
    if (weekInput) weekInput.value = week;

    const inicio = getInicioSemanaISO(year, week);
    const fin = new Date(inicio);
    fin.setDate(fin.getDate() + 6);
    if (rangeLabel) {
      rangeLabel.textContent = `Semana ${week}: ${formatFecha(inicio.toISOString().slice(0, 10))} - ${formatFecha(fin.toISOString().slice(0, 10))}`;
    }

    const eventos = Store.getEventos().filter(evento => {
      const fechaEvento = new Date(`${evento.fecha}T12:00:00`);
      return fechaEvento >= inicio && fechaEvento <= fin;
    }).sort((a, b) => a.fecha.localeCompare(b.fecha));

    if (eventos.length === 0) {
      container.innerHTML = '<div class="week-empty">No hay eventos registrados en esta semana.</div>';
      return;
    }

    container.innerHTML = eventos.map(evento => `
      <article class="week-event-card ${new Date(`${evento.fecha}T12:00:00`).getDay() === 6 ? 'saturday' : ''}">
        <div class="week-event-heading">
          <div>
            <div class="week-event-date">${formatFechaCompleta(new Date(`${evento.fecha}T12:00:00`))}</div>
            <h2>${evento.descripcionServicio || 'Evento sin servicio'}</h2>
            <div class="week-event-client">${evento.cliente || 'Cliente sin registrar'}</div>
          </div>
          <span class="badge ${evento.estadoPago === 'pagado' ? 'badge-success' : evento.estadoPago === 'abono_parcial' ? 'badge-warning' : 'badge-danger'}">${evento.estadoPago || 'pendiente'}</span>
        </div>
        <div class="week-event-details">
          <div><strong>Horario:</strong> ${formatRangoHorario(evento)}</div>
          <div><strong>Contacto:</strong> ${evento.contacto || 'Sin especificar'}${evento.telefono ? ` · ${evento.telefono}` : ''}</div>
          <div><strong>Dirección:</strong> ${evento.direccion || 'Sin dirección'}</div>
          <div><strong>Encargado:</strong> ${evento.encargado || 'Sin asignar'}</div>
          <div><strong>Valor:</strong> ${formatCOP(evento.valor)} · <strong>Abono:</strong> ${formatCOP(evento.abono)} · <strong>Saldo:</strong> ${formatCOP(evento.saldo)}</div>
          <div><strong>Observaciones:</strong> ${evento.observaciones || 'Sin observaciones'}</div>
        </div>
        <div class="week-event-actions">
          <button class="btn btn-sm btn-secondary btn-week-detail" data-id="${evento.id}">Ver detalles</button>
          <button class="btn btn-sm btn-outline btn-week-edit" data-id="${evento.id}">Editar</button>
        </div>
      </article>
    `).join('');

    container.querySelectorAll('.btn-week-detail').forEach(btn => {
      btn.onclick = () => openEventDetailsModal(Store.getEventoById(btn.dataset.id));
    });
    container.querySelectorAll('.btn-week-edit').forEach(btn => {
      btn.onclick = () => cargarEventoParaEditar(btn.dataset.id);
    });
  }

  function renderAvailabilityView() {
    const container = document.getElementById('availability-grid-container');
    const monthSelect = document.getElementById('avail-month-select');
    const yearSelect = document.getElementById('avail-year-select');

    const hoy = new Date();
    if (monthSelect && !monthSelect.value) {
      monthSelect.value = hoy.getMonth();
    }
    if (yearSelect && !yearSelect.value) {
      yearSelect.value = hoy.getFullYear();
    }

    const mVal = monthSelect ? parseInt(monthSelect.value, 10) : hoy.getMonth();
    const yVal = yearSelect ? parseInt(yearSelect.value, 10) : hoy.getFullYear();
    const eventos = Store.getEventos().filter(evento => {
      const dia = new Date(`${evento.fecha}T12:00:00`).getDay();
      return esDiaOperativo(evento.fecha, dia);
    });

    calendar.renderDisponibilidad(container, mVal, yVal, eventos, (fecha, eventosDelDia) => {
      if (eventosDelDia.length > 0 && eventosDelDia.length >= 3) {
        openDayDetailsModal(fecha, eventosDelDia);
      } else {
        prepararNuevoEventoConFecha(fecha);
      }
    });
  }

  function getEncuestaBadge(evento) {
    if (evento.estadoEncuesta === 'respondida' && evento.encuesta) {
      return `<span class="badge badge-success" title="Encuesta Respondida: ${evento.encuesta.satisfaccion} estrellas">★ ${evento.encuesta.satisfaccion}/5</span>`;
    }
    if (evento.estadoEncuesta === 'enviada') {
      return `<span class="badge badge-info">Encuesta Enviada</span>`;
    }
    return `<span class="badge badge-gray">Encuesta Pendiente</span>`;
  }

  function renderEventsListView() {
    const tableBody = document.getElementById('events-table-body');
    const mobileList = document.getElementById('events-mobile-list');
    const countBadge = document.getElementById('events-count-badge');

    let eventos = Store.getEventos();

    if (AppState.searchQuery) {
      const q = AppState.searchQuery.toLowerCase().trim();
      eventos = eventos.filter(e => 
        (e.cliente || '').toLowerCase().includes(q) ||
        (e.contacto || '').toLowerCase().includes(q) ||
        (e.descripcionServicio || '').toLowerCase().includes(q) ||
        (e.direccion || '').toLowerCase().includes(q) ||
        (e.encargado || '').toLowerCase().includes(q)
      );
    }

    if (AppState.filterMonth) {
      eventos = eventos.filter(e => e.fecha && e.fecha.startsWith(AppState.filterMonth));
    }

    if (AppState.filterEstadoPago) {
      eventos = eventos.filter(e => e.estadoPago === AppState.filterEstadoPago);
    }

    if (AppState.filterEncargado) {
      eventos = eventos.filter(e => e.encargado === AppState.filterEncargado);
    }

    eventos.sort((a, b) => {
      const timeA = `${a.fecha} ${a.horaInicio || '00:00'}`;
      const timeB = `${b.fecha} ${b.horaInicio || '00:00'}`;
      return AppState.sortOrder === 'asc' ? timeA.localeCompare(timeB) : timeB.localeCompare(timeA);
    });

    if (countBadge) countBadge.textContent = `${eventos.length} eventos`;

    if (tableBody) {
      if (eventos.length === 0) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="11" class="text-center" style="padding:30px;color:var(--text-muted);">
              No se encontraron eventos con los filtros seleccionados.
            </td>
          </tr>
        `;
      } else {
        tableBody.innerHTML = eventos.map(e => {
          const estadoInfo = calcularEstadoPago(e.valor, e.abono);
          const encuestaBadge = getEncuestaBadge(e);
          const horarioDisplay = e.horarioPorConfirmar 
            ? '<span class="badge badge-warning">Por confirmar</span>' 
            : formatRangoHorario(e);

          return `
            <tr data-event-id="${e.id}">
              <td><strong>${formatFecha(e.fecha)}</strong></td>
              <td>${horarioDisplay}</td>
              <td><strong>${e.descripcionServicio}</strong></td>
              <td>
                <strong>${e.cliente}</strong>
                ${e.contacto ? `<br><span style="font-size:11.5px;color:var(--text-muted);font-weight:600;">Contacto: ${e.contacto}</span>` : ''}
              </td>
              <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${e.direccion}">${e.direccion}</td>
              <td>${formatCOP(e.valor)}</td>
              <td>${formatCOP(e.abono)}</td>
              <td style="font-weight:700;color:${e.saldo > 0 ? 'var(--color-danger)' : 'var(--color-success)'};">${formatCOP(e.saldo)}</td>
              <td>${e.encargado || '-'}</td>
              <td>
                <span class="badge ${estadoInfo.class}">${estadoInfo.label}</span>
                ${encuestaBadge}
              </td>
              <td class="col-actions">
                <div style="display:flex;gap:4px;">
                  <button class="btn btn-sm btn-secondary btn-icon-only btn-ver-evento" title="Ver Detalle" data-id="${e.id}">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  </button>
                  <button class="btn btn-sm btn-whatsapp btn-icon-only btn-wa-encuesta" title="WhatsApp Encuesta" data-id="${e.id}">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/></svg>
                  </button>
                  <button class="btn btn-sm btn-outline btn-icon-only btn-editar-evento" title="Editar" data-id="${e.id}">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button class="btn btn-sm btn-danger btn-icon-only btn-eliminar-evento" title="Eliminar" data-id="${e.id}">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                </div>
              </td>
            </tr>
          `;
        }).join('');
      }
    }

    if (mobileList) {
      if (eventos.length === 0) {
        mobileList.innerHTML = `
          <div style="text-align:center;padding:30px;background:var(--bg-surface);border-radius:var(--radius-lg);color:var(--text-muted);border:1px solid var(--border-color);">
            No se encontraron eventos con los filtros seleccionados.
          </div>
        `;
      } else {
        mobileList.innerHTML = eventos.map(e => {
          const estadoInfo = calcularEstadoPago(e.valor, e.abono);
          const encuestaBadge = getEncuestaBadge(e);

          return `
            <div class="event-card-mobile" data-event-id="${e.id}">
              <div class="event-card-top">
                <div>
                  <div class="event-card-title">${e.descripcionServicio}</div>
                  <div class="event-card-client">
                    ${e.cliente}
                    ${e.contacto ? ` · <span style="color:#475569;font-weight:600;">${e.contacto}</span>` : ''}
                  </div>
                </div>
                <span class="badge ${estadoInfo.class}">${estadoInfo.label}</span>
              </div>

              <div class="event-card-meta">
                <div class="meta-row">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  <span><strong>${formatFecha(e.fecha)}</strong> (${formatRangoHorario(e)})</span>
                </div>
                <div class="meta-row">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  <span>${e.direccion || 'Sin dirección especificada'}</span>
                </div>
                ${e.telefono ? `
                  <div class="meta-row">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                    <span>${e.telefono}${e.contacto ? ` (${e.contacto})` : ''}</span>
                  </div>
                ` : ''}
              </div>

              <div class="event-card-finance">
                <div>Valor: <strong>${formatCOP(e.valor)}</strong></div>
                <div>Abono: <strong>${formatCOP(e.abono)}</strong></div>
                <div style="font-weight:700;color:${e.saldo > 0 ? 'var(--color-danger)' : 'var(--color-success)'};">
                  Saldo: ${formatCOP(e.saldo)}
                </div>
              </div>

              <div class="event-card-actions">
                <button class="btn btn-sm btn-secondary btn-ver-evento" data-id="${e.id}">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  Detalles
                </button>
                <button class="btn btn-sm btn-whatsapp btn-wa-encuesta" data-id="${e.id}">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/></svg>
                  WhatsApp
                </button>
                <button class="btn btn-sm btn-outline btn-editar-evento" data-id="${e.id}">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  Editar
                </button>
                <button class="btn btn-sm btn-danger btn-icon-only btn-eliminar-evento" data-id="${e.id}">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    attachRowActionListeners();
  }

  function attachRowActionListeners() {
    document.querySelectorAll('.btn-ver-evento').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.id;
        const ev = Store.getEventoById(id);
        if (ev) openEventDetailsModal(ev);
      };
    });

    document.querySelectorAll('.btn-editar-evento').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.id;
        cargarEventoParaEditar(id);
      };
    });

    document.querySelectorAll('.btn-eliminar-evento').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.id;
        openDeleteConfirmation(id);
      };
    });

    document.querySelectorAll('.btn-wa-encuesta').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.id;
        const ev = Store.getEventoById(id);
        if (ev) prepararEnvioWhatsApp(ev);
      };
    });
  }

  // =========================================================================
  // 6. FORMULARIO & VALIDACIONES
  // =========================================================================

  function initEventForm() {
    const form = document.getElementById('event-form');
    const inputValor = document.getElementById('form-valor');
    const inputAbono = document.getElementById('form-abono');
    const inputSaldo = document.getElementById('form-saldo');
    const balanceDisplay = document.getElementById('form-balance-display');

    const inputFecha = document.getElementById('form-fecha');
    const inputHoraInicio = document.getElementById('form-hora-inicio');
    const inputHoraFin = document.getElementById('form-hora-fin');
    const checkHoraTBD = document.getElementById('form-hora-tbd');
    const reqHoraInicio = document.getElementById('req-hora-inicio');
    const reqHoraFin = document.getElementById('req-hora-fin');

    const conflictAlert = document.getElementById('conflict-alert');
    const conflictMsg = document.getElementById('conflict-alert-msg');

    function toggleHoraTBD() {
      const esTBD = checkHoraTBD ? checkHoraTBD.checked : false;
      if (inputHoraInicio) {
        inputHoraInicio.disabled = esTBD;
        inputHoraInicio.required = !esTBD;
        if (esTBD) inputHoraInicio.value = '';
      }
      if (inputHoraFin) {
        inputHoraFin.disabled = esTBD;
        inputHoraFin.required = !esTBD;
        if (esTBD) inputHoraFin.value = '';
      }
      if (reqHoraInicio) reqHoraInicio.style.display = esTBD ? 'none' : 'inline';
      if (reqHoraFin) reqHoraFin.style.display = esTBD ? 'none' : 'inline';
      if (conflictAlert && esTBD) conflictAlert.classList.remove('show');
    }

    if (checkHoraTBD) {
      checkHoraTBD.addEventListener('change', toggleHoraTBD);
    }

    function recalcularSaldo() {
      const valor = parseFloat(inputValor.value) || 0;
      const abono = parseFloat(inputAbono.value) || 0;
      const saldo = Math.max(0, valor - abono);

      if (inputSaldo) inputSaldo.value = saldo;
      if (balanceDisplay) {
        balanceDisplay.textContent = formatCOP(saldo);
        balanceDisplay.style.color = saldo > 0 ? 'var(--color-primary)' : 'var(--color-success)';
      }

      if (abono > valor && valor > 0) {
        inputAbono.setCustomValidity('El abono no puede ser mayor que el valor total.');
      } else {
        inputAbono.setCustomValidity('');
      }
    }

    function verificarConflictoHorario() {
      if (checkHoraTBD && checkHoraTBD.checked) {
        if (conflictAlert) conflictAlert.classList.remove('show');
        return;
      }

      const fecha = inputFecha.value;
      const inicio = inputHoraInicio.value;
      const fin = inputHoraFin.value;
      const editId = AppState.selectedEventId;

      if (fecha && inicio && fin) {
        const resultado = Store.checkConflict(fecha, inicio, fin, editId, false);
        if (resultado && resultado.mensaje) {
          if (conflictAlert) {
            conflictAlert.classList.add('show');
            conflictMsg.textContent = `${resultado.mensaje} (Permitido agendar simultáneamente).`;
          }
        } else {
          if (conflictAlert) conflictAlert.classList.remove('show');
        }
      } else {
        if (conflictAlert) conflictAlert.classList.remove('show');
      }
    }

    if (inputValor) inputValor.addEventListener('input', recalcularSaldo);
    if (inputAbono) inputAbono.addEventListener('input', recalcularSaldo);

    if (inputFecha) inputFecha.addEventListener('change', verificarConflictoHorario);
    if (inputHoraInicio) inputHoraInicio.addEventListener('change', verificarConflictoHorario);
    if (inputHoraFin) inputHoraFin.addEventListener('change', verificarConflictoHorario);

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();

        const valor = parseFloat(inputValor.value) || 0;
        const abono = parseFloat(inputAbono.value) || 0;
        const esTBD = checkHoraTBD ? checkHoraTBD.checked : false;
        const inicio = esTBD ? '' : inputHoraInicio.value;
        const fin = esTBD ? '' : inputHoraFin.value;
        const fecha = inputFecha.value;

        if (abono > valor && valor > 0) {
          showToast('El abono no puede superar el valor total del evento.', 'error');
          inputAbono.focus();
          return;
        }

        const inputContacto = document.getElementById('form-contacto');

        const eventoData = {
          id: AppState.selectedEventId || null,
          fecha: fecha,
          descripcionServicio: document.getElementById('form-servicio').value.trim(),
          cliente: document.getElementById('form-cliente').value.trim(),
          contacto: inputContacto ? inputContacto.value.trim() : '',
          telefono: document.getElementById('form-telefono').value.trim(),
          direccion: document.getElementById('form-direccion').value.trim(),
          horarioPorConfirmar: esTBD,
          horaInicio: inicio,
          horaFinalizacion: fin,
          valor: valor,
          abono: abono,
          saldo: Math.max(0, valor - abono),
          encargado: document.getElementById('form-encargado').value.trim(),
          observaciones: document.getElementById('form-observaciones').value.trim()
        };

        Store.saveEvento(eventoData);

        showToast(AppState.selectedEventId ? 'Evento actualizado exitosamente.' : 'Evento registrado exitosamente.', 'success');
        resetEventForm();
        switchView('events');
      });
    }
  }

  function resetEventForm() {
    AppState.selectedEventId = null;
    const form = document.getElementById('event-form');
    if (form) form.reset();

    const inputContacto = document.getElementById('form-contacto');
    if (inputContacto) inputContacto.value = '';

    const checkHoraTBD = document.getElementById('form-hora-tbd');
    if (checkHoraTBD) {
      checkHoraTBD.checked = false;
    }
    const inputHoraInicio = document.getElementById('form-hora-inicio');
    const inputHoraFin = document.getElementById('form-hora-fin');
    if (inputHoraInicio) {
      inputHoraInicio.disabled = false;
      inputHoraInicio.required = true;
    }
    if (inputHoraFin) {
      inputHoraFin.disabled = false;
      inputHoraFin.required = true;
    }
    const reqHoraInicio = document.getElementById('req-hora-inicio');
    const reqHoraFin = document.getElementById('req-hora-fin');
    if (reqHoraInicio) reqHoraInicio.style.display = 'inline';
    if (reqHoraFin) reqHoraFin.style.display = 'inline';

    const title = document.getElementById('form-view-title');
    if (title) title.textContent = 'Registrar Nuevo Evento';

    const btnSubmit = document.getElementById('btn-submit-form');
    if (btnSubmit) btnSubmit.textContent = 'Guardar Evento';

    const balanceDisplay = document.getElementById('form-balance-display');
    if (balanceDisplay) balanceDisplay.textContent = '$ 0 COP';

    const conflictAlert = document.getElementById('conflict-alert');
    if (conflictAlert) conflictAlert.classList.remove('show');

    const inputFecha = document.getElementById('form-fecha');
    if (inputFecha) {
      const hoy = new Date().toISOString().split('T')[0];
      inputFecha.value = hoy;
    }
  }

  function cargarEventoParaEditar(id) {
    const ev = Store.getEventoById(id);
    if (!ev) return;

    AppState.selectedEventId = ev.id;
    switchView('form');

    const title = document.getElementById('form-view-title');
    if (title) title.textContent = `Editar Evento: ${ev.id}`;

    const btnSubmit = document.getElementById('btn-submit-form');
    if (btnSubmit) btnSubmit.textContent = 'Guardar Cambios';

    document.getElementById('form-fecha').value = ev.fecha || '';
    document.getElementById('form-servicio').value = ev.descripcionServicio || '';
    document.getElementById('form-cliente').value = ev.cliente || '';

    const inputContacto = document.getElementById('form-contacto');
    if (inputContacto) inputContacto.value = ev.contacto || '';

    document.getElementById('form-telefono').value = ev.telefono || '';
    document.getElementById('form-direccion').value = ev.direccion || '';

    const checkHoraTBD = document.getElementById('form-hora-tbd');
    const inputHoraInicio = document.getElementById('form-hora-inicio');
    const inputHoraFin = document.getElementById('form-hora-fin');
    const reqHoraInicio = document.getElementById('req-hora-inicio');
    const reqHoraFin = document.getElementById('req-hora-fin');

    const esTBD = Boolean(ev.horarioPorConfirmar);
    if (checkHoraTBD) checkHoraTBD.checked = esTBD;
    if (inputHoraInicio) {
      inputHoraInicio.disabled = esTBD;
      inputHoraInicio.required = !esTBD;
      inputHoraInicio.value = esTBD ? '' : (ev.horaInicio || '');
    }
    if (inputHoraFin) {
      inputHoraFin.disabled = esTBD;
      inputHoraFin.required = !esTBD;
      inputHoraFin.value = esTBD ? '' : (ev.horaFinalizacion || '');
    }
    if (reqHoraInicio) reqHoraInicio.style.display = esTBD ? 'none' : 'inline';
    if (reqHoraFin) reqHoraFin.style.display = esTBD ? 'none' : 'inline';

    document.getElementById('form-valor').value = ev.valor || 0;
    document.getElementById('form-abono').value = ev.abono || 0;
    document.getElementById('form-saldo').value = ev.saldo || 0;
    document.getElementById('form-encargado').value = ev.encargado || '';
    document.getElementById('form-observaciones').value = ev.observaciones || '';

    const balanceDisplay = document.getElementById('form-balance-display');
    if (balanceDisplay) {
      balanceDisplay.textContent = formatCOP(ev.saldo);
    }

    const conflictAlert = document.getElementById('conflict-alert');
    if (conflictAlert) conflictAlert.classList.remove('show');
  }

  function prepararNuevoEventoConFecha(fecha) {
    resetEventForm();
    const inputFecha = document.getElementById('form-fecha');
    if (inputFecha) inputFecha.value = fecha;
    switchView('form');
  }

  // =========================================================================
  // 7. MODALES & ACCIONES
  // =========================================================================

  function openEventDetailsModal(evento) {
    const modal = document.getElementById('modal-event-details');
    if (!modal) return;

    const estadoInfo = calcularEstadoPago(evento.valor, evento.abono);

    document.getElementById('modal-detail-id').textContent = evento.id;
    document.getElementById('modal-detail-servicio').textContent = evento.descripcionServicio;
    document.getElementById('modal-detail-cliente').textContent = evento.cliente;

    const modalContacto = document.getElementById('modal-detail-contacto');
    if (modalContacto) modalContacto.textContent = evento.contacto || 'Sin especificar';

    document.getElementById('modal-detail-telefono').textContent = evento.telefono || 'No registrado';
    document.getElementById('modal-detail-fecha').textContent = `${formatFecha(evento.fecha)} (${formatRangoHorario(evento)})`;
    document.getElementById('modal-detail-direccion').textContent = evento.direccion || 'Sin dirección';
    document.getElementById('modal-detail-encargado').textContent = evento.encargado || 'Sin asignar';
    document.getElementById('modal-detail-observaciones').textContent = evento.observaciones || 'Ninguna';

    document.getElementById('modal-detail-valor').textContent = formatCOP(evento.valor);
    document.getElementById('modal-detail-abono').textContent = formatCOP(evento.abono);
    document.getElementById('modal-detail-saldo').textContent = formatCOP(evento.saldo);

    const badgeEl = document.getElementById('modal-detail-badge-pago');
    if (badgeEl) {
      badgeEl.className = `badge ${estadoInfo.class}`;
      badgeEl.textContent = estadoInfo.label;
    }

    const encStateEl = document.getElementById('modal-detail-encuesta-estado');
    const encResultsEl = document.getElementById('modal-detail-encuesta-resultados');
    const btnVerEncuesta = document.getElementById('btn-modal-ver-encuesta');

    if (evento.estadoEncuesta === 'respondida' && evento.encuesta) {
      encStateEl.innerHTML = `<span class="badge badge-success">Respondida · ${evento.encuesta.satisfaccion}/5 ★</span>`;
      encResultsEl.style.display = 'block';
      encResultsEl.innerHTML = `
        <div style="background:var(--bg-surface-alt);border-radius:var(--radius-md);padding:12px;margin-top:8px;font-size:13px;">
          <div><strong>Satisfacción General:</strong> ${'★'.repeat(evento.encuesta.satisfaccion)} (${evento.encuesta.satisfaccion}/5)</div>
          <div><strong>Atención al Cliente:</strong> ${'★'.repeat(evento.encuesta.atencion)} (${evento.encuesta.atencion}/5)</div>
          <div><strong>Calidad del Servicio:</strong> ${'★'.repeat(evento.encuesta.calidad)} (${evento.encuesta.calidad}/5)</div>
          <div><strong>¿Recomendaría?:</strong> ${evento.encuesta.recomendaria ? 'Sí, totalmente' : 'No'}</div>
          <div style="margin-top:6px;font-style:italic;">"${evento.encuesta.comentarios || 'Sin comentarios'}"</div>
        </div>
      `;
      if (btnVerEncuesta) btnVerEncuesta.style.display = 'inline-flex';
    } else if (evento.estadoEncuesta === 'enviada') {
      encStateEl.innerHTML = `<span class="badge badge-info">Enviada por WhatsApp (Pendiente de respuesta)</span>`;
      encResultsEl.style.display = 'none';
      if (btnVerEncuesta) btnVerEncuesta.style.display = 'none';
    } else {
      encStateEl.innerHTML = `<span class="badge badge-gray">Pendiente por enviar</span>`;
      encResultsEl.style.display = 'none';
      if (btnVerEncuesta) btnVerEncuesta.style.display = 'none';
    }

    const btnEditar = document.getElementById('btn-modal-edit');
    const btnEliminar = document.getElementById('btn-modal-delete');
    const btnWa = document.getElementById('btn-modal-whatsapp');
    const btnImprimir = document.getElementById('btn-modal-print');

    if (btnEditar) {
      btnEditar.onclick = () => {
        closeAllModals();
        cargarEventoParaEditar(evento.id);
      };
    }

    if (btnEliminar) {
      btnEliminar.onclick = () => {
        closeAllModals();
        openDeleteConfirmation(evento.id);
      };
    }

    if (btnWa) {
      btnWa.onclick = () => {
        prepararEnvioWhatsApp(evento);
      };
    }

    const btnWaEncargado = document.getElementById('btn-modal-whatsapp-encargado');
    if (btnWaEncargado) {
      btnWaEncargado.onclick = () => prepararEnvioWhatsAppEncargado(evento);
    }

    if (btnImprimir) {
      btnImprimir.onclick = () => {
        imprimirFichaEvento(evento);
      };
    }

    if (btnVerEncuesta) {
      btnVerEncuesta.onclick = () => {
        const baseURL = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
        window.open(`${baseURL}encuesta.html`, '_blank');
      };
    }

    modal.classList.add('active');
  }

  function openDayDetailsModal(fecha, eventosDelDia) {
    const modal = document.getElementById('modal-day-details');
    if (!modal) return;

    document.getElementById('modal-day-title').textContent = `Agenda: ${formatFecha(fecha)}`;
    const container = document.getElementById('modal-day-events-list');

    if (eventosDelDia.length === 0) {
      container.innerHTML = `
        <div style="text-align:center;padding:24px;color:var(--text-muted);">
          <p>No hay eventos registrados para este día.</p>
          <span class="badge badge-success" style="margin-top:8px;">Fecha Completamente Disponible</span>
        </div>
      `;
    } else {
      container.innerHTML = eventosDelDia.map(e => `
        <div class="event-card-mobile" style="margin-bottom:10px;">
          <div class="event-card-top">
            <div>
              <div class="event-card-title">${e.descripcionServicio}</div>
              <div class="event-card-client">
                ${e.cliente}
                ${e.contacto ? ` · <span style="color:#475569;font-weight:600;">${e.contacto}</span>` : ''}
              </div>
            </div>
            <span class="badge ${calcularEstadoPago(e.valor, e.abono).class}">${calcularEstadoPago(e.valor, e.abono).label}</span>
          </div>
          <div class="event-card-meta">
            <div class="meta-row">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span><strong>${formatRangoHorario(e)}</strong></span>
            </div>
            <div class="meta-row">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              <span>${e.direccion || 'Sin dirección'}</span>
            </div>
            ${e.encargado ? `
              <div class="meta-row">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                <span>Encargado: ${e.encargado}</span>
              </div>
            ` : ''}
          </div>
          <div class="event-card-actions">
            <button class="btn btn-sm btn-secondary btn-ver-dia-ev" data-id="${e.id}">Ver Ficha</button>
            <button class="btn btn-sm btn-outline btn-edit-dia-ev" data-id="${e.id}">Editar</button>
            <button class="btn btn-sm btn-danger btn-del-dia-ev" data-id="${e.id}">Eliminar</button>
          </div>
        </div>
      `).join('');

      container.querySelectorAll('.btn-ver-dia-ev').forEach(btn => {
        btn.onclick = () => {
          closeAllModals();
          const ev = Store.getEventoById(btn.dataset.id);
          if (ev) openEventDetailsModal(ev);
        };
      });

      container.querySelectorAll('.btn-edit-dia-ev').forEach(btn => {
        btn.onclick = () => {
          closeAllModals();
          cargarEventoParaEditar(btn.dataset.id);
        };
      });

      container.querySelectorAll('.btn-del-dia-ev').forEach(btn => {
        btn.onclick = () => {
          closeAllModals();
          openDeleteConfirmation(btn.dataset.id);
        };
      });
    }

    const btnAgregar = document.getElementById('btn-modal-day-add');
    if (btnAgregar) {
      btnAgregar.onclick = () => {
        closeAllModals();
        prepararNuevoEventoConFecha(fecha);
      };
    }

    modal.classList.add('active');
  }

  function openDeleteConfirmation(id) {
    AppState.deleteTargetId = id;
    const modal = document.getElementById('modal-confirm-delete');
    if (!modal) return;

    const ev = Store.getEventoById(id);
    const infoEl = document.getElementById('delete-event-info');
    if (infoEl && ev) {
      infoEl.textContent = `"${ev.descripcionServicio}" de ${ev.cliente} (${formatFecha(ev.fecha)})`;
    }

    modal.classList.add('active');
  }

  function closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
  }

  function crearFichaEventoImagen(evento) {
    const canvas = document.createElement('canvas');
    canvas.width = 1400;
    canvas.height = 1050;
    const context = canvas.getContext('2d');
    const margen = 88;
    const anchoTexto = canvas.width - margen * 2;
    let y = 0;

    context.fillStyle = '#f6f8fb';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#123047';
    context.fillRect(0, 0, canvas.width, 220);
    context.fillStyle = '#ffffff';
    context.font = '700 52px Arial';
    context.fillText('ARTYENTO', margen, 88);
    context.font = '400 25px Arial';
    context.fillText('Ficha de servicio programado', margen, 135);
    context.font = '700 24px Arial';
    context.fillText(evento.id || 'EVENTO', canvas.width - margen - 220, 88);
    context.font = '400 20px Arial';
    context.fillText(new Date().toLocaleDateString('es-CO'), canvas.width - margen - 220, 125);

    y = 285;
    const dibujarSeccion = (titulo, filas) => {
      context.fillStyle = '#d97706';
      context.fillRect(margen, y - 32, 8, 34);
      context.fillStyle = '#123047';
      context.font = '700 25px Arial';
      context.fillText(titulo, margen + 24, y - 6);
      y += 38;
      filas.forEach(([etiqueta, valor]) => {
        context.fillStyle = '#64748b';
        context.font = '700 18px Arial';
        context.fillText(etiqueta.toUpperCase(), margen + 24, y);
        context.fillStyle = '#172033';
        context.font = '400 24px Arial';
        const texto = String(valor || 'Sin registrar');
        const palabras = texto.split(' ');
        let linea = '';
        const lineas = [];
        palabras.forEach(palabra => {
          const candidata = linea ? `${linea} ${palabra}` : palabra;
          if (context.measureText(candidata).width > anchoTexto - 250 && linea) {
            lineas.push(linea);
            linea = palabra;
          } else {
            linea = candidata;
          }
        });
        if (linea) lineas.push(linea);
        lineas.forEach((lineaTexto, indice) => context.fillText(lineaTexto, margen + 250, y + indice * 29));
        y += Math.max(37, lineas.length * 29 + 8);
      });
      y += 25;
    };

    dibujarSeccion('DETALLES DEL SERVICIO', [
      ['Servicio', evento.descripcionServicio],
      ['Cliente', evento.cliente],
      ['Contacto', `${evento.contacto || 'Sin especificar'} · ${evento.telefono || 'Sin teléfono'}`],
      ['Fecha y horario', `${formatFecha(evento.fecha) || 'Sin fecha'} · ${formatRangoHorario(evento)}`],
      ['Lugar', evento.direccion]
    ]);
    dibujarSeccion('INFORMACIÓN OPERATIVA', [
      ['Encargado', evento.encargado],
      ['Observaciones', evento.observaciones || 'Sin observaciones adicionales']
    ]);
    context.fillStyle = '#123047';
    context.fillRect(margen, 960, canvas.width - margen * 2, 2);
    context.fillStyle = '#64748b';
    context.font = '400 18px Arial';
    context.fillText('Documento interno · ARTYENTO Eventos, Artes & Entretenimiento', margen, 1000);
    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  }

  async function prepararEnvioWhatsAppEncargado(evento) {
    const encargado = (evento.encargado || '').trim();
    if (!encargado) {
      showToast('Este evento no tiene un encargado asignado.', 'warning');
      return;
    }

    const claveTelefono = `artyento_telefono_encargado_${encargado.toLowerCase()}`;
    const telefonoInput = document.getElementById('encargado-whatsapp-telefono');
    const nombreEl = document.getElementById('encargado-whatsapp-nombre');
    const previewEl = document.getElementById('encargado-whatsapp-preview');
    const modal = document.getElementById('modal-whatsapp-encargado');
    const recordarInput = document.getElementById('encargado-whatsapp-recordar');
    const confirmarBtn = document.getElementById('btn-confirm-whatsapp-encargado');
    if (!telefonoInput || !previewEl || !modal || !confirmarBtn) return;

    const telefonoGuardado = localStorage.getItem(claveTelefono) || '';
    if (nombreEl) nombreEl.textContent = `Encargado: ${encargado}`;
    telefonoInput.value = telefonoGuardado;
    previewEl.innerHTML = '<strong>Vista previa:</strong><br>Imagen con servicio, cliente, fecha, horario, lugar, encargado y observaciones.';
    confirmarBtn.onclick = () => {
      let telefono = telefonoInput.value.replace(/\D/g, '');
      if (telefono.length === 10 && telefono.startsWith('3')) telefono = `57${telefono}`;
      if (!telefono) {
        showToast('Escribe el número de WhatsApp del encargado.', 'warning');
        telefonoInput.focus();
        return;
      }
      if (recordarInput && recordarInput.checked) localStorage.setItem(claveTelefono, telefono);
      confirmarBtn.disabled = true;
      crearFichaEventoImagen(evento).then(async blob => {
        const nombreArchivo = `ficha_${evento.id || 'evento'}.png`;
        const archivo = new File([blob], nombreArchivo, { type: 'image/png' });
        const mensajeCorto = `Hola ${encargado}, te comparto la ficha del evento ${evento.id || ''}.`;
        closeAllModals();
        if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
          await navigator.share({ title: `Ficha ${evento.id || 'evento'}`, text: mensajeCorto, files: [archivo] });
          return;
        }
        const enlace = document.createElement('a');
        enlace.href = URL.createObjectURL(blob);
        enlace.download = nombreArchivo;
        enlace.click();
        window.open(`https://wa.me/${telefono}?text=${encodeURIComponent(mensajeCorto + ' Adjunta la imagen descargada.')}`, '_blank');
        showToast('Ficha descargada. Adjunta la imagen en WhatsApp.', 'success');
      }).catch(() => showToast('No se pudo generar la ficha.', 'error')).finally(() => {
        confirmarBtn.disabled = false;
      });
    };
    modal.classList.add('active');
  }

  function crearMensajeEncuesta(nombre, saludo = 'Hola') {
    return `${saludo} ${nombre}, muchas gracias por confiar en nosotros para su evento.

Para conocer su experiencia, por favor responda estas preguntas directamente por este chat:

1. ¿Qué tan satisfecho está con nuestro servicio? Responda de 1 a 5.
4. ¿Nos recomendaría a otras personas? Responda Sí o No.
5. ¿Tiene algún comentario u observación?

¡Muchas gracias por ayudarnos a mejorar nuestro servicio!`;
  }

  function prepararEnvioWhatsApp(evento) {
    const nombreSaludo = (evento.contacto || evento.cliente || '').trim();
    const textoMensaje = crearMensajeEncuesta(nombreSaludo);

    const telefonoLimpio = (evento.telefono || '').replace(/\D/g, '');
    let telefonoWA = telefonoLimpio;
    if (telefonoWA.length === 10 && telefonoWA.startsWith('3')) {
      telefonoWA = `57${telefonoWA}`;
    }

    const linkWA = telefonoWA 
      ? `https://wa.me/${telefonoWA}?text=${encodeURIComponent(textoMensaje)}`
      : `https://wa.me/?text=${encodeURIComponent(textoMensaje)}`;

    const modalWA = document.getElementById('modal-whatsapp-preview');
    if (modalWA) {
      document.getElementById('wa-preview-cliente').textContent = evento.cliente;
      document.getElementById('wa-preview-telefono').textContent = evento.telefono || 'Sin número registrado';
      document.getElementById('wa-preview-text').textContent = textoMensaje;

      const btnOpenWA = document.getElementById('btn-confirm-open-wa');
      btnOpenWA.onclick = () => {
        closeAllModals();
        window.open(linkWA, '_blank');
      };

      modalWA.classList.add('active');
    } else {
      window.open(linkWA, '_blank');
    }
  }

  function abrirEnvioEncuestaGeneral() {
    const modal = document.getElementById('modal-general-encuesta');
    const lista = document.getElementById('general-encuesta-contactos');
    const vacio = document.getElementById('general-encuesta-vacio');
    if (!modal || !lista) return;

    const contactos = Store.getEventos().filter(evento => evento.telefono);
    lista.innerHTML = contactos.map(evento => `
      <label style="display:flex;align-items:center;gap:8px;padding:8px;border:1px solid var(--border-color);border-radius:var(--radius-md);">
        <input type="checkbox" class="general-encuesta-contacto" value="${evento.id}">
        <span><strong>${evento.contacto || evento.cliente}</strong><br><small>${evento.telefono} · ${evento.cliente}</small></span>
      </label>
    `).join('');
    vacio.style.display = contactos.length ? 'none' : 'block';
    modal.classList.add('active');

    const btnConfirmar = document.getElementById('btn-confirm-general-encuesta');
    btnConfirmar.onclick = () => {
      const seleccionados = [...document.querySelectorAll('.general-encuesta-contacto:checked')]
        .map(input => contactos.find(evento => evento.id === input.value))
        .filter(Boolean);
      if (!seleccionados.length) {
        showToast('Selecciona al menos un contacto.', 'warning');
        return;
      }

      seleccionados.forEach((evento, indice) => {
        const nombre = (evento.contacto || evento.cliente || '').trim();
        const mensaje = crearMensajeEncuesta(nombre, 'Hola');
        let telefono = evento.telefono.replace(/\D/g, '');
        if (telefono.length === 10 && telefono.startsWith('3')) telefono = `57${telefono}`;
        setTimeout(() => window.open(`https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`, '_blank'), indice * 250);
      });
      closeAllModals();
      showToast(`Se prepararon ${seleccionados.length} mensajes de WhatsApp.`, 'success');
    };
  }

  function imprimirCronograma() {
    document.body.classList.add('print-events');
    window.print();
    setTimeout(() => {
      document.body.classList.remove('print-events');
    }, 1000);
  }

  function imprimirFichaEvento(evento) {
    const printArea = document.getElementById('print-voucher-area');
    if (!printArea) return;

    printArea.innerHTML = `
      <div class="print-header">
        <div class="print-header-top">
          <div>
            <div class="print-brand-title">ARTYENTO</div>
            <div class="print-brand-sub">Eventos, Artes & Entretenimiento · Orden de Servicio</div>
          </div>
          <div class="print-meta">
            <strong>ID Evento:</strong> ${evento.id}<br>
            <strong>Fecha Impresión:</strong> ${new Date().toLocaleDateString('es-CO')}
          </div>
        </div>
      </div>

      <div class="voucher-box">
        <h3 style="margin-bottom:12px;border-bottom:1px solid #ddd;padding-bottom:6px;">Detalles del Servicio Programado</h3>
        <div class="voucher-grid">
          <div><strong>Servicio:</strong> ${evento.descripcionServicio}</div>
          <div><strong>Fecha del Evento:</strong> ${formatFecha(evento.fecha)}</div>
          <div><strong>Cliente:</strong> ${evento.cliente}</div>
          <div><strong>Contacto:</strong> ${evento.contacto || 'Sin especificar'}</div>
          <div><strong>Horario:</strong> ${formatRangoHorario(evento)}</div>
          <div><strong>Teléfono:</strong> ${evento.telefono || 'No registrado'}</div>
          <div><strong>Encargado:</strong> ${evento.encargado || 'Sin asignar'}</div>
          <div style="grid-column:1/-1;"><strong>Lugar / Dirección:</strong> ${evento.direccion}</div>
        </div>
      </div>

      <div class="voucher-box">
        <h3 style="margin-bottom:12px;border-bottom:1px solid #ddd;padding-bottom:6px;">Balance Financiero (COP)</h3>
        <div class="voucher-grid">
          <div><strong>Valor Total Contratado:</strong> ${formatCOP(evento.valor)}</div>
          <div><strong>Abono Recibido:</strong> ${formatCOP(evento.abono)}</div>
          <div><strong>Saldo Pendiente:</strong> ${formatCOP(evento.saldo)}</div>
          <div><strong>Estado de Pago:</strong> ${calcularEstadoPago(evento.valor, evento.abono).label}</div>
        </div>
      </div>

      <div class="voucher-box">
        <h3 style="margin-bottom:8px;border-bottom:1px solid #ddd;padding-bottom:6px;">Observaciones y Requerimientos Técnicos</h3>
        <p style="font-size:10pt;">${evento.observaciones || 'Sin observaciones adicionales.'}</p>
      </div>

      <div class="voucher-signature-area">
        <div class="signature-line">Firma del Cliente<br><small>${evento.cliente}</small></div>
        <div class="signature-line">Firma ARTYENTO<br><small>Coordinación de Eventos</small></div>
      </div>
    `;

    window.print();
  }

  // =========================================================================
  // 8. INICIALIZACIÓN GLOBAL
  // =========================================================================

  function inicializarApp() {
    document.querySelectorAll('.sidebar .nav-item').forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        const view = btn.dataset.view;
        if (view) switchView(view);
      };
    });

    document.querySelectorAll('.bottom-nav .bottom-nav-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        const view = btn.dataset.view;
        if (view) switchView(view);
      };
    });

    document.querySelectorAll('[data-goto-view]').forEach(btn => {
      btn.onclick = () => {
        const view = btn.dataset.gotoView;
        if (view) switchView(view);
      };
    });

    const btnPrevMonth = document.getElementById('btn-cal-prev');
    const btnNextMonth = document.getElementById('btn-cal-next');
    const btnTodayMonth = document.getElementById('btn-cal-today');

    if (btnPrevMonth) {
      btnPrevMonth.onclick = () => {
        calendar.prevMonth();
        renderCalendarView();
      };
    }

    if (btnNextMonth) {
      btnNextMonth.onclick = () => {
        calendar.nextMonth();
        renderCalendarView();
      };
    }

    if (btnTodayMonth) {
      btnTodayMonth.onclick = () => {
        calendar.goToToday();
        renderCalendarView();
      };
    }

    const weekYearSelect = document.getElementById('week-year-select');
    const weekNumberInput = document.getElementById('week-number-input');
    const hoy = new Date();
    const semanaActual = getNumeroSemanaISO(hoy);
    if (weekYearSelect) weekYearSelect.value = hoy.getFullYear();
    if (weekNumberInput) weekNumberInput.value = semanaActual;
    if (weekYearSelect) weekYearSelect.onchange = renderWeekView;
    if (weekNumberInput) weekNumberInput.onchange = renderWeekView;

    const cambiarSemana = (incremento) => {
      const year = parseInt(weekYearSelect.value, 10);
      const week = parseInt(weekNumberInput.value, 10);
      const fecha = getInicioSemanaISO(year, week);
      fecha.setDate(fecha.getDate() + incremento * 7);
      const jueves = new Date(fecha);
      jueves.setDate(jueves.getDate() + 3);
      weekYearSelect.value = jueves.getFullYear();
      weekNumberInput.value = getNumeroSemanaISO(fecha);
      renderWeekView();
    };

    const btnWeekPrev = document.getElementById('btn-week-prev');
    const btnWeekNext = document.getElementById('btn-week-next');
    const btnWeekCurrent = document.getElementById('btn-week-current');
    if (btnWeekPrev) btnWeekPrev.onclick = () => cambiarSemana(-1);
    if (btnWeekNext) btnWeekNext.onclick = () => cambiarSemana(1);
    if (btnWeekCurrent) {
      btnWeekCurrent.onclick = () => {
        weekYearSelect.value = hoy.getFullYear();
        weekNumberInput.value = semanaActual;
        renderWeekView();
      };
    }

    const availMonthSelect = document.getElementById('avail-month-select');
    const availYearSelect = document.getElementById('avail-year-select');
    if (availMonthSelect) availMonthSelect.onchange = renderAvailabilityView;
    if (availYearSelect) availYearSelect.onchange = renderAvailabilityView;

    const searchInput = document.getElementById('filter-search');
    const filterMonthInput = document.getElementById('filter-month');
    const filterEstadoPagoSelect = document.getElementById('filter-estado-pago');
    const filterEncargadoSelect = document.getElementById('filter-encargado');
    const btnSortToggle = document.getElementById('btn-sort-toggle');

    if (searchInput) {
      searchInput.oninput = (e) => {
        AppState.searchQuery = e.target.value;
        renderEventsListView();
      };
    }

    if (filterMonthInput) {
      filterMonthInput.onchange = (e) => {
        AppState.filterMonth = e.target.value;
        renderEventsListView();
      };
    }

    if (filterEstadoPagoSelect) {
      filterEstadoPagoSelect.onchange = (e) => {
        AppState.filterEstadoPago = e.target.value;
        renderEventsListView();
      };
    }

    if (filterEncargadoSelect) {
      filterEncargadoSelect.onchange = (e) => {
        AppState.filterEncargado = e.target.value;
        renderEventsListView();
      };
    }

    if (btnSortToggle) {
      btnSortToggle.onclick = () => {
        AppState.sortOrder = AppState.sortOrder === 'asc' ? 'desc' : 'asc';
        btnSortToggle.textContent = AppState.sortOrder === 'asc' ? 'Fecha: Más antiguos' : 'Fecha: Más recientes';
        renderEventsListView();
      };
    }

    const btnExportCSV = document.getElementById('btn-export-csv');
    if (btnExportCSV) {
      btnExportCSV.onclick = () => {
        Store.exportToCSV();
        showToast('Archivo CSV descargado exitosamente.', 'success');
      };
    }

    const btnPrintSchedule = document.getElementById('btn-print-schedule');
    if (btnPrintSchedule) {
      btnPrintSchedule.onclick = imprimirCronograma;
    }

    const btnGeneralEncuesta = document.getElementById('btn-general-encuesta');
    if (btnGeneralEncuesta) btnGeneralEncuesta.onclick = abrirEnvioEncuestaGeneral;

    document.querySelectorAll('.btn-close-modal, .btn-modal-cancel').forEach(btn => {
      btn.onclick = closeAllModals;
    });

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.onclick = (e) => {
        if (e.target === overlay) closeAllModals();
      };
    });

    const btnConfirmDelete = document.getElementById('btn-confirm-delete-action');
    if (btnConfirmDelete) {
      btnConfirmDelete.onclick = () => {
        if (AppState.deleteTargetId) {
          Store.deleteEvento(AppState.deleteTargetId);
          showToast('Evento eliminado correctamente.', 'warning');
          AppState.deleteTargetId = null;
          closeAllModals();
          renderDashboard();
          renderEventsListView();
          renderCalendarView();
        }
      };
    }

    inicializarEncargados();
    initEventForm();
    inicializarSelectorContactos();
    switchView('dashboard');
  }

  // Ejecución segura tanto en DOMContentLoaded como si el DOM ya cargó
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarApp);
  } else {
    inicializarApp();
  }

})();
