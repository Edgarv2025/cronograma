/**
 * ARTYENTO - Motor de Calendario y Disponibilidad Visual
 * Manejo mensual interactivo, adaptado a celular y pantallas de escritorio.
 */

import { formatHora12, formatRangoHorario } from './store.js';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const DIAS_SEMANA_CORTO = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export class CalendarEngine {
  constructor() {
    const hoy = new Date();
    this.currentYear = hoy.getFullYear();
    this.currentMonth = hoy.getMonth(); // 0 - 11
  }

  // Navegación
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

  // Generar cuadrícula del mes
  getDaysGrid() {
    const year = this.currentYear;
    const month = this.currentMonth;

    // Primer día del mes
    const firstDayDate = new Date(year, month, 1);
    // Día de la semana (0: Dom, 1: Lun, ..., 6: Sáb) -> Convertir a Lun:0 ... Dom:6
    let startingDay = firstDayDate.getDay() - 1;
    if (startingDay === -1) startingDay = 6; // Si es domingo

    // Total días del mes actual
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Total días del mes anterior
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const grid = [];

    // Días del mes previo
    for (let i = startingDay - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevM = month === 0 ? 11 : month - 1;
      const prevY = month === 0 ? year - 1 : year;
      const pad = (n) => String(n).padStart(2, '0');
      grid.push({
        dayNumber: dayNum,
        dateString: `${prevY}-${pad(prevM + 1)}-${pad(dayNum)}`,
        isCurrentMonth: false,
        isToday: false
      });
    }

    // Días del mes actual
    const hoy = new Date();
    const hoyStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;

    for (let d = 1; d <= daysInMonth; d++) {
      const pad = (n) => String(n).padStart(2, '0');
      const dateStr = `${year}-${pad(month + 1)}-${pad(d)}`;
      grid.push({
        dayNumber: d,
        dateString: dateStr,
        isCurrentMonth: true,
        isToday: dateStr === hoyStr
      });
    }

    // Días del mes siguiente para completar cuadrícula (múltiplo de 7)
    const remaining = (7 - (grid.length % 7)) % 7;
    for (let nextD = 1; nextD <= remaining; nextD++) {
      const nextM = month === 11 ? 0 : month + 1;
      const nextY = month === 11 ? year + 1 : year;
      const pad = (n) => String(n).padStart(2, '0');
      grid.push({
        dayNumber: nextD,
        dateString: `${nextY}-${pad(nextM + 1)}-${pad(nextD)}`,
        isCurrentMonth: false,
        isToday: false
      });
    }

    return grid;
  }

  // Renderizar la vista principal del calendario
  render(containerElement, labelElement, eventos = [], onDaySelect, onEventSelect) {
    if (!containerElement) return;

    if (labelElement) {
      labelElement.textContent = `${this.getMonthName()} ${this.currentYear}`;
    }

    // Mapear eventos por fecha
    const eventosPorFecha = {};
    eventos.forEach(ev => {
      if (!eventosPorFecha[ev.fecha]) {
        eventosPorFecha[ev.fecha] = [];
      }
      eventosPorFecha[ev.fecha].push(ev);
    });

    const grid = this.getDaysGrid();
    containerElement.innerHTML = '';

    grid.forEach(cell => {
      const dayEl = document.createElement('div');
      dayEl.className = `calendar-day-cell ${cell.isCurrentMonth ? 'current-month' : 'other-month'} ${cell.isToday ? 'today' : ''}`;
      dayEl.dataset.date = cell.dateString;

      const dayEvents = eventosPorFecha[cell.dateString] || [];
      const hasEvents = dayEvents.length > 0;

      if (hasEvents) {
        dayEl.classList.add('has-events');
      }

      // Estructura interna de la celda
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

      // Clic en la celda del día
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

  // Renderizar la sección específica de DISPONIBILIDAD
  renderDisponibilidad(containerElement, monthSelectVal, yearSelectVal, eventos = [], onBookDate) {
    if (!containerElement) return;

    const hoy = new Date();
    const year = yearSelectVal ? parseInt(yearSelectVal, 10) : hoy.getFullYear();
    const month = monthSelectVal !== undefined ? parseInt(monthSelectVal, 10) : hoy.getMonth();

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const pad = (n) => String(n).padStart(2, '0');

    // Agrupar eventos de este mes
    const eventosPorFecha = {};
    eventos.forEach(ev => {
      if (!eventosPorFecha[ev.fecha]) eventosPorFecha[ev.fecha] = [];
      eventosPorFecha[ev.fecha].push(ev);
    });

    containerElement.innerHTML = '';

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${pad(month + 1)}-${pad(d)}`;
      const fechaObj = new Date(year, month, d);
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
      card.className = `avail-card ${estadoClase}`;
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
