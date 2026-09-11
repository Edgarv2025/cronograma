/**
 * ARTYENTO - Controlador de Encuesta de Satisfacción (Versión Standalone sin CORS)
 * Compatible tanto con file:// como con servidores web.
 */

(function () {
  'use strict';

  const STORAGE_KEY_EVENTOS = 'artyento_eventos_v2';

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

  function getEventos() {
    try {
      const data = localStorage.getItem(STORAGE_KEY_EVENTOS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  function saveEventos(eventos) {
    try {
      localStorage.setItem(STORAGE_KEY_EVENTOS, JSON.stringify(eventos));
    } catch (e) {
      console.error(e);
    }
  }

  function setupStarRating(groupName, labels) {
    const container = document.getElementById(`stars-${groupName}`);
    const hiddenInput = document.getElementById(`input-val-${groupName}`);
    const labelFeedback = document.getElementById(`label-${groupName}`);

    if (!container || !hiddenInput) return;

    const stars = container.querySelectorAll('.star-btn');

    function updateStars(value) {
      hiddenInput.value = value;
      stars.forEach(s => {
        const val = parseInt(s.dataset.value, 10);
        s.classList.toggle('active', val <= value);
      });

      if (labelFeedback && labels && labels[value - 1]) {
        labelFeedback.textContent = labels[value - 1];
      }
    }

    stars.forEach(s => {
      s.addEventListener('click', () => {
        const val = parseInt(s.dataset.value, 10);
        updateStars(val);
      });
    });

    updateStars(5);
  }

  function inicializarEncuesta() {
    const params = new URLSearchParams(window.location.search);
    const eventoId = params.get('id');

    const loadingEl = document.getElementById('survey-loading');
    const errorEl = document.getElementById('survey-error');
    const formEl = document.getElementById('survey-form-container');
    const successEl = document.getElementById('survey-success');
    const alreadyAnsweredEl = document.getElementById('survey-already-answered');

    if (loadingEl) loadingEl.style.display = 'none';

    if (!eventoId) {
      if (errorEl) {
        errorEl.style.display = 'block';
        document.getElementById('survey-error-msg').textContent = 'No se proporcionó un código de evento en el enlace.';
      }
      return;
    }

    const eventos = getEventos();
    const evento = eventos.find(e => e.id === eventoId);

    if (!evento) {
      if (errorEl) {
        errorEl.style.display = 'block';
        document.getElementById('survey-error-msg').textContent = `No se encontró el evento con código "${eventoId}". Por favor revisa el enlace de WhatsApp.`;
      }
      return;
    }

    if (evento.estadoEncuesta === 'respondida' && evento.encuesta) {
      if (alreadyAnsweredEl) {
        alreadyAnsweredEl.style.display = 'block';
        document.getElementById('already-client').textContent = evento.cliente;
        document.getElementById('already-service').textContent = evento.descripcionServicio;
        document.getElementById('already-stars').textContent = '★'.repeat(evento.encuesta.satisfaccion) + '☆'.repeat(5 - evento.encuesta.satisfaccion);
        document.getElementById('already-comment').textContent = evento.encuesta.comentarios ? `"${evento.encuesta.comentarios}"` : 'Sin comentarios adicionales.';
      }
      return;
    }

    if (formEl) {
      formEl.style.display = 'block';
      document.getElementById('survey-client-name').textContent = evento.cliente;
      document.getElementById('survey-service-name').textContent = evento.descripcionServicio;
      document.getElementById('survey-event-date').textContent = formatFecha(evento.fecha);
      document.getElementById('survey-event-code').textContent = evento.id;
    }

    setupStarRating('satisfaccion', [
      'Muy insatisfecho',
      'Insatisfecho',
      'Regular',
      'Satisfecho',
      '¡Muy satisfecho!'
    ]);

    setupStarRating('atencion', [
      'Mala atención',
      'Regular atención',
      'Buena atención',
      'Muy buena atención',
      '¡Excelente atención!'
    ]);

    setupStarRating('calidad', [
      'Baja calidad',
      'Calidad regular',
      'Buena calidad',
      'Muy buena calidad',
      '¡Excelente calidad!'
    ]);

    let recomendariaVal = true;
    const btnRecoSi = document.getElementById('btn-reco-si');
    const btnRecoNo = document.getElementById('btn-reco-no');

    if (btnRecoSi && btnRecoNo) {
      btnRecoSi.addEventListener('click', () => {
        recomendariaVal = true;
        btnRecoSi.classList.add('selected');
        btnRecoNo.classList.remove('selected');
      });

      btnRecoNo.addEventListener('click', () => {
        recomendariaVal = false;
        btnRecoNo.classList.add('selected');
        btnRecoSi.classList.remove('selected');
      });
    }

    const form = document.getElementById('client-survey-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();

        const satisfaccion = parseInt(document.getElementById('input-val-satisfaccion').value, 10) || 5;
        const atencion = parseInt(document.getElementById('input-val-atencion').value, 10) || 5;
        const calidad = parseInt(document.getElementById('input-val-calidad').value, 10) || 5;
        const comentarios = (document.getElementById('survey-comments').value || '').trim();

        const evs = getEventos();
        const idx = evs.findIndex(item => item.id === evento.id);
        if (idx !== -1) {
          evs[idx].estadoEncuesta = 'respondida';
          evs[idx].encuesta = {
            fechaRespuesta: new Date().toISOString().split('T')[0],
            satisfaccion,
            atencion,
            calidad,
            recomendaria: recomendariaVal,
            comentarios
          };
          saveEventos(evs);
        }

        if (formEl) formEl.style.display = 'none';
        if (successEl) successEl.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarEncuesta);
  } else {
    inicializarEncuesta();
  }

})();
