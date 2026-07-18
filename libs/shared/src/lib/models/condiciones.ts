/**
 * Catálogo de condiciones de Pathfinder 1e. La MECÁNICA es contenido de
 * juego abierto (OGL 1.0a); las descripciones en español son propias (no
 * la traducción de Devir, con copyright). Es el primer paso hacia el
 * sistema de efectos: de momento solo describe; más adelante cada
 * condición podrá declarar los modificadores que aplica (−2 CA, etc.).
 *
 * Nota de nombres: "Aturdido" = Stunned (−2 CA) y "Atontado" = Dazed
 * (sin penalización a la CA), para no confundir las dos condiciones.
 */
export interface Condicion {
  /** Clave estable en ascii (se guarda en la BD, no cambiar a la ligera). */
  id: string;
  nombre: string;
  /** Resumen del efecto mecánico, en una línea. */
  descripcion: string;
}

export const CONDICIONES: readonly Condicion[] = [
  {
    id: 'agonizando',
    nombre: 'Agonizando',
    descripcion:
      'PG negativos e inconsciente. Pierde 1 PG por turno hasta estabilizarse, ser curado o morir al llegar a −CON.',
  },
  {
    id: 'asustado',
    nombre: 'Asustado',
    descripcion:
      'Miedo: −2 a ataques, salvaciones, pruebas de característica y de habilidad, y huye de la fuente del miedo si puede.',
  },
  {
    id: 'atontado',
    nombre: 'Atontado',
    descripcion:
      'No puede realizar ninguna acción durante ese turno, pero no sufre penalización a la CA.',
  },
  {
    id: 'aturdido',
    nombre: 'Aturdido',
    descripcion:
      'Suelta lo que sostiene, no puede actuar, −2 a la CA y pierde su bonificador de Destreza a la CA.',
  },
  {
    id: 'cegado',
    nombre: 'Cegado',
    descripcion:
      'No ve: −2 a la CA, pierde su bonificador de Destreza a la CA, se mueve a media velocidad, −4 a muchas pruebas y todo enemigo tiene ocultación total (50% de fallo).',
  },
  {
    id: 'confundido',
    nombre: 'Confundido',
    descripcion:
      'No controla sus actos: cada turno tira en la tabla de confusión (deambula, se hiere, ataca a lo más cercano o actúa con normalidad).',
  },
  {
    id: 'derribado',
    nombre: 'Derribado',
    descripcion:
      'En el suelo: −4 a los ataques cuerpo a cuerpo, +4 a la CA contra ataques a distancia y −4 a la CA contra cuerpo a cuerpo. Levantarse cuesta una acción de movimiento.',
  },
  {
    id: 'deslumbrado',
    nombre: 'Deslumbrado',
    descripcion:
      '−1 a las tiradas de ataque y a las pruebas de Percepción basadas en la vista.',
  },
  {
    id: 'desprevenido',
    nombre: 'Desprevenido',
    descripcion:
      'Aún no ha actuado en combate: pierde el bonificador de Destreza a la CA y no puede hacer ataques de oportunidad.',
  },
  {
    id: 'dormido',
    nombre: 'Dormido',
    descripcion: 'Duerme: inconsciente e indefenso hasta despertar.',
  },
  {
    id: 'encogido',
    nombre: 'Encogido',
    descripcion:
      'Paralizado por el miedo: no puede actuar, −2 a la CA y pierde su bonificador de Destreza a la CA.',
  },
  {
    id: 'enredado',
    nombre: 'Enredado',
    descripcion:
      '−2 a las tiradas de ataque, −4 a la Destreza efectiva, media velocidad, no puede correr ni cargar.',
  },
  {
    id: 'ensordecido',
    nombre: 'Ensordecido',
    descripcion:
      'No oye: −4 a la iniciativa y 20% de fallar al lanzar conjuros con componente verbal.',
  },
  {
    id: 'estable',
    nombre: 'Estable',
    descripcion:
      'Agonizante que ha dejado de perder PG, pero sigue inconsciente.',
  },
  {
    id: 'exhausto',
    nombre: 'Exhausto',
    descripcion:
      '−6 a Fuerza y Destreza y se mueve a media velocidad. Tras descansar 1 hora pasa a Fatigado.',
  },
  {
    id: 'fascinado',
    nombre: 'Fascinado',
    descripcion:
      'Absorto e inmóvil: −4 a Percepción; cualquier amenaza obvia rompe el efecto.',
  },
  {
    id: 'fatigado',
    nombre: 'Fatigado',
    descripcion:
      '−2 a Fuerza y Destreza; no puede correr ni cargar. Un nuevo esfuerzo lo empeora a Exhausto.',
  },
  {
    id: 'incapacitado',
    nombre: 'Incapacitado',
    descripcion:
      'A 0 PG: solo una acción por turno; si es agotadora, pierde 1 PG y queda agonizando.',
  },
  {
    id: 'inconsciente',
    nombre: 'Inconsciente',
    descripcion: 'Fuera de combate y sin sentido: indefenso.',
  },
  {
    id: 'indefenso',
    nombre: 'Indefenso',
    descripcion:
      'Destreza efectiva 0. Los ataques cuerpo a cuerpo contra él reciben +4 y puede sufrir un golpe de gracia.',
  },
  {
    id: 'inmovilizado',
    nombre: 'Inmovilizado',
    descripcion:
      'Presa firmemente sujeta: no puede moverse y queda en desventaja; forma más estricta de Presa.',
  },
  {
    id: 'invisible',
    nombre: 'Invisible',
    descripcion:
      'No se le ve: +2 a las tiradas de ataque y sus objetivos pierden el bonificador de Destreza a la CA frente a él.',
  },
  {
    id: 'mareado',
    nombre: 'Mareado',
    descripcion:
      '−2 a las tiradas de ataque, al daño de arma, a las salvaciones y a las pruebas de característica y de habilidad.',
  },
  {
    id: 'nauseabundo',
    nombre: 'Nauseabundo',
    descripcion:
      'Solo puede realizar una acción de movimiento por turno; no puede atacar, lanzar conjuros ni concentrarse.',
  },
  {
    id: 'paralizado',
    nombre: 'Paralizado',
    descripcion:
      'Fuerza y Destreza efectivas 0: no puede moverse ni actuar y queda indefenso.',
  },
  {
    id: 'petrificado',
    nombre: 'Petrificado',
    descripcion:
      'Convertido en piedra: inconsciente e indefenso, no percibe nada.',
  },
  {
    id: 'presa',
    nombre: 'Presa',
    descripcion:
      'Agarrado en cuerpo a cuerpo: −4 a Destreza efectiva, −2 a ataques y a la mayoría de pruebas, no puede moverse ni usar acciones a dos manos.',
  },
  {
    id: 'preso-panico',
    nombre: 'Preso del pánico',
    descripcion:
      'Miedo intenso: suelta lo que lleva, huye a toda velocidad, −2 a salvaciones y pruebas, y no puede atacar.',
  },
  {
    id: 'sacudido',
    nombre: 'Sacudido',
    descripcion:
      'Miedo leve: −2 a ataques, salvaciones, pruebas de característica y de habilidad.',
  },
  {
    id: 'sangrando',
    nombre: 'Sangrando',
    descripcion:
      'Pierde PG al inicio de cada uno de sus turnos. Se detiene con una prueba de Sanar o cualquier curación mágica.',
  },
  {
    id: 'sin-energia',
    nombre: 'Sin energía',
    descripcion:
      'Tiene uno o más niveles negativos (−1 a casi todo por cada uno); pueden volverse permanentes.',
  },
  {
    id: 'tambaleante',
    nombre: 'Tambaleante',
    descripcion:
      'Solo una acción por turno, de movimiento o estándar (no ambas). Estar a 0 PG lo provoca.',
  },
];

/** Búsqueda O(1) por id, para pintar el nombre y el efecto. */
export const CONDICION_POR_ID: Record<string, Condicion> = Object.fromEntries(
  CONDICIONES.map((condicion) => [condicion.id, condicion]),
);

/** Ids válidos, para validar en el DTO que no llegue basura. */
export const CONDICION_IDS: readonly string[] = CONDICIONES.map((c) => c.id);
