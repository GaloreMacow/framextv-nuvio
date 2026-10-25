/* FrameXTV provider for Nuvio TV. Standalone runtime: no imports, Node APIs, or eval. */
(function () {
  'use strict';
  var API = 'https://api.framextv.tech';
  var PROVIDER = "headhunter";
  var LABEL = "Headhunter";

  function fetchWithin(url, options, milliseconds, read) {
    var work = Promise.resolve().then(function () { return fetch(url, options); }).then(function (response) {
      return read ? read(response) : response;
    });
    if (typeof setTimeout !== 'function' || typeof clearTimeout !== 'function') return work;
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () { reject(new Error('Request timeout')); }, milliseconds);
      work.then(function (value) { clearTimeout(timer); resolve(value); }, function (error) { clearTimeout(timer); reject(error); });
    });
  }
  // BEGIN PROVIDER LOOKUP
  function loadPayload(url) {
    return fetchWithin(url, { headers: { Accept: 'application/json' } }, 25000, function (response) {
      if (!response.ok) throw new Error('API HTTP ' + response.status);
      return response.json();
    });
  }
  // END PROVIDER LOOKUP

  function httpUrl(value) {
    if (typeof value !== 'string') return '';
    value = value.trim();
    if (/^\/api\//.test(value)) return API + value;
    return /^https?:\/\//i.test(value) ? value : '';
  }

  function headers(value) {
    var result = {};
    if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
    Object.keys(value).forEach(function (key) {
      if (typeof value[key] === 'string') result[key] = value[key];
    });
    return result;
  }

  function subtitles(value) {
    var seen = Object.create(null);
    return (Array.isArray(value) ? value : []).map(function (item) {
      if (!item || typeof item !== 'object') return null;
      var url = httpUrl(item.url);
      var key = url + '|' + (item.language || item.lang || 'Unknown') + '|' + headerKey(headers(item.headers));
      if (!url || seen[key]) return null;
      seen[key] = true;
      return {
        id: url,
        url: url,
        language: item.language || item.lang || 'Unknown',
        name: item.label || item.name || item.language || item.lang || 'Subtitles',
        headers: headers(item.headers)
      };
    }).filter(function (item) { return item !== null; });
  }

  function headerKey(value) {
    return JSON.stringify(Object.keys(value || {}).sort().map(function (key) { return [key, value[key]]; }));
  }
  function playbackKey(stream) {
    return JSON.stringify([stream.url, headerKey(stream.headers), stream.subtitles, stream.quality,
      stream._audio || '', stream._type || stream.type || '']);
  }
  function dedupe(streams) {
    var seen = Object.create(null);
    return streams.filter(function (stream) {
      var group = seen[stream.url];
      if (!group) { seen[stream.url] = [{ source: stream }]; return true; }
      // Serialize playback metadata only when the URL actually repeats.
      var key = playbackKey(stream);
      for (var i = 0; i < group.length; i++) {
        if (!group[i].key) group[i].key = playbackKey(group[i].source);
        if (group[i].key === key) return false;
      }
      group.push({ source: stream, key: key }); return true;
    });
  }
  function resolutionLabel(value) {
    var text = String(value || ''), matches = text.match(/\b(?:4k|[1-9]\d{2,3}p)\b/gi);
    if (/\bauto\b/i.test(text) || (matches && matches.length > 1)) return 'Auto';
    if (matches) return /^4k$/i.test(matches[0]) ? '4K' : matches[0].toLowerCase();
    return !text ? 'Auto' : 'Unknown';
  }
  function normalize(payload) {
    if (!payload || payload.success === false || !Array.isArray(payload.sources)) return [];
    var sharedHeaders = headers(payload.headers), sharedSubtitles = subtitles(payload.subtitles);
    return dedupe(payload.sources.map(function (source) {
      if (!source || typeof source !== 'object') return null;
      var url = httpUrl(source.url), type = String(source.type || '').toLowerCase();
      // Web players cannot be played as media streams by Nuvio.
      if (!url || type === 'iframe' || type === 'embed') return null;
      var quality = typeof source.quality === 'string' && source.quality.trim()
        ? source.quality.trim() : 'Auto';
      quality = resolutionLabel(quality);
      var audio = (Array.isArray(source.audioTracks) ? source.audioTracks : []).map(function (track) {
        return track && (track.label || track.language);
      }).filter(Boolean).join(', ');
      var requestHeaders = headers(sharedHeaders), sourceHeaders = headers(source.headers);
      Object.keys(sourceHeaders).forEach(function (key) { requestHeaders[key] = sourceHeaders[key]; });
      return {
        name: quality, title: quality,
        quality: quality, _audio: audio, url: url,
        headers: requestHeaders,
        subtitles: Array.isArray(source.subtitles) && source.subtitles.length
          ? subtitles(sharedSubtitles.concat(source.subtitles)) : sharedSubtitles,
        _type: type
      };
    }).filter(function (item) { return item !== null; }));
  }

  function resolveUrl(value, base) {
    if (typeof value !== 'string' || !value.trim()) return '';
    value = value.trim();
    // Resolve before invoking URL: Nuvio runtimes provide a limited URL shim.
    if (/^\/\//.test(value)) value = 'https:' + value;
    else if (!/^https?:\/\//i.test(value)) {
      if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return '';
      var parent = String(base || API + '/').split('#')[0];
      var origin = parent.match(/^https?:\/\/[^/?#]+/i);
      if (!origin) return '';
      if (value.charAt(0) === '?') value = parent.split('?')[0] + value;
      else if (value.charAt(0) === '#') value = parent + value;
      else if (value.charAt(0) === '/') value = origin[0] + value;
      else {
        parent = parent.split('?')[0];
        if (parent === origin[0]) parent += '/';
        value = parent.replace(/\/[^/]*$/, '/') + value;
      }
    }
    var parts = value.match(/^(https?:\/\/[^/?#]+)([^?#]*)([\s\S]*)$/i);
    if (!parts) return '';
    var path = parts[2] || '/', resolved = [];
    path.split('/').forEach(function (segment) {
      if (segment === '..') { if (resolved.length > 1) resolved.pop(); }
      else if (segment !== '.') resolved.push(segment);
    });
    var tail = /\/(?:\.|\.\.)$/.test(path) ? '/' : '';
    var finalPath = resolved.join('/') || '/';
    if (tail && finalPath.charAt(finalPath.length - 1) !== '/') finalPath += tail;
    value = parts[1] + finalPath + parts[3];
    try {
      var url = new URL(value);
      return /^https?:$/.test(url.protocol) ? url.href : '';
    } catch (_) { return ''; }
  }

  function attributes(line) {
    var result = {};
    var regex = /([A-Z0-9-]+)=("[^"]*"|[^,]*)/g;
    var match;
    while ((match = regex.exec(line))) result[match[1]] = match[2].replace(/^"|"$/g, '');
    return result;
  }

  function qualityLabel(attrs) {
    var resolution = String(attrs.RESOLUTION || '').match(/^(\d+)x(\d+)$/);
    if (!resolution) return '';
    var width = Number(resolution[1]);
    var height = Number(resolution[2]);
    // Cinematic streams are cropped: 1920x800 is still the 1080p tier.
    var tier = width >= 3840 ? 2160 : width >= 2560 ? 1440 : width >= 1920 ? 1080
      : width >= 1280 ? 720 : width >= 854 ? 480 : width >= 640 ? 360 : height;
    return tier === 2160 ? '4K' : tier + 'p';
  }

  function parseMaster(text, base) {
    if (!/^\s*#EXTM3U/.test(text)) return null;
    if (text.indexOf('#EXT-X-STREAM-INF:') < 0) return { variants: [], audioGroups: {}, subtitleGroups: {} };
    var lines = text.split(/\r?\n/);
    var variants = [];
    var audioGroups = {}, subtitleGroups = {};
    var pending = null;
    lines.forEach(function (line) {
      line = line.trim();
      if (line.indexOf('#EXT-X-MEDIA:') === 0) {
        var media = attributes(line);
        if (media.TYPE === 'AUDIO' && media.URI) audioGroups[media['GROUP-ID']] = true;
        if (media.TYPE === 'SUBTITLES' && media.URI) subtitleGroups[media['GROUP-ID']] = true;
      }
      if (line.indexOf('#EXT-X-STREAM-INF:') === 0) pending = attributes(line);
      else if (pending && line && line.charAt(0) !== '#') {
        var url = resolveUrl(line, base);
        if (url) variants.push({ url: url, quality: qualityLabel(pending),
          bandwidth: Number(pending.BANDWIDTH || 0), audioGroup: pending.AUDIO || '', subtitleGroup: pending.SUBTITLES || '' });
        pending = null;
      }
    });
    variants.sort(function (a, b) { return b.bandwidth - a.bandwidth; });
    return { variants: variants, audioGroups: audioGroups, subtitleGroups: subtitleGroups };
  }

  function copyStream(stream, url, quality) {
    quality = resolutionLabel(quality);
    return { name: quality, title: quality, quality: quality, url: url,
      _audio: stream._audio || '', type: stream._type || stream.type || '',
      headers: stream.headers, subtitles: stream.subtitles };
  }

  function expandQualities(stream, ctx) {
    var original = copyStream(stream, stream.url, stream.quality);
    var isHls = stream._type === 'hls' || /\.m3u8(?:[?#]|$)/i.test(stream.url);
    if (!isHls) return Promise.resolve([original]);
    var cache = ctx ? (ctx.playlists || (ctx.playlists = Object.create(null))) : Object.create(null);
    var key = stream.url + '|' + headerKey(stream.headers);
    if (!cache[key]) cache[key] = fetchWithin(stream.url, { headers: stream.headers }, 10000, function (response) {
      if (!response.ok) { var error = new Error('Playlist HTTP ' + response.status); error.status = response.status; throw error; }
      return response.text().then(function (text) {
        return { text: text, master: parseMaster(text, response.url || stream.url) };
      });
    });
    return cache[key].then(function (response) {
      var master = response.master;
      // Drop confirmed HTML error pages. Retain API URLs when a probe fails.
      if (!master) return /^\s*(?:<!doctype|<html|[\[{])/i.test(response.text) ? [] : [original];
      if (!master.variants.length) return [original];
      var auto = copyStream(stream, stream.url, 'Auto');
      var seen = {};
      var output = [auto];
      master.variants.forEach(function (variant) {
        // External audio/subtitle renditions need the parent master.
        if (master.audioGroups[variant.audioGroup] || master.subtitleGroups[variant.subtitleGroup]) return;
        if (seen[variant.url]) return;
        seen[variant.url] = true;
        output.push(copyStream(stream, variant.url, variant.quality || 'Unknown'));
      });
      return output;
    }).catch(function (error) {
      console.log('[FrameXTV ' + LABEL + '] Playlist: ' + error.message);
      if (error.status === 404 || error.status === 410) return [];
      return [original];
    });
  }

  function getStreams(tmdbId, mediaType, season, episode) {
    var type = String(mediaType || '').toLowerCase();
    if (type === 'series') type = 'tv';
    var id = String(tmdbId == null ? '' : tmdbId).trim().replace(/^tmdb[:/]/i, '');
    if ((type !== 'movie' && type !== 'tv') || !/^[1-9]\d*$/.test(id)) return Promise.resolve([]);
    var url = API + '/api/stream?type=' + type + '&id=' + encodeURIComponent(id);
    if (type === 'tv') {
      var s = String(season == null ? '' : season);
      var e = String(episode == null ? '' : episode);
      // Season 0 is valid for specials. Never silently request episode 1.
      if (!/^\d+$/.test(s) || !/^[1-9]\d*$/.test(e)) return Promise.resolve([]);
      url += '&season=' + encodeURIComponent(s) + '&episode=' + encodeURIComponent(e);
    }
    url += '&provider=' + encodeURIComponent(PROVIDER);
    return loadPayload(url, id, type, season, episode).then(normalize).then(function (streams) {
      var ctx = {};
      return Promise.all(streams.map(function (stream) { return expandQualities(stream, ctx); })).then(function (groups) {
        var result = [];
        groups.forEach(function (group) { result = result.concat(group); });
        return dedupe(result).map(function (stream) { delete stream._audio; return stream; });
      });
    }).catch(function (error) {
      console.log('[FrameXTV] ' + (error && error.message ? error.message : 'Request failed'));
      return [];
    });
  }

  module.exports = { getStreams: getStreams };
}());
