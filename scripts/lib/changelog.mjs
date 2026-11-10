// CHANGELOG.md in Keep a Changelog form, and the one product version (ADR-0030).
const HEADING = /^## \[([^\]]+)\]/gm;

export function parseVersion(text) {
  const m = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(text);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

export function isHigher(next, current) {
  const a = parseVersion(next);
  const b = parseVersion(current);
  if (!a || !b) throw new Error(`not a version: ${!a ? next : current}`);
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}

// Each `## [name]` section: where its heading starts, where its body starts and ends.
function sections(text) {
  const heads = [...text.matchAll(HEADING)];
  const linksAt = text.search(/^\[[^\]]+\]: /m);
  return heads.map((m, i) => {
    const bodyStart = text.indexOf('\n', m.index) + 1;
    const next = heads[i + 1]?.index ?? (linksAt > m.index ? linksAt : text.length);
    return { name: m[1], start: m.index, bodyStart, end: next };
  });
}

function bodyOf(text, name) {
  const found = sections(text).find((s) => s.name === name);
  return found ? text.slice(found.bodyStart, found.end).trim() : null;
}

export function unreleasedBody(text) {
  return bodyOf(text, 'Unreleased') ?? '';
}

export function releaseNotes(text, version) {
  const body = bodyOf(text, version);
  if (body === null) throw new Error(`CHANGELOG.md has no section for ${version}`);
  return body;
}

export function cutRelease(text, version, date, repoUrl) {
  const all = sections(text);
  const unreleased = all.find((s) => s.name === 'Unreleased');
  const body = unreleased ? text.slice(unreleased.bodyStart, unreleased.end).trim() : '';
  if (!body) throw new Error('Unreleased is empty: nothing to release.');
  const previous = all.find((s) => s.name !== 'Unreleased')?.name;
  const section = `## [Unreleased]\n\n## [${version}] - ${date}\n\n${body}\n\n`;
  const cut = text.slice(0, unreleased.start) + section + text.slice(unreleased.end);
  const links = [
    `[Unreleased]: ${repoUrl}/compare/v${version}...HEAD`,
    previous
      ? `[${version}]: ${repoUrl}/compare/v${previous}...v${version}`
      : `[${version}]: ${repoUrl}/releases/tag/v${version}`,
  ].join('\n');
  const withoutOld = cut.replace(/^\[Unreleased\]: .*\n/m, '');
  const at = withoutOld.search(/^\[[^\]]+\]: /m);
  return at < 0
    ? `${withoutOld.trimEnd()}\n\n${links}\n`
    : `${withoutOld.slice(0, at)}${links}\n${withoutOld.slice(at)}`;
}

export function needsChangelog(paths) {
  return paths.some((p) => /^(apps|packages|infra)\//.test(p));
}

export function addsToUnreleased(before, after) {
  const lines = (text) =>
    unreleasedBody(text)
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
  const old = new Set(lines(before));
  return lines(after).some((l) => !old.has(l));
}
