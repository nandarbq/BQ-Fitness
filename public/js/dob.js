/* Widget kalender tanggal lahir (bukan date input bawaan browser). */
(function () {
  const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const pad = n => (n < 10 ? '0' : '') + n;
  const states = {};

  const ids = prefix => ({
    trigger: document.getElementById(prefix + 'Dob'),
    label: document.getElementById(prefix + 'DobLabel'),
    cal: document.getElementById(prefix + 'Calendar'),
    grid: document.getElementById(prefix + 'CalGrid'),
    monthSel: document.getElementById(prefix + 'CalMonth'),
    yearSel: document.getElementById(prefix + 'CalYear'),
    prev: document.getElementById(prefix + 'CalPrev'),
    next: document.getElementById(prefix + 'CalNext')
  });

  const fmt = iso => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    return `${d} ${MONTHS[m - 1]} ${y}`;
  };

  function fillHead(els) {
    if (!els.monthSel.options.length) {
      MONTHS.forEach((m, i) => {
        const o = document.createElement('option');
        o.value = String(i + 1);
        o.textContent = m;
        els.monthSel.appendChild(o);
      });
    }
    const cur = new Date().getFullYear();
    if (!els.yearSel.options.length) {
      for (let yr = cur; yr >= cur - 90; yr--) {
        const o = document.createElement('option');
        o.value = String(yr);
        o.textContent = String(yr);
        els.yearSel.appendChild(o);
      }
    }
  }

  function render(prefix) {
    const st = states[prefix];
    if (!st) return;
    const el = st.els;
    el.grid.innerHTML = '';
    el.monthSel.value = String(st.viewM + 1);
    el.yearSel.value = String(st.viewY);

    const today = new Date();
    const firstDow = new Date(st.viewY, st.viewM, 1).getDay();
    const lead = firstDow === 0 ? 6 : firstDow - 1;
    const daysInMonth = new Date(st.viewY, st.viewM + 1, 0).getDate();
    const cells = Math.ceil((lead + daysInMonth) / 7) * 7;

    for (let i = 0; i < cells; i++) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'cal-cell';
      const day = i - lead + 1;
      if (day < 1) {
        const pm = st.viewM === 0 ? 11 : st.viewM - 1;
        const py = st.viewM === 0 ? st.viewY - 1 : st.viewY;
        const pdl = new Date(py, pm + 1, 0).getDate();
        cell.textContent = pdl + day;
        cell.classList.add('muted');
        const iso = `${py}-${pad(pm + 1)}-${pad(pdl + day)}`;
        cell.addEventListener('click', () => {
          st.viewM = pm; st.viewY = py;
          select(prefix, iso);
        });
      } else if (day > daysInMonth) {
        cell.textContent = day - daysInMonth;
        cell.classList.add('muted');
        const nm = st.viewM === 11 ? 0 : st.viewM + 1;
        const ny = st.viewM === 11 ? st.viewY + 1 : st.viewY;
        const iso = `${ny}-${pad(nm + 1)}-${pad(day - daysInMonth)}`;
        cell.addEventListener('click', () => {
          st.viewM = nm; st.viewY = ny;
          select(prefix, iso);
        });
      } else {
        cell.textContent = day;
        const iso = `${st.viewY}-${pad(st.viewM + 1)}-${pad(day)}`;
        if (st.selected === iso) cell.classList.add('sel');
        if (new Date(st.viewY, st.viewM, day) > new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
          cell.classList.add('dis');
        } else {
          cell.addEventListener('click', () => select(prefix, iso));
        }
      }
      el.grid.appendChild(cell);
    }
  }

  function select(prefix, iso) {
    const st = states[prefix];
    st.selected = iso;
    st.els.label.textContent = fmt(iso);
    st.els.label.classList.add('filled');
    st.els.cal.hidden = true;
    document.dispatchEvent(new CustomEvent('bq:dobchange', { detail: { prefix } }));
    render(prefix);
  }

  function open(prefix) {
    const st = states[prefix];
    const closed = st.els.cal.hidden;
    st.els.cal.hidden = !closed;
    if (st.selected) {
      const [y, m] = st.selected.split('-').map(Number);
      st.viewY = y; st.viewM = m - 1;
    } else {
      const t = new Date();
      st.viewY = t.getFullYear(); st.viewM = t.getMonth();
    }
    render(prefix);
  }

  function init(prefix, iso) {
    const els = ids(prefix);
    if (!els.trigger || !els.cal || !els.grid) return;
    const cur = new Date();
    states[prefix] = { els, viewY: cur.getFullYear(), viewM: cur.getMonth(), selected: '' };
    const st = states[prefix];
    fillHead(els);

    els.trigger.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      open(prefix);
    });
    els.prev.addEventListener('click', e => {
      e.stopPropagation();
      st.viewM--; if (st.viewM < 0) { st.viewM = 11; st.viewY--; }
      render(prefix);
    });
    els.next.addEventListener('click', e => {
      e.stopPropagation();
      st.viewM++; if (st.viewM > 11) { st.viewM = 0; st.viewY++; }
      render(prefix);
    });
    els.monthSel.addEventListener('change', () => { st.viewM = Number(els.monthSel.value) - 1; render(prefix); });
    els.yearSel.addEventListener('change', () => { st.viewY = Number(els.yearSel.value); render(prefix); });

    document.addEventListener('click', e => {
      const s = states[prefix];
      if (!s) return;
      const t = e.target;
      if (t && t.closest && (t.closest('.cal-wrap') || t.closest('.dob-trigger'))) return;
      s.els.cal.hidden = true;
    });

    if (iso) setValue(prefix, iso);
    else setValue(prefix, '');
  }

  function setValue(prefix, iso) {
    const st = states[prefix];
    if (!st) return;
    st.selected = iso || '';
    st.els.label.textContent = iso ? fmt(iso) : 'Pilih tanggal';
    st.els.label.classList.toggle('filled', !!iso);
    if (iso) {
      const [y, m] = iso.split('-').map(Number);
      st.viewY = y; st.viewM = m - 1;
    } else {
      const t = new Date();
      st.viewY = t.getFullYear(); st.viewM = t.getMonth();
    }
    render(prefix);
  }

  function read(prefix) {
    const st = states[prefix];
    return st ? st.selected : '';
  }

  window.DOB = { init, setValue, read, MONTHS };
})();