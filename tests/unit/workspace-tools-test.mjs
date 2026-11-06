import assert from 'node:assert/strict';
import { inventory, subnet, textSearch } from '../../ui/src/workspace-tools.js';

assert.deepEqual(subnet('192.168.1.42/24'), {
  network: '192.168.1.0', last: '192.168.1.255', count: 256
});
assert.equal(subnet('255.255.255.255/0').count, 4294967296);
assert.equal(subnet('1.2.3.4/32').network, '1.2.3.4');
for (const invalid of ['256.0.0.1/24', '1.2.3.4/33', 'example.com', '1.2.3/8']) {
  assert.throws(() => subnet(invalid));
}
assert.deepEqual(textSearch('a\r\nFOO\n', 'foo'), ['2: FOO']);
const report = inventory([
  { name: 'a.TXT', size: 5, webkitRelativePath: 'dir/a.TXT' },
  { name: 'b.txt', size: 15 }, { name: '.config', size: 0 }
]);
assert.equal(report.bytes, '20');
assert.equal(report.largest[0].path, 'b.txt');
assert.deepEqual(report.byExtension, [
  { extension: 'txt', count: 2, bytes: '20' },
  { extension: '无扩展名', count: 1, bytes: '0' }
]);
assert.equal(inventory([]).count, 0);
assert.equal(inventory([{ name: 'a', size: Number.MAX_SAFE_INTEGER }, { name: 'b', size: 2 }]).bytes,
  '9007199254740993');
console.log('Inventory, IPv4 boundary and text search tests passed.');
