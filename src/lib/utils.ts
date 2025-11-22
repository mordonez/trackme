// Utility functions for formatting dates

export function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  
  if (date.toDateString() === today.toDateString()) {
    return 'Hoy'
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Ayer'
  }
  
  return date.toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

export function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleString('es-ES', {
    hour: '2-digit',
    minute: '2-digit'
  })
}
