/**
 * Simple client-side JavaScript for HTMX enhancements
 * No React, no useState, no useEffect - just vanilla JS
 */

if (typeof document !== 'undefined') {

  // Cerrar modal con tecla Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const modal = document.querySelector('.modal.show')
      if (modal) modal.remove()
    }
  })

  // Cerrar modal al hacer clic en el backdrop
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal') && e.target.classList.contains('show')) {
      e.target.remove()
    }
  })

  // Manejar eventos HTMX después de las peticiones
  document.body.addEventListener('htmx:afterRequest', (evt) => {
    if (!evt.detail.successful) return

    const path = evt.detail.pathInfo.requestPath

    // Después de registrar un síntoma, cerrar modal y recargar historial
    if (path === '/api/log-symptom') {
      const modal = document.querySelector('.modal.show')
      if (modal) modal.remove()

      // Recargar historial
      if (window.htmx) {
        window.htmx.trigger('#history', 'reload-history')
      }
    }

    // Después de agregar/eliminar síntoma en admin, recargar lista
    if (path === '/api/admin/add-symptom' || path.startsWith('/api/admin/symptom/')) {
      if (window.htmx) {
        window.htmx.trigger('#symptom-list', 'reload-list')
      }

      // Limpiar formulario si fue agregar
      if (path === '/api/admin/add-symptom') {
        evt.detail.elt.reset()
      }
    }
  })
}
