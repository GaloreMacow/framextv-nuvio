  var MOVY = 'https://api.wecollege.net';
  var MOVY_HEADERS = { Origin: 'https://www.movy.bz', Referer: 'https://www.movy.bz/' };

  // The website's public Miner client decodes encrypted JSON source responses.
  // Use 32-bit arithmetic so the same code works without BigInt or Math.imul.
  function multiply(a, b) {
    return ((a & 65535) * (b & 65535) + ((((a >>> 16) * (b & 65535) + (a & 65535) * (b >>> 16)) & 65535) << 16)) | 0;
  }
  function mix(n) {
    n = n >>> 0; n ^= n >>> 16; n = multiply(n, 2246822507); n ^= n >>> 13;
    n = multiply(n, 3266489909); return (n ^ (n >>> 16)) >>> 0;
  }
  function rotate(n, count) { count &= 31; return count ? ((n << count) | (n >>> (32 - count))) >>> 0 : n >>> 0; }
  function seedHash(seed) {
    var n = 2166136261;
    for (var i = 0; i < seed.length; i++) n = multiply(n ^ seed.charCodeAt(i), 16777619) >>> 0;
    return mix(n);
  }
  function cipherState(seed, id) {
    var state = { values: [], assigned: [], acc: 0 }, n = mix(seedHash(seed) ^ mix((id ^ 2654435769) >>> 0));
    for (var i = 0; i < 8; i++) {
      var slot = n % 61; n = rotate((n + 2654435769) >>> 0, 7 + (i & 7));
      state.values[slot] = (n ^ mix(n)) >>> 0; state.assigned[slot] = true; n = mix((n + slot) >>> 0);
    }
    state.acc = mix((2779096485 ^ n) >>> 0); return state;
  }
  function cipherWord(state, index) {
    var n = state.acc, slot = n % 61, mask = state.assigned[slot] ? 4294967295 : 0;
    var value = state.assigned[slot] ? state.values[slot] : 0;
    var c = (value ^ (multiply(index + 1, 2654435769) >>> 0)) >>> 0;
    n = mix(((rotate((((n ^ c) | (n & c & mask)) >>> 0) + n >>> 0, slot & 31) ^ rotate(n, (slot * 7) & 31)) + 2654435769) >>> 0);
    state.values[slot] = n; state.assigned[slot] = true; state.acc = n; return n;
  }
  function decodeSources(encoded, seed, id) {
    var alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/', bytes = [], bits = 0, acc = 0;
    encoded = String(encoded).trim().replace(/-/g, '+').replace(/_/g, '/');
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new Error('Invalid source encoding');
    for (var i = 0; i < encoded.length; i++) {
      if (encoded.charAt(i) === '=') break;
      acc = (acc << 6) | alphabet.indexOf(encoded.charAt(i)); bits += 6;
      if (bits >= 8) { bits -= 8; bytes.push((acc >>> bits) & 255); }
    }
    if (bytes.length <= 4) throw new Error('Empty source response');
    var state = cipherState(seed, Number(id));
    for (var offset = 0, word = 0; offset < bytes.length; word++) {
      var key = cipherWord(state, word);
      for (var j = 0; j < 4 && offset < bytes.length; j++, offset++) bytes[offset] ^= (key >>> (j * 8)) & 255;
    }
    if (bytes.slice(0, 4).join(',') !== '109,118,109,49') throw new Error('Invalid source response');
    var escaped = '';
    bytes.slice(4).forEach(function (b) { escaped += '%' + ('0' + b.toString(16)).slice(-2); });
    return JSON.parse(decodeURIComponent(escaped));
  }
  function minerPayload(id, type, season, episode) {
    return fetchWithin(MOVY + '/seed?mediaId=' + encodeURIComponent(id), { headers: MOVY_HEADERS }, 20000, function (response) {
      if (!response.ok) throw new Error('Miner seed HTTP ' + response.status);
      return response.json();
    }).then(function (data) {
      if (!data || typeof data.seed !== 'string' || !data.seed) throw new Error('Miner seed unavailable');
      return Promise.all(['miami', 'atlanta', 'dallas'].map(function (city) {
        var url = MOVY + '/' + city + '/sources?mediaType=' + type + '&tmdbId=' + encodeURIComponent(id) + '&enc=2&seed=' + encodeURIComponent(data.seed);
        if (type === 'tv') url += '&seasonId=' + season + '&episodeId=' + episode;
        return fetchWithin(url, { headers: MOVY_HEADERS }, 12000, function (response) {
          if (!response.ok) throw new Error('Miner ' + city + ' HTTP ' + response.status);
          return response.text();
        }).then(function (body) {
          var decoded = decodeSources(body, data.seed, id);
          if (!decoded || !Array.isArray(decoded.sources)) throw new Error('Invalid Miner source payload');
          return { city: city, data: decoded };
        }).catch(function (error) { console.log('[FrameXTV Miner] ' + error.message); return null; });
      }));
    }).then(function (groups) {
      var payload = { success: true, provider: 'miner', sources: [], subtitles: [] };
      groups.forEach(function (group) {
        if (!group) return;
        (Array.isArray(group.data.sources) ? group.data.sources : []).forEach(function (source) {
          if (!source || !httpUrl(source.url) || /^(?:iframe|embed)$/i.test(source.type || '')) return;
          var playbackHeaders = headers(MOVY_HEADERS), extraHeaders = headers(source.headers);
          Object.keys(extraHeaders).forEach(function (key) { playbackHeaders[key] = extraHeaders[key]; });
          payload.sources.push({ url: source.url, quality: source.quality || 'Auto',
            type: source.type || (/\.mp4(?:[?#]|$)/i.test(source.url) ? 'mp4' : 'hls'),
            server: 'Miner XIX (' + group.city.charAt(0).toUpperCase() + group.city.slice(1) + ')',
            headers: playbackHeaders,
            subtitles: source.subtitles, audioTracks: source.audioTracks });
        });
        payload.subtitles = payload.subtitles.concat(Array.isArray(group.data.subtitles) ? group.data.subtitles : []);
      });
      if (!payload.sources.length) throw new Error('No Miner client streams');
      return payload;
    });
  }

  function loadPayload(url, id, type, season, episode) {
    var lookupStart = Date.now();
    return minerPayload(id, type, season, episode).catch(function (error) {
      console.log('[FrameXTV Miner] Client lookup: ' + error.message);
      var remaining = 45000 - (Date.now() - lookupStart);
      if (remaining <= 0) throw new Error('Miner lookup timeout');
      return fetchWithin(url, { headers: { Accept: 'application/json' } }, Math.min(18000, remaining), function (response) {
        if (!response.ok) throw new Error('API HTTP ' + response.status);
        return response.json();
      });
    });
  }
