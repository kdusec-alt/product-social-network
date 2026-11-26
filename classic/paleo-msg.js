// Outlook MSG stores MAPI properties in a Compound File Binary container.
function readPaleoMsg(buffer) {
  const view = new DataView(buffer), bytes = new Uint8Array(buffer);
  if (view.getUint32(0, true) !== 0xe011cfd0 || view.getUint32(4, true) !== 0xe11ab1a1) {
    throw new Error('無法辨識 Outlook MSG 格式');
  }
  const get = (offset) => view.getUint32(offset, true);
  const sectorSize = 2 ** view.getUint16(30, true);
  if (![512, 4096].includes(sectorSize)) throw new Error('不支援的 MSG 版本');
  const end = 0xfffffffa, fat = [], difat = [];
  const sector = id => {
    const offset = (id + 1) * sectorSize;
    if (offset + sectorSize > bytes.length) throw new Error('MSG 資料不完整');
    return bytes.subarray(offset, offset + sectorSize);
  };
  for (let i = 0; i < 109; i++) difat.push(get(76 + i * 4));
  let next = get(68);
  for (let i = 0; i < get(72) && next < end && i < bytes.length / sectorSize; i++) {
    const block = sector(next), data = new DataView(block.buffer, block.byteOffset, block.byteLength);
    for (let j = 0; j < sectorSize - 4; j += 4) difat.push(data.getUint32(j, true));
    next = data.getUint32(sectorSize - 4, true);
  }
  for (const id of difat.filter(id => id < end).slice(0, get(44))) {
    const block = sector(id), data = new DataView(block.buffer, block.byteOffset, block.byteLength);
    for (let j = 0; j < sectorSize; j += 4) fat.push(data.getUint32(j, true));
  }
  function stream(id, table, block, size, limit) {
    const chunks = [], seen = new Set();
    let length = 0;
    while (id < end && length < limit) {
      if (seen.has(id) || id >= table.length) throw new Error('MSG 串流已損壞');
      seen.add(id);
      chunks.push(block(id));
      length += size;
      id = table[id];
    }
    const result = new Uint8Array(Math.min(length, limit));
    chunks.forEach((chunk, i) => result.set(chunk.subarray(0, result.length - i * size), i * size));
    return result;
  }
  const directory = stream(get(48), fat, sector, sectorSize, buffer.byteLength);
  const dir = new DataView(directory.buffer), entries = [];
  const utf16 = new TextDecoder('utf-16le');
  for (let i = 0; i + 128 <= directory.length; i += 128) {
    const count = dir.getUint16(i + 64, true);
    entries.push({
      name: count >= 2 && count <= 64 ? utf16.decode(directory.subarray(i, i + count - 2)) : '',
      left: dir.getUint32(i + 68, true), right: dir.getUint32(i + 72, true),
      child: dir.getUint32(i + 76, true), start: dir.getUint32(i + 116, true),
      size: dir.getUint32(i + 120, true)
    });
  }
  const root = entries[0];
  const mini = stream(root.start, fat, sector, sectorSize, root.size);
  const miniBytes = stream(get(60), fat, sector, sectorSize, get(64) * sectorSize);
  const miniFat = new Uint32Array(miniBytes.buffer);
  function children(node) {
    const stack = [node.child], seen = new Set(), result = [];
    while (stack.length) {
      const id = stack.pop(), entry = entries[id];
      if (!entry || seen.has(id)) continue;
      seen.add(id);
      result.push(entry);
      stack.push(entry.left, entry.right);
    }
    return result;
  }
  function value(entry) {
    if (entry.size > buffer.byteLength) throw new Error('MSG 屬性長度錯誤');
    if (entry.size >= get(56)) return stream(entry.start, fat, sector, sectorSize, entry.size);
    return stream(entry.start, miniFat, id => mini.subarray(id * 64, (id + 1) * 64), 64, entry.size);
  }
  function property(list, code) {
    for (const [type, decoder] of [['001F', utf16], ['001E', new TextDecoder('windows-1252')]]) {
      const entry = list.find(e => e.name === '__substg1.0_' + code + type);
      if (entry) return decoder.decode(value(entry)).replace(/\0+$/, '').trim();
    }
    return '';
  }
  const fields = children(root);
  const attachments = fields.filter(e => e.name.startsWith('__attach_version1.0_')).map(e => {
    const items = children(e);
    const filename = property(items, '3707') || property(items, '3704');
    const data = items.find(item => item.name === '__substg1.0_37010102');
    const contentBytes = data?.size || 0;
    const declaredSize = items.find(item => item.name === '__substg1.0_0E200003');
    let size = contentBytes;
    if (!size && declaredSize) {
      const raw = value(declaredSize);
      if (raw.byteLength >= 4) size = new DataView(raw.buffer, raw.byteOffset, raw.byteLength).getUint32(0, true);
    }
    const name = filename || '未命名附件';
    const mimeByExtension = {png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp',bmp:'image/bmp'};
    const extension = name.split('.').pop().toLowerCase();
    const declaredMime = property(items, '370E');
    const mime = /^image\/(png|jpeg|gif|webp|bmp)$/i.test(declaredMime) ? declaredMime.toLowerCase() : (mimeByExtension[extension] || declaredMime);
    return { name, size, mime, data: data && mime.startsWith('image/') ? value(data) : null };
  });
  return { subject: property(fields, '0037'), body: property(fields, '1000'),
    messageId: property(fields, '1035'), attachments,
    photoNames: attachments.map(item => item.name).filter(name => /\.(png|jpe?g|gif|webp|bmp)$/i.test(name)) };
}
