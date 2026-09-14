/**
 * ARTYENTO - Controlador de Encuesta de Satisfacción (Versión Standalone sin CORS)
 * Compatible tanto con file:// como con servidores web.
 */

(function () {
  'use strict';


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
    const loadingEl = document.getElementById('survey-loading');
    const formEl = document.getElementById('survey-form-container');
    const successEl = document.getElementById('survey-success');

    if (loadingEl) loadingEl.style.display = 'none';
    if (formEl) formEl.style.display = 'block';

    setupStarRating('satisfaccion', [
      'Muy insatisfecho',
      'Insatisfecho',
      'Regular',
      'Satisfecho',
      '¡Muy satisfecho!'
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
        const nombre = document.getElementById('survey-respondent-name').value.trim();
        const contacto = document.getElementById('survey-respondent-contact').value.trim();
        const comentarios = (document.getElementById('survey-comments').value || '').trim();
        if (!nombre) return;

        const textoRespuesta = `Hola ARTYENTO, soy ${nombre}${contacto ? ` (${contacto})` : ''}.\n\nMi evaluación:\n- Satisfacción: ${satisfaccion}/5\n- Recomendaría: ${recomendariaVal ? 'Sí' : 'No'}\n- Comentarios: ${comentarios || 'Sin comentarios'}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(textoRespuesta)}`, '_blank');

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
