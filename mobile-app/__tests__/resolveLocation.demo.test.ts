import { parseLocationString, resolveBuilding } from '../utils/stringUtils';

const SEP = '─'.repeat(66);
const out = (s: string) => process.stdout.write(s + '\n');

function run(input: string) {
  const parsed = parseLocationString(input);
  const resolved = resolveBuilding(parsed.building, parsed.campus);

  out('');
  out(`INPUT    : ${input}`);
  out(`  campus   : ${parsed.campus ?? '(unknown)'}`);
  out(`  building : ${parsed.building ?? '(none)'}`);
  out(`  room     : ${parsed.room ?? '(none)'}`);

  if (resolved) {
    out(`  ✔ MATCHED`);
    out(`    id      : ${resolved.id}`);
    out(`    code    : ${resolved.code ?? '(none)'}`);
    out(`    name    : ${resolved.name}`);
    out(`    address : ${resolved.address ?? '(not in address dataset)'}`);
  } else {
    out(`  ✘ NO MATCH`);
  }
  out(SEP);

  return { parsed, resolved };
}

describe('resolveLocation demo', () => {
  beforeAll(() => {
    out('');
    out('═'.repeat(66));
    out('  Location Resolver — BUILDING_POLYGONS + BUILDING_ADDRESSES');
    out('═'.repeat(66));
  });

  it('SGW – Hall Building Rm 535', () => {
    const { parsed, resolved } = run('Sir George Williams Campus - Hall Building Rm 535');
    expect(resolved?.code).toBe('H');
    expect(resolved?.campus).toBe('SGW');
    expect(parsed.room).toBe('535');
  });

  it('SGW – Hall Building Rm 811', () => {
    const { parsed, resolved } = run('Sir George Williams Campus - Hall Building Rm 811');
    expect(resolved?.code).toBe('H');
    expect(parsed.room).toBe('811');
  });

  it('SGW – CL Building Rm 235', () => {
    const { parsed, resolved } = run('Sir George Williams Campus - CL Building Rm 235');
    expect(resolved).not.toBeNull();
    expect(parsed.room).toBe('235');
  });

  it('SGW – John Molson School of Business (no room)', () => {
    const { parsed, resolved } = run('Sir George Williams Campus - John Molson School of Business');
    expect(resolved?.code).toBe('MB');
    expect(parsed.room).toBeNull();
  });

  it('SGW – EV Building', () => {
    const { resolved } = run('Sir George Williams Campus - EV Building');
    expect(resolved?.code).toBe('EV');
  });

  it('SGW – LB Building (McConnell)', () => {
    const { resolved } = run('Sir George Williams Campus - LB Building');
    expect(resolved?.code).toBe('LB');
  });

  it('Loyola – Hingston Hall', () => {
    const { resolved } = run('Loyola Campus - Hingston Hall');
    expect(resolved).not.toBeNull();
    expect(resolved?.campus).toBe('Loyola');
  });

  it('Loyola – Communication Studies and Journalism Building', () => {
    const { resolved } = run('Loyola Campus - Communication Studies and Journalism Building');
    expect(resolved?.code).toBe('CJ');
  });

  it('Loyola – Richard J Renaud Science Complex', () => {
    const { resolved } = run('Loyola Campus - Richard J Renaud Science Complex');
    expect(resolved?.code).toBe('SP');
  });

  it('Unknown campus + fictional building → no match', () => {
    const { resolved } = run('Unknown Campus - Some Fictional Building Rm 999');
    expect(resolved).toBeNull();
  });
});
