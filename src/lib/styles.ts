// CSS styles
export const css = `
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

:root {
  --color-bg: #f5f7fa;
  --color-surface: #ffffff;
  --color-primary: #3b82f6;
  --color-primary-dark: #2563eb;
  --color-text: #1e293b;
  --color-text-light: #64748b;
  --color-border: #e2e8f0;
  --color-success: #10b981;
  --color-error: #ef4444;
  --radius: 8px;
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', sans-serif;
  background: var(--color-bg);
  color: var(--color-text);
  line-height: 1.6;
  font-size: 16px;
}

.container {
  max-width: 640px;
  margin: 0 auto;
  padding: 1rem;
}

h1 {
  font-size: 1.875rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  color: var(--color-text);
}

h2 {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 1.5rem 0 0.75rem;
  color: var(--color-text);
}

.card {
  background: var(--color-surface);
  border-radius: var(--radius);
  padding: 1.5rem;
  box-shadow: var(--shadow-sm);
  margin-bottom: 1rem;
}

button, .btn {
  display: inline-block;
  padding: 0.75rem 1.25rem;
  font-size: 0.9375rem;
  font-weight: 500;
  text-align: center;
  border: none;
  border-radius: var(--radius);
  cursor: pointer;
  transition: all 0.15s ease;
  text-decoration: none;
  background: var(--color-primary);
  color: white;
}

button:hover, .btn:hover {
  background: var(--color-primary-dark);
  transform: translateY(-1px);
  box-shadow: var(--shadow);
}

button:active, .btn:active {
  transform: translateY(0);
}

button.secondary {
  background: var(--color-text-light);
}

button.secondary:hover {
  background: var(--color-text);
}

button.outline {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text);
}

button.outline:hover {
  background: var(--color-bg);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

button.danger {
  background: var(--color-error);
}

button.danger:hover {
  background: #dc2626;
}

button.outline.danger {
  background: transparent;
  border: 1px solid var(--color-error);
  color: var(--color-error);
}

button.outline.danger:hover {
  background: var(--color-error);
  color: white;
}

input, textarea {
  width: 100%;
  padding: 0.75rem;
  font-size: 0.9375rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  font-family: inherit;
  transition: all 0.15s ease;
}

input:focus, textarea:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

label {
  display: block;
  font-weight: 500;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  color: var(--color-text);
}

.form-group {
  margin-bottom: 1rem;
}

.checkbox-group {
  display: flex;
  align-items: center;
}

.checkbox-group label {
  display: flex;
  align-items: center;
  cursor: pointer;
  margin-bottom: 0;
  user-select: none;
}

.checkbox-group input[type="checkbox"] {
  width: auto;
  margin-right: 0.5rem;
  cursor: pointer;
  accent-color: var(--color-primary);
}

.checkbox-group span {
  font-size: 0.9375rem;
  font-weight: 500;
}

.symptom-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
  margin: 1rem 0;
}

@media (min-width: 480px) {
  .symptom-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.symptom-btn {
  background: var(--color-primary);
  color: white;
  border: none;
  padding: 1rem;
  border-radius: var(--radius);
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 65px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  box-shadow: var(--shadow-sm);
}

.symptom-btn:hover {
  background: var(--color-primary-dark);
  box-shadow: var(--shadow);
  transform: translateY(-2px);
}

.symptom-btn:active {
  transform: translateY(0);
}

.top-nav {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.top-nav button, .top-nav .btn {
  flex: 1;
  min-width: 120px;
  padding: 0.625rem 1rem;
  font-size: 0.875rem;
}

.history-item {
  background: var(--color-surface);
  border-radius: var(--radius);
  padding: 1rem;
  margin-bottom: 0.75rem;
  box-shadow: var(--shadow-sm);
  border-left: 3px solid var(--color-primary);
}

.history-date {
  color: var(--color-primary);
  font-weight: 600;
  font-size: 0.8125rem;
  margin-bottom: 0.25rem;
  text-transform: uppercase;
}

.history-type {
  font-weight: 600;
  font-size: 1rem;
  margin-bottom: 0.25rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.medication-badge {
  font-size: 1.125rem;
  line-height: 1;
}

.history-notes {
  color: var(--color-text-light);
  font-size: 0.875rem;
  margin-top: 0.5rem;
}

.history-time {
  color: var(--color-text-light);
  font-size: 0.8125rem;
  margin-top: 0.5rem;
}

.modal {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal.show {
  display: flex;
}

.modal-content {
  background: var(--color-surface);
  border-radius: var(--radius);
  padding: 1.5rem;
  max-width: 500px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: var(--shadow-lg);
}

.modal h3 {
  margin-bottom: 1rem;
  font-size: 1.125rem;
}

.modal-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

.symptom-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.symptom-item {
  background: var(--color-surface);
  border-radius: var(--radius);
  padding: 1rem;
  box-shadow: var(--shadow-sm);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.symptom-name {
  font-weight: 600;
  flex: 1;
}

.symptom-date {
  font-size: 0.8125rem;
  color: var(--color-text-light);
  margin-top: 0.25rem;
}

.symptom-item button {
  flex-shrink: 0;
  padding: 0.5rem 0.875rem;
  font-size: 0.875rem;
}

.error, .success {
  padding: 0.75rem 1rem;
  border-radius: var(--radius);
  margin-bottom: 1rem;
  font-size: 0.9375rem;
}

.error {
  background: #fef2f2;
  color: var(--color-error);
  border-left: 3px solid var(--color-error);
}

.success {
  background: #f0fdf4;
  color: var(--color-success);
  border-left: 3px solid var(--color-success);
}

.hidden {
  display: none !important;
}

.loading {
  text-align: center;
  padding: 2rem;
  color: var(--color-text-light);
}

.text-muted {
  color: var(--color-text-light);
}

.w-full {
  width: 100%;
}

.header-section {
  margin: 1rem 0 1.5rem;
}

.subtitle {
  margin-bottom: 1.5rem;
}
`
