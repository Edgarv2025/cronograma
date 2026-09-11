/**
 * ARTYENTO - Capa de Almacenamiento y Lógica de Negocio
 * Gestión de Eventos, Disponibilidad, Cálculos Financieros y Encuestas en localStorage
 */

const STORAGE_KEY_EVENTOS = 'artyento_eventos_v1';
const STORAGE_KEY_ENCUESTAS = 'artyento_encuestas_v1';

// Formato de moneda en Pesos Colombianos (COP)
export function formatCOP(monto) {
  const valor = Number(monto) || 0;
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(valor);
}

// Formato de fecha legible en español
export function formatFecha(fechaStr) {
  if (!fechaStr) return '';
  // Evita desfasaje por zona horaria convirtiendo partes explícitamente
  const [year, month, day] = fechaStr.split('-').map(Number);
  const fecha = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(fecha);
}

// Formato de hora estándar a 12 horas
export function formatHora12(hora24) {
  if (!hora24) return '';
  const [h, m] = hora24.split(':').map(Number);
  const ampm = h >= 12 ? 'p. m.' : 'a. m.';
  const h12 = h % 12 || 12;
  const mStr = m < 10 ? `0${m}` : m;
  return `${h12}:${mStr} ${ampm}`;
}

// Formato de rango horario respetando eventos con horario por confirmar
export function formatRangoHorario(evento) {
  if (!evento) return '';
  if (evento.horarioPorConfirmar || !evento.horaInicio || !evento.horaFinalizacion) {
    return 'Por confirmar';
  }
  return `${formatHora12(evento.horaInicio)} - ${formatHora12(evento.horaFinalizacion)}`;
}

