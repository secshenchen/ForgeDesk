import assert from 'node:assert/strict';
import { parseCsv } from '../../ui/src/data-workshop.js';

assert.deepEqual(parseCsv('\ufeffname,comment\r\nAda,"one, ""two"""\r\nBo,"line\nbreak"\r\n'),
  [['name', 'comment'], ['Ada', 'one, "two"'], ['Bo', 'line\nbreak']]);
assert.deepEqual(parseCsv('a,b,\n\n,c,'), [['a', 'b', ''], [''], ['', 'c', '']]);
assert.deepEqual(parseCsv(''), []);
assert.deepEqual(parseCsv('x;"a;b"\r\ny;z', ';'), [['x', 'a;b'], ['y', 'z']]);
assert.deepEqual(parseCsv('x\ty\n"z\tw"\t', '\t'), [['x', 'y'], ['z\tw', '']]);
assert.throws(() => parseCsv('x,"unclosed'));
assert.throws(() => parseCsv('x,"value"junk'));
assert.throws(() => parseCsv('x,b"ad'));
assert.throws(() => parseCsv('x\n'.repeat(100001)), /100,000/);
assert.throws(() => parseCsv('x'.repeat(5 * 1024 * 1024 + 1)), /5 MiB/);
console.log('CSV parse, escaped fields, line breaks and malformed input passed.');
