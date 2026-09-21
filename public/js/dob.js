/* Pengganti input type="date" untuk tanggal lahir: 3 dropdown (hari/bulan/tahun). */
(function () {
  const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const pad = n => (n < 10 ? '0' : '') + n;

  function fillDay(sel, max) {
    sel.innerHTML = '';
    for (let d = 1; d <= max; d++) {
      const o = document.createElement('option');
      o.value = String(d);
      o.textContent = String(d);
      sel.appendChild(o);
    }
  }

  function fillYear(sel) {
    sel.innerHTML = '';
    const y = new Date().getFullYear();
    for (let yr = y; yr >= y - 90; yr--) {
      const o = document.createElement('option');
      o.value = String(yr);
      o.textContent = String(yr);
      sel.appendChild(o);
    }
  }

  function maxDay(m, y) { return new Date(y, m, 0).getDate(); }

  function els(prefix) {
    return {
      day: document.getElementById(prefix + 'Day'),
      month: document.getElementById(prefix + 'Month'),
      year: document.getElementById(prefix + 'Year')
    };
  }

  function syncDay(el) {
    if (!el.day) return;
    const keep = Number(el.day.value);
    fillDay(el.day, maxDay(Number(el.month.value), Number(el.year.value)));
    if (keep > el.day.options.length - 1) el.day.selectedIndex = el.day.options.length - 1;
    else el.day.value = String(keep);
  }

  function init(prefix, iso) {
    const el = els(prefix);
    if (!el.day || !el.month || !el.year) return;
    el.month.innerHTML = '';
    MONTHS.forEach((m, i) => {
      const o = document.createElement('option');
      o.value = String(i + 1);
      o.textContent = m;
      el.month.appendChild(o);
    });
    fillYear(el.year);
    el.month.addEventListener('change', () => syncDay(el));
    el.year.addEventListener('change', () => syncDay(el));
    if (iso) setValue(prefix, iso);
    else syncDay(el);
  }

  function setValue(prefix, iso) {
    const el = els(prefix);
    if (!iso || !el.day || !el.month || !el.year) return;
    const parts = iso.split('-').map(Number);
    if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return;
    const [yy, mm, dd] = parts;
    if (mm < 1 || mm > 12) return;
    el.year.value = String(yy);
    el.month.value = String(mm);
    fillDay(el.day, maxDay(mm, yy));
    el.day.value = dd <= maxDay(mm, yy) ? String(dd) : String(maxDay(mm, yy));
  }

  function read(prefix) {
    const el = els(prefix);
    if (!el.day || !el.month || !el.year) return '';
    const y = Number(el.year.value), m = Number(el.month.value), d = Number(el.day.value);
    if (!y || !m || !d || m < 1 || m > 12 || d > maxDay(m, y)) return '';
    return y + '-' + pad(m) + '-' + pad(d);
  }

  window.DOB = { init, setValue, read, MONTHS, maxDay };
})();