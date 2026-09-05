import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LIMITE_HISTORIA } from '@pathfinder/shared';
import { CreateCharacterDto } from './create-character.dto';

/**
 * El ValidationPipe global corre exactamente esto sobre el body. Lo que se
 * prueba aquí es que sheetData ya NO entra sin mirar: el maxlength del
 * formulario es cliente y no frena a nadie que hable con la API a pelo.
 */
async function erroresDe(body: unknown): Promise<string[]> {
  const dto = plainToInstance(CreateCharacterDto, body);
  const errores = await validate(dto as object);
  return errores.flatMap((error) => Object.values(error.constraints ?? {}));
}

describe('CreateCharacterDto', () => {
  it('acepta una ficha con trasfondo dentro de los límites', async () => {
    expect(
      await erroresDe({
        name: 'Valeros',
        sheetData: { descripcion: 'Alto y rubio.', historia: 'Nació lejos.' },
      }),
    ).toEqual([]);
  });

  it('rechaza una historia que se pasa del límite', async () => {
    const errores = await erroresDe({
      name: 'Valeros',
      sheetData: { historia: 'a'.repeat(LIMITE_HISTORIA + 1) },
    });
    expect(errores.join(' ')).toMatch(/historia/);
  });

  it('rechaza una ficha demasiado grande por un campo sin tipar', async () => {
    const errores = await erroresDe({
      name: 'Valeros',
      sheetData: { relleno: 'a'.repeat(100_000) },
    });
    expect(errores.join(' ')).toMatch(/grande/);
  });

  it('sigue aceptando una ficha sin sheetData', async () => {
    expect(await erroresDe({ name: 'Valeros' })).toEqual([]);
  });
});
