// The relative-path rule from spec §5 Rules. Every path in a catalog or a data response must pass it, because the hub and the viewer join these paths onto an
// app's origin: anything that a browser or URL parser could resolve to another host must be refused.
//
// A path is relative when it starts with `/`, its second character is neither `/` nor `\`, and it contains no `\` anywhere. Control characters are refused
// as well: URL parsers drop tab and newline, so "/<tab>/evil.test" would otherwise collapse into the protocol-relative "//evil.test".
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
export function isRelativePath(p) {
    if (typeof p !== 'string')
        return false;
    if (p[0] !== '/')
        return false;
    if (p[1] === '/' || p[1] === '\\')
        return false;
    if (p.includes('\\'))
        return false;
    return !CONTROL_CHARS.test(p);
}
