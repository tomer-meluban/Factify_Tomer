/* Minimal standalone runtime for the exported Design-canvas prototype.
   Renders the <template id="tpl"> markup with {{ holes }}, <sc-if>, <sc-for>
   and on* event bindings from Component.renderVals(), patching the live DOM
   with morphdom so running CSS animations are preserved between renders. */
(function () {
  'use strict';

  var HOLE = /\{\{\s*([A-Za-z0-9_$.]+)\s*\}\}/g;
  var ONLY_HOLE = /^\s*\{\{\s*([A-Za-z0-9_$.]+)\s*\}\}\s*$/;
  var EVENTS = { onclick: 'click', onmouseenter: 'mouseenter', onmouseleave: 'mouseleave', onpointerdown: 'pointerdown',
    onmousedown: 'mousedown', onmouseup: 'mouseup', onpointerup: 'pointerup', onpointermove: 'pointermove',
    onchange: 'change', oninput: 'input', onkeydown: 'keydown', ondblclick: 'dblclick', onwheel: 'wheel' };

  function lookup(path, scopes) {
    var parts = path.split('.');
    for (var i = scopes.length - 1; i >= 0; i--) {
      var s = scopes[i];
      if (s && Object.prototype.hasOwnProperty.call(s, parts[0])) {
        var v = s[parts[0]];
        for (var j = 1; j < parts.length && v != null; j++) v = v[parts[j]];
        return v;
      }
    }
    if (path === 'true') return true;
    if (path === 'false') return false;
    return undefined;
  }
  function str(v) { return v == null || v === false ? '' : String(v); }
  function fill(text, scopes) { return text.replace(HOLE, function (_, p) { return str(lookup(p, scopes)); }); }

  function DCLogic(props) { this.props = props || {}; this.state = {}; }
  DCLogic.prototype.setState = function (patch, cb) {
    var next = typeof patch === 'function' ? patch(this.state, this.props) : patch;
    if (next) Object.assign(this.state, next);
    if (this.__app) this.__app.schedule(cb);
  };
  DCLogic.prototype.forceUpdate = function (cb) { if (this.__app) this.__app.schedule(cb); };
  DCLogic.prototype.renderVals = function () { return {}; };
  window.DCLogic = DCLogic;

  function App(tplRoot, mountEl, inst) {
    this.tpl = tplRoot; this.mount = mountEl; this.inst = inst;
    this.pending = false; this.cbs = []; this.handlers = [];
    inst.__app = this;
  }
  App.prototype.schedule = function (cb) {
    var self = this;
    if (cb) this.cbs.push(cb);
    if (this.pending) return;
    this.pending = true;
    Promise.resolve().then(function () { self.pending = false; self.render(); });
  };
  App.prototype.build = function (node, scopes, key, out) {
    if (node.nodeType === 3) { out.push(document.createTextNode(fill(node.nodeValue, scopes))); return; }
    if (node.nodeType !== 1) return;
    var tag = node.localName;
    var kids = node.childNodes, i;
    if (tag === 'sc-if') {
      if (lookup(ONLY_HOLE.exec(node.getAttribute('value') || '') ? ONLY_HOLE.exec(node.getAttribute('value'))[1] : '', scopes)) {
        for (i = 0; i < kids.length; i++) this.build(kids[i], scopes, key + '.' + i, out);
      }
      return;
    }
    if (tag === 'sc-for') {
      var m = ONLY_HOLE.exec(node.getAttribute('list') || '');
      var list = m ? lookup(m[1], scopes) : null;
      var as = node.getAttribute('as') || 'item';
      if (list && list.length) {
        for (var n = 0; n < list.length; n++) {
          var sc = {}; sc[as] = list[n]; sc[as + 'Index'] = n;
          var s2 = scopes.concat([sc]);
          for (i = 0; i < kids.length; i++) this.build(kids[i], s2, key + '.' + i + '_' + n, out);
        }
      }
      return;
    }
    var el = node.namespaceURI && node.namespaceURI !== 'http://www.w3.org/1999/xhtml'
      ? document.createElementNS(node.namespaceURI, node.tagName)
      : document.createElement(tag);
    var attrs = node.attributes;
    for (i = 0; i < attrs.length; i++) {
      var a = attrs[i], name = a.name, low = name.toLowerCase(), val = a.value;
      if (low.indexOf('hint-') === 0) continue;
      if (EVENTS[low]) {
        var hm = ONLY_HOLE.exec(val);
        var fn = hm ? lookup(hm[1], scopes) : null;
        if (typeof fn === 'function') {
          this.handlers.push(fn);
          el.setAttribute('data-ev-' + EVENTS[low], String(this.handlers.length - 1));
        }
        continue;
      }
      var whole = ONLY_HOLE.exec(val);
      if (whole) {
        var v = lookup(whole[1], scopes);
        if (v === false || v == null) continue;
        val = v === true ? '' : String(v);
      } else if (val.indexOf('{{') >= 0) {
        val = fill(val, scopes);
      }
      if (a.namespaceURI) el.setAttributeNS(a.namespaceURI, name, val); else el.setAttribute(name, val);
    }
    el.setAttribute('data-k', key);
    var src = tag === 'template' ? node.content.childNodes : kids;
    var childOut = [];
    for (i = 0; i < src.length; i++) this.build(src[i], scopes, key + '.' + i, childOut);
    for (i = 0; i < childOut.length; i++) el.appendChild(childOut[i]);
    out.push(el);
  };
  App.prototype.render = function () {
    var vals = this.inst.renderVals() || {};
    this.handlers = [];
    var out = [];
    var kids = this.tpl.childNodes;
    for (var i = 0; i < kids.length; i++) this.build(kids[i], [vals], 'k' + i, out);
    var next = this.mount.cloneNode(false);
    for (i = 0; i < out.length; i++) next.appendChild(out[i]);
    window.morphdom(this.mount, next, {
      getNodeKey: function (n) { return n.getAttribute ? n.getAttribute('data-k') : null; },
      onBeforeElUpdated: function (from, to) { return !from.isEqualNode(to); }
    });
    this.bind();
    var cbs = this.cbs; this.cbs = [];
    for (i = 0; i < cbs.length; i++) try { cbs[i].call(this.inst); } catch (e) { console.error(e); }
  };
  App.prototype.bind = function () {
    var handlers = this.handlers;
    var prev = this.bound || [];
    for (var p = 0; p < prev.length; p++) prev[p][0]['on' + prev[p][1]] = null;
    var bound = this.bound = [];
    var types = ['click', 'mouseenter', 'mouseleave', 'pointerdown', 'mousedown', 'mouseup', 'pointerup', 'pointermove', 'change', 'input', 'keydown', 'dblclick', 'wheel'];
    for (var t = 0; t < types.length; t++) {
      var type = types[t];
      var els = this.mount.querySelectorAll('[data-ev-' + type + ']');
      for (var i = 0; i < els.length; i++) {
        var fn0 = handlers[+els[i].getAttribute('data-ev-' + type)];
        if (fn0) { els[i]['on' + type] = fn0; bound.push([els[i], type]); }
      }
    }
  };

  window.startPrototype = function () {
    var tpl = document.getElementById('tpl').content;
    var mount = document.getElementById('app');
    var inst = new window.Component({});
    var app = new App(tpl, mount, inst);
    app.render();
    if (inst.componentDidMount) inst.componentDidMount();
    window.addEventListener('beforeunload', function () { if (inst.componentWillUnmount) inst.componentWillUnmount(); });
  };
})();
