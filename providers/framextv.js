/* FrameXTV provider for Nuvio TV. No imports, Node APIs, or build step. */
(function () {
  'use strict';
  var API = 'https://api.framextv.tech';

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
    var seen = {};
    return (Array.isArray(value) ? value : []).map(function (item) {
      if (!item || typeof item !== 'object') return null;
      var url = httpUrl(item.url);
      if (!url || seen[url]) return null;
      seen[url] = true;
      return {
        id: url,
        url: url,
        language: item.language || item.lang || 'Unknown',
        name: item.label || 'FrameXTV',
        headers: headers(item.headers)
      };
    }).filter(function (item) { return item !== null; });
  }

  function normalize(payload) {
    if (!payload || payload.success === false || !Array.isArray(payload.sources)) return [];
    var seen = {};
    return payload.sources.map(function (source) {
      if (!source || typeof source !== 'object') return null;
      var url = httpUrl(source.url);
      // A web player cannot be played as a media stream by Nuvio.
      if (!url || source.type === 'iframe' || source.type === 'embed' || seen[url]) return null;
      seen[url] = true;
      var server = source.server || payload.provider || 'Auto';
      var quality = typeof source.quality === 'string' && source.quality.trim()
        ? source.quality : 'Auto';
      var audio = (Array.isArray(source.audioTracks) ? source.audioTracks : []).map(function (track) {
        return track && (track.label || track.language);
      }).filter(Boolean).join(', ');
      var requestHeaders = headers(payload.headers);
      var sourceHeaders = headers(source.headers);
      Object.keys(sourceHeaders).forEach(function (key) { requestHeaders[key] = sourceHeaders[key]; });
      return {
        name: 'FrameXTV',
        title: 'FrameXTV | ' + server + ' | ' + quality + (audio ? ' | ' + audio : ''),
        quality: quality,
        url: url,
        headers: requestHeaders,
        subtitles: subtitles((payload.subtitles || []).concat(source.subtitles || []))
      };
    }).filter(function (item) { return item !== null; });
  }

  function getStreams(tmdbId, mediaType, season, episode) {
    var type = String(mediaType || '').toLowerCase();
    if (type === 'series') type = 'tv';
    var id = String(tmdbId == null ? '' : tmdbId).replace(/^tmdb:/, '').trim();
    if ((type !== 'movie' && type !== 'tv') || !/^[1-9]\d*$/.test(id)) return Promise.resolve([]);
    var url = API + '/api/stream?type=' + type + '&id=' + encodeURIComponent(id);
    if (type === 'tv') {
      var s = String(season == null ? '' : season);
      var e = String(episode == null ? '' : episode);
      // Season 0 is valid for specials. Never silently request episode 1.
      if (!/^\d+$/.test(s) || !/^[1-9]\d*$/.test(e)) return Promise.resolve([]);
      url += '&season=' + encodeURIComponent(s) + '&episode=' + encodeURIComponent(e);
    }
    // Omit provider to use the backend's automatic provider selection.
    return Promise.resolve().then(function () {
      return fetch(url, { headers: { Accept: 'application/json' } });
    }).then(function (response) {
      if (!response.ok) throw new Error('API HTTP ' + response.status);
      return response.json();
    }).then(normalize).catch(function (error) {
      console.log('[FrameXTV] ' + (error && error.message ? error.message : 'Request failed'));
      return [];
    });
  }

  module.exports = { getStreams: getStreams };
  
}());
