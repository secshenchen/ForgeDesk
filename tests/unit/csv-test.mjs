import assert from 'node:assert/strict';
import { parseCsv } from '../../ui/src/data-workshop.js';

assert.deepEqual(parseCsv('\ufeffname,comment\r\nAda,"one, ""two"""\r\nBo,"line\nbreak"\r\n'),
  [['name', 'comment'], ['Ada', 'one, "two"'], ['Bo', 'line\nbreak']]);
assert.deepEqual(parseCsv('a,b,\n\n,c,'), [['a', 'b', ''], [''], ['', 'c', '']]);
assert.deepEqual(parseCsv(''), []);
assert.throws(() => parseCsv('x,"unclosed'));
assert.throws(() => parseCsv('x,"value"junk'));
assert.throws(() => parseCsv('x,b"ad'));
console.log('CSV parse, escaped fields, line breaks and malformed input passed.');
