/** @jsxImportSource hono/jsx/dom */

import { useState, useEffect } from 'hono/jsx'
import { render } from 'hono/jsx/dom'

/**
 * Modal Component for adding symptom notes
 * Uses Hono's client components for lightweight React-like functionality
 */
function SymptomModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [symptomId, setSymptomId] = useState(null)
  const [symptomName, setSymptomName] = useState('')
  const [notes, setNotes] = useState('')
  const [medicationTaken, setMedicationTaken] = useState(false)

  // Global function to open modal (called from HTMX buttons)
  useEffect(() => {
    window.openModal = (id, name) => {
      setSymptomId(id)
      setSymptomName(name)
      setIsOpen(true)
    }
  }, [])

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        closeModal()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  // Listen for successful symptom log from HTMX
  useEffect(() => {
    const handleAfterRequest = (evt) => {
      if (evt.detail.successful && evt.detail.pathInfo.requestPath === '/api/log-symptom') {
        closeModal()
        // Trigger HTMX to reload history
        if (window.htmx) {
          window.htmx.trigger('#history', 'reload-history')
        }
      }
    }
    document.body.addEventListener('htmx:afterRequest', handleAfterRequest)
    return () => document.body.removeEventListener('htmx:afterRequest', handleAfterRequest)
  }, [])

  const closeModal = () => {
    setIsOpen(false)
    setNotes('')
    setMedicationTaken(false)
  }

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      closeModal()
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal show" onClick={handleBackdropClick}>
      <div className="modal-content">
        <h3>{symptomName}</h3>
        <form 
          hx-post="/api/log-symptom" 
          hx-target="#message" 
          hx-swap="innerHTML"
        >
          <input type="hidden" name="type_id" value={symptomId} />
          <div className="form-group">
            <textarea 
              name="notes" 
              placeholder="Detalles opcionales..." 
              maxlength="1000" 
              rows="4"
              value={notes}
              onInput={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="form-group checkbox-group">
            <label>
              <input 
                type="checkbox" 
                name="medication_taken"
                checked={medicationTaken}
                onChange={(e) => setMedicationTaken(e.target.checked)}
              />
              <span>¿Tomé medicación?</span>
            </label>
          </div>
          <div className="modal-actions">
            <button type="submit">Guardar</button>
            <button type="button" className="secondary" onClick={closeModal}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/**
 * Admin Reload Handler
 * Handles automatic list reload after add/delete operations
 */
function AdminReloadHandler() {
  useEffect(() => {
    const handleAfterRequest = (evt) => {
      if (evt.detail.successful) {
        const path = evt.detail.pathInfo.requestPath
        if (path === '/api/admin/add-symptom' || path.startsWith('/api/admin/symptom/')) {
          // Trigger HTMX to reload symptom list
          if (window.htmx) {
            window.htmx.trigger('#symptom-list', 'reload-list')
          }
          // Clear form if add
          if (path === '/api/admin/add-symptom') {
            evt.detail.elt.reset()
          }
        }
      }
    }
    document.body.addEventListener('htmx:afterRequest', handleAfterRequest)
    return () => document.body.removeEventListener('htmx:afterRequest', handleAfterRequest)
  }, [])

  return null
}

// Initialize components when DOM is ready
if (typeof document !== 'undefined') {
  // Mount modal component
  const modalRoot = document.getElementById('modal-root')
  if (modalRoot) {
    render(<SymptomModal />, modalRoot)
  }

  // Mount admin handler on admin page
  const adminRoot = document.getElementById('admin-root')
  if (adminRoot) {
    render(<AdminReloadHandler />, adminRoot)
  }
}