// Convertir "HH:MM" a minutos para comparaciones precisas
export function horaToMinutes(horaStr) {
  if (!horaStr) return 0;
  const [h, m] = horaStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

// Cálculo del estado económico del evento
export function calcularEstadoPago(valorTotal, abono) {
  const valor = Number(valorTotal) || 0;
  const ab = Number(abono) || 0;
  const saldo = valor - ab;

  if (saldo <= 0 && valor > 0) return { estado: 'pagado', label: 'Pagado', class: 'badge-success' };
  if (ab > 0 && saldo > 0) return { estado: 'abono_parcial', label: 'Abono Parcial', class: 'badge-warning' };
  return { estado: 'pendiente', label: 'Pendiente', class: 'badge-danger' };
}

// Generador de ID con formato EVT-YYYY-XXX
export function generarIdEvento(eventosExistentes = []) {
  const year = new Date().getFullYear();
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

// Generador de eventos de Absalón Eventos y reservas oficiales
export function generarEventosAbsalonYHabitel() {
  const year = 2026;
  const eventos = [];

  // Fechas reservadas para Absalón Eventos - Plan Elegance en Hacienda Villa Sofía Subachoque
  const fechasVillaSofia = [
    // Septiembre (26)
    '2026-09-26',
    // Octubre (10, 24, 31)
    '2026-10-10', '2026-10-24', '2026-10-31',
    // Noviembre (1, 7, 14, 15, 16, 21, 28)
    '2026-11-01', '2026-11-07', '2026-11-14', '2026-11-15', '2026-11-16', '2026-11-21', '2026-11-28',
    // Diciembre (5, 11, 12, 18, 19, 20, 26)
    '2026-12-05', '2026-12-11', '2026-12-12', '2026-12-18', '2026-12-19', '2026-12-20', '2026-12-26'
  ];

  let counter = 10;
  fechasVillaSofia.forEach(fecha => {
    counter++;
    const id = `EVT-${year}-${String(counter).padStart(3, '0')}`;
    eventos.push({
      id,
      fecha,
      descripcionServicio: 'Plan Elegance',
      cliente: 'Absalón Eventos',
      contacto: 'Liliana',
      telefono: '+57 3224389761',
      direccion: 'Hacienda Villa Sofía, Subachoque',
      horarioPorConfirmar: true,
      horaInicio: '',
      horaFinalizacion: '',
      valor: 0,
      abono: 0,
      saldo: 0,
      encargado: 'Carlos Morales',
      observaciones: 'Reserva confirmada de fecha para Plan Elegance en Hacienda Villa Sofía, Subachoque. Horarios por confirmar con Liliana. Ningún abono registrado.',
      estadoPago: 'pendiente',
      estadoEncuesta: 'pendiente',
      encuesta: null
    });
  });

  // Evento 12 de septiembre: Plan Prestige en Hotel Habitel
  eventos.push({
    id: `EVT-${year}-030`,
    fecha: '2026-09-12',
    descripcionServicio: 'Plan Prestige',
    cliente: 'Absalón Eventos',
    contacto: 'Edwiin',
    telefono: '+57 3057148113',
    direccion: 'Hotel Habitel, Bogotá',
    horarioPorConfirmar: false,
    horaInicio: '15:00',
    horaFinalizacion: '21:00',
    valor: 0,
    abono: 0,
    saldo: 0,
    encargado: 'Mateo Osorio',
    observaciones: 'Servicio Plan Prestige en Hotel Habitel. Horario de 3:00 p. m. a 9:00 p. m. Contacto principal: Edwiin (+57 3057148113). Ningún abono registrado.',
    estadoPago: 'pendiente',
    estadoEncuesta: 'pendiente',
    encuesta: null
  });

  return eventos;
}

// Datos de demostración enriquecidos para primera carga
export function generarDatosDemo() {
  const year = 2026;

  // Evaluaciones históricas para nutrir el dashboard
  const eventosBase = [
    {
      id: `EVT-${year}-001`,
      fecha: '2026-09-05',
      descripcionServicio: 'Show de Magia y Efectos Especiales',
      cliente: 'Colegio San José Campestre',
      contacto: 'Rectoría / Admisiones',
      telefono: '3157894512',
      direccion: 'Km 7 Vía Las Palmas, Auditorio Principal',
      horarioPorConfirmar: false,
      horaInicio: '10:00',
      horaFinalizacion: '12:30',
      valor: 1800000,
      abono: 1800000,
      saldo: 0,
      encargado: 'Carlos Morales',
      observaciones: 'Celebración día de la familia. Requiere toma de corriente 110V y micrófono inalámbrico.',
      estadoPago: 'pagado',
      estadoEncuesta: 'respondida',
      encuesta: {
        fechaRespuesta: '2026-09-05',
        satisfaccion: 5,
        atencion: 5,
        calidad: 5,
        recomendaria: true,
        comentarios: '¡Increíble espectáculo! Los niños y los padres quedaron fascinados con los trucos y la interacción.'
      }
    },
    {
      id: `EVT-${year}-002`,
      fecha: '2026-09-08',
      descripcionServicio: 'Animación Temática y Taller de Arte',
      cliente: 'Familia Restrepo Gómez',
      contacto: 'Carolina Gómez',
      telefono: '3104561234',
      direccion: 'Carrera 43A # 18 Sur - 45, Salón Social El Poblado',
      horarioPorConfirmar: false,
      horaInicio: '15:00',
      horaFinalizacion: '18:00',
      valor: 1400000,
      abono: 1400000,
      saldo: 0,
      encargado: 'Valeria Henao',
      observaciones: 'Cumpleaños #7 de Sofía. Temática de acuarelas y pintura en lienzo.',
      estadoPago: 'pagado',
      estadoEncuesta: 'respondida',
      encuesta: {
        fechaRespuesta: '2026-09-08',
        satisfaccion: 5,
        atencion: 4,
        calidad: 5,
        recomendaria: true,
        comentarios: 'Excelente puntualidad y el equipo muy profesional. Todos los niños hicieron su propio cuadro.'
      }
    }
  ];

  // Concatenar con los eventos de Absalón Eventos y Hotel Habitel
  const eventosReales = generarEventosAbsalonYHabitel();

  return [...eventosBase, ...eventosReales];
}

// Objeto Store con API pública
export const Store = {
  // Obtener todos los eventos asegurando persistencia de las reservas reales
  getEventos() {
    try {
      const data = localStorage.getItem(STORAGE_KEY_EVENTOS);
      if (!data) {
        const demo = generarDatosDemo();
        this.saveAllEventos(demo);
        return demo;
      }
      const parsed = JSON.parse(data);

      // Verificación de sincronización: asegurar que las 19 reservas de Absalón y Habitel estén presentes
      const tieneAbsalon = parsed.some(e => e.cliente && e.cliente.toLowerCase().includes('absal'));
      if (!tieneAbsalon) {
        const reservas = generarEventosAbsalonYHabitel();
        const merged = [...parsed, ...reservas];
        this.saveAllEventos(merged);
        return merged;
      }

      return parsed;
    } catch (err) {
      console.error('Error al leer eventos de localStorage:', err);
      return [];
    }
  },

  // Guardar lista completa
  saveAllEventos(eventos) {
    try {
      localStorage.setItem(STORAGE_KEY_EVENTOS, JSON.stringify(eventos));
    } catch (err) {
      console.error('Error al guardar en localStorage:', err);
    }
  },

  // Obtener evento por ID
  getEventoById(id) {
    const eventos = this.getEventos();
    return eventos.find(e => e.id === id) || null;
  },

  // Guardar o actualizar un evento
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
        // Preservar encuesta si ya existía
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

  // Eliminar un evento
  deleteEvento(id) {
    const eventos = this.getEventos();
    const filtrados = eventos.filter(e => e.id !== id);
    this.saveAllEventos(filtrados);
    return true;
  },

  // Detección de conflictos de horario en la misma fecha
  // Permite eventos el mismo día si sus horarios NO se solapan
  checkConflict(fecha, horaInicio, horaFinalizacion, excludeId = null, horarioPorConfirmar = false) {
    if (!fecha) return null;

    const eventos = this.getEventos();
    const eventosMismaFecha = eventos.filter(e => e.fecha === fecha && e.id !== excludeId);

    // Si el horario es por confirmar
    if (horarioPorConfirmar || !horaInicio || !horaFinalizacion) {
      if (eventosMismaFecha.length > 0) {
        const ev = eventosMismaFecha[0];
        return {
          conflicto: false,
          advertencia: true,
          eventoExistente: ev,
          mensaje: `Aviso: Ya existe una reserva para este día ("${ev.descripcionServicio}" de ${ev.cliente}). Los horarios están por confirmar.`
        };
      }
      return null;
    }

    const nuevoInicio = horaToMinutes(horaInicio);
    const nuevoFin = horaToMinutes(horaFinalizacion);

    for (const ev of eventosMismaFecha) {
      if (ev.horarioPorConfirmar || !ev.horaInicio || !ev.horaFinalizacion) {
        // Si el evento existente tiene horario por confirmar en la misma fecha, avisar
        return {
          conflicto: false,
          advertencia: true,
          eventoExistente: ev,
          mensaje: `Aviso: El evento "${ev.descripcionServicio}" (${ev.cliente}) tiene horario por confirmar en esta misma fecha.`
        };
      }

      const existInicio = horaToMinutes(ev.horaInicio);
      const existFin = horaToMinutes(ev.horaFinalizacion);

      // Hay solapamiento si: (nuevoInicio < existFin) && (nuevoFin > existInicio)
      if (nuevoInicio < existFin && nuevoFin > existInicio) {
        return {
          conflicto: true,
          advertencia: false,
          eventoExistente: ev,
          mensaje: `Conflicto de horario con el evento "${ev.descripcionServicio}" (${formatHora12(ev.horaInicio)} - ${formatHora12(ev.horaFinalizacion)}) de ${ev.cliente}.`
        };
      }
    }

    return null; // Sin conflicto
  },

  // Actualizar estado de encuesta a 'enviada'
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

  // Guardar respuesta de encuesta completada por el cliente
  saveRespuestaEncuesta(eventoId, respuesta) {
    const eventos = this.getEventos();
    const index = eventos.findIndex(e => e.id === eventoId);
    if (index === -1) return null;

    const encuestaObj = {
      fechaRespuesta: new Date().toISOString().split('T')[0],
      satisfaccion: Number(respuesta.satisfaccion) || 5,
      atencion: Number(respuesta.atencion) || 5,
      calidad: Number(respuesta.calidad) || 5,
      recomendaria: Boolean(respuesta.recomendaria),
      comentarios: (respuesta.comentarios || '').trim()
    };

    eventos[index].estadoEncuesta = 'respondida';
    eventos[index].encuesta = encuestaObj;
    this.saveAllEventos(eventos);

    return eventos[index];
  },

  // Obtener estadísticas consolidadas del Dashboard
  getStats() {
    const eventos = this.getEventos();
    const hoy = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const hoyStr = `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-${pad(hoy.getDate())}`;
    const mesActualStr = `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}`;

    let eventosHoy = 0;
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

    // Calcular días ocupados del mes para estimar disponibilidad
    const diasDelMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
    const diasConEvento = new Set();

    eventos.forEach(ev => {
      // Financiero
      totalContratado += ev.valor || 0;
      totalAbonado += ev.abono || 0;
      totalPendienteCobrar += ev.saldo || 0;

      if (ev.saldo > 0) {
        pendientesPago++;
      }

      // Fechas
      if (ev.fecha === hoyStr) {
        eventosHoy++;
      }

      if (ev.fecha >= hoyStr) {
        // Próximos eventos (hasta 60 días para cubrir todo el cronograma activo)
        const diffTime = new Date(ev.fecha) - new Date(hoyStr);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays <= 60) {
          proximosEventos++;
        }
      }

      if (ev.fecha && ev.fecha.startsWith(mesActualStr)) {
        eventosDelMes++;
        const diaNum = parseInt(ev.fecha.split('-')[2], 10);
        diasConEvento.add(diaNum);
      }

      // Encuestas
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

    const fechasDisponiblesMes = Math.max(0, diasDelMes - diasConEvento.size);
    const promSatisfaccion = encuestasRespondidas > 0 ? (sumaSatisfaccion / encuestasRespondidas).toFixed(1) : '5.0';
    const promAtencion = encuestasRespondidas > 0 ? (sumaAtencion / encuestasRespondidas).toFixed(1) : '5.0';
    const promCalidad = encuestasRespondidas > 0 ? (sumaCalidad / encuestasRespondidas).toFixed(1) : '5.0';
    const pctRecomendacion = encuestasRespondidas > 0 ? Math.round((recomiendanSi / encuestasRespondidas) * 100) : 100;

    // Ordenar evaluaciones por fecha más reciente
    ultimasEvaluaciones.sort((a, b) => (b.fechaRespuesta || b.fecha).localeCompare(a.fechaRespuesta || a.fecha));

    return {
      eventosHoy,
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

  // Resetear a datos de demostración
  resetDemo() {
    const demo = generarDatosDemo();
    this.saveAllEventos(demo);
    return demo;
  },

  // Vaciar todos los eventos
  clearAll() {
    this.saveAllEventos([]);
    return [];
  },

  // Exportar eventos a formato CSV compatible con Microsoft Excel (con BOM UTF-8)
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
