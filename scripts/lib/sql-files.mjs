/** Split versioned mysql-client files, including stored routine DELIMITER blocks. */
export function statements(source) {
  let delimiter = ';', buffer = ''; const result = [];
  for (const line of source.split(/\r?\n/)) {
    if (/^\s*DELIMITER\s+/i.test(line)) { delimiter = line.trim().split(/\s+/)[1]; continue; }
    if (!buffer && /^\s*--/.test(line)) continue;
    buffer += line + '\n';
    if (buffer.trimEnd().endsWith(delimiter)) { result.push(buffer.trimEnd().slice(0, -delimiter.length)); buffer = ''; }
  }
  if (buffer.trim() && !buffer.trim().startsWith('--')) throw new Error('Sentencia SQL sin delimitador final.');
  return result;
}
