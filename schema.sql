-- Tabla para los tipos de síntomas/eventos a trackear
CREATE TABLE IF NOT EXISTS symptom_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabla para los registros de síntomas
CREATE TABLE IF NOT EXISTS symptom_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type_id INTEGER NOT NULL,
  notes TEXT,
  medication_taken INTEGER DEFAULT 0,
  date DATE NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (type_id) REFERENCES symptom_types(id) ON DELETE CASCADE
);

-- Índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_symptom_logs_type ON symptom_logs(type_id);
CREATE INDEX IF NOT EXISTS idx_symptom_logs_date ON symptom_logs(date);

-- Datos de ejemplo (opcional)
INSERT OR IGNORE INTO symptom_types (id, name) VALUES
  (1, 'Dolor de cabeza'),
  (2, 'Alergia'),
  (3, 'Náuseas');
