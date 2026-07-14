/**
 * Contenido flexible de la ficha de personaje (atributos, habilidades,
 * inventario...). Se guarda como JSONB en PostgreSQL, así que su forma
 * puede evolucionar sin migraciones. Cuando el modelo de ficha se
 * estabilice, conviene sustituir este tipo por una interfaz concreta.
 */
export type CharacterSheetData = Record<string, unknown>;

export interface Character {
  id: string;
  name: string;
  level: number;
  sheetData: CharacterSheetData;
}
