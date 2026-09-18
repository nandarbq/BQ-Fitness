/* Animasi "template tutor" untuk sesi latihan: siluet SVG sederhana (garis
 * tebal bergaya ikon) yang di-loop memainkan gerakan latihan dumbbell.
 * Tiap gerakan = kombinasi elemen statis + 1–2 grup `.dm-mv` yang di-animasi
 * CSS (keyframes ada di style.css). Grup yang bergerak memakai transform-origin
 * dinamis lewat CSS custom properties `--ox`/`--oy` (koordinat viewBox).

 * Gerakan yang divisualkan:
 *   curl/hammer  -> angkat dumbbell ke bahu
 *   press        -> dorong dumbbell ke atas kepala
 *   lateral      -> buka lengan ke samping setinggi bahu
 *   shrug        -> angkat bahu ke atas
 *   squat/lunge  -> badan turun-naik (squat/goblet)
 *   calf         -> jinjit
 *   tri          -> ekstensi trisep di atas kepala
 *   kickback     -> ekstensi trisep dari posisi condong
 *   row          -> tarik dumbbell ke pinggang (condong)
 *   rdl          -> gerakkan sendi pinggul (hinge) bawa dumbbell
 *   bench        -> dumbbell press telentang
 *   fly          -> dumbbell fly telentang (buka-tutup)
 *   pullover     -> dumbbell pullover telentang (ayun lewat kepala) */

function _frontBody() {
  return [
    '<circle cx="100" cy="32" r="14"/>',
    '<line x1="100" y1="48" x2="100" y2="98"/>',
    '<line x1="86" y1="98" x2="114" y2="98"/>',
    '<path d="M86 98 L82 196 M114 98 L118 196"/>',
    '<path d="M72 196 L92 196 M108 196 L128 196"/>'
  ].join('');
}

function _sideBentBody() {
  /* condong ke depan, tampak samping: hip kiri, dada kanan */
  return [
    '<path d="M62 100 L52 198 M62 100 L88 198"/>',
    '<path d="M44 198 L64 198 M84 198 L102 198"/>',
    '<path d="M62 100 L118 74"/>',
    '<circle cx="132" cy="66" r="12"/>'
  ].join('');
}

function _lyingBody() {
  /* telentang datar: kepala kiri, kaki kanan */
  return [
    '<circle cx="28" cy="94" r="12"/>',
    '<path d="M40 94 L108 104"/>',
    '<line x1="108" y1="104" x2="132" y2="116"/>',
    '<path d="M132 116 L168 124"/>',
    '<path d="M168 124 L186 120"/>'
  ].join('');
}

function _db(x, y, w, h) {
  return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="5" class="dm-weight"/>';
}

const DEMOS = {

  curl() {
    return `<svg class="dm-fig dm-curl" viewBox="0 0 200 230" role="img" aria-label="Dumbbell curl">
      <g class="dm-static">${_frontBody()}<line x1="74" y1="60" x2="74" y2="114"/><line x1="126" y1="60" x2="126" y2="114"/><line x1="30" y1="210" x2="170" y2="210" class="dm-ground"/></g>
      <g class="dm-mv dm-mvA" style="--ox:126px;--oy:114px"><line x1="126" y1="114" x2="126" y2="164"/><path d="M126 158 L126 176" class="dm-weight"/><rect x="117" y="164" width="18" height="16" rx="5" class="dm-weight"/></g>
      <g class="dm-mv dm-mvB" style="--ox:74px;--oy:114px"><line x1="74" y1="114" x2="74" y2="164"/><path d="M74 158 L74 176" class="dm-weight"/><rect x="65" y="164" width="18" height="16" rx="5" class="dm-weight"/></g>
    </svg>`;
  },

  hammer() {
    return DEMOS.curl();
  },

  press() {
    return `<svg class="dm-fig dm-press" viewBox="0 0 200 230" role="img" aria-label="Dumbbell overhead press">
      <g class="dm-static">${_frontBody()}<line x1="30" y1="210" x2="170" y2="210" class="dm-ground"/></g>
      <g class="dm-mv dm-mvA" style="--ox:126px;--oy:60px"><path d="M126 60 L148 88 L152 106"/><path d="M148 100 L152 116" class="dm-weight"/><rect x="141" y="108" width="22" height="16" rx="5" class="dm-weight"/></g>
      <g class="dm-mv dm-mvB" style="--ox:74px;--oy:60px"><path d="M74 60 L52 88 L48 106"/><path d="M52 100 L48 116" class="dm-weight"/><rect x="37" y="108" width="22" height="16" rx="5" class="dm-weight"/></g>
    </svg>`;
  },

  lateral() {
    return `<svg class="dm-fig dm-lateral" viewBox="0 0 200 230" role="img" aria-label="Dumbbell lateral raise">
      <g class="dm-static">${_frontBody()}<line x1="30" y1="210" x2="170" y2="210" class="dm-ground"/></g>
      <g class="dm-mv dm-mvA" style="--ox:126px;--oy:60px"><line x1="126" y1="60" x2="126" y2="148"/><rect x="117" y="148" width="18" height="16" rx="5" class="dm-weight"/></g>
      <g class="dm-mv dm-mvB" style="--ox:74px;--oy:60px"><line x1="74" y1="60" x2="74" y2="148"/><rect x="65" y="148" width="18" height="16" rx="5" class="dm-weight"/></g>
    </svg>`;
  },

  rearfly() {
    return `<svg class="dm-fig dm-rear" viewBox="0 0 200 230" role="img" aria-label="Dumbbell reverse fly">
      <g class="dm-static">${_frontBody()}<path d="M38 170 Q100 136 162 170" class="dm-cloud"/><line x1="30" y1="210" x2="170" y2="210" class="dm-ground"/></g>
      <g class="dm-mv dm-mvA" style="--ox:126px;--oy:60px"><line x1="126" y1="60" x2="126" y2="150"/><rect x="117" y="150" width="18" height="16" rx="5" class="dm-weight"/></g>
      <g class="dm-mv dm-mvB" style="--ox:74px;--oy:60px"><line x1="74" y1="60" x2="74" y2="150"/><rect x="65" y="150" width="18" height="16" rx="5" class="dm-weight"/></g>
    </svg>`;
  },

  shrug() {
    return `<svg class="dm-fig dm-shrug" viewBox="0 0 200 230" role="img" aria-label="Dumbbell shrug">
      <g class="dm-static">${_frontBody().replace('<line x1="86" y1="98" x2="114" y2="98"/>', '')}<line x1="30" y1="210" x2="170" y2="210" class="dm-ground"/></g>
      <g class="dm-mv dm-mvA" style="--ox:100px;--oy:58px"><line x1="72" y1="58" x2="128" y2="58"/><line x1="72" y1="58" x2="72" y2="150"/><line x1="128" y1="58" x2="128" y2="150"/><rect x="61" y="150" width="22" height="16" rx="5" class="dm-weight"/><rect x="117" y="150" width="22" height="16" rx="5" class="dm-weight"/></g>
    </svg>`;
  },

  squat() {
    return `<svg class="dm-fig dm-squat" viewBox="0 0 200 230" role="img" aria-label="Goblet squat">
      <g class="dm-static"><path d="M86 98 L82 196 M114 98 L118 196"/><path d="M72 196 L92 196 M108 196 L128 196"/><line x1="30" y1="210" x2="170" y2="210" class="dm-ground"/></g>
      <g class="dm-mv dm-mvA">
        <circle cx="100" cy="32" r="14"/><line x1="100" y1="48" x2="100" y2="118"/>
        <line x1="90" y1="66" x2="110" y2="66"/><line x1="90" y1="66" x2="90" y2="102"/><line x1="110" y1="66" x2="110" y2="102"/>
        <rect x="88" y="36" width="24" height="30" rx="7" class="dm-weight"/>
      </g>
    </svg>`;
  },

  lunge() {
    /* dipakai untuk reverse lunge & bulgarian split squat */
    return `<svg class="dm-fig dm-lunge" viewBox="0 0 200 230" role="img" aria-label="Dumbbell lunge">
      <g class="dm-static"><path d="M86 98 L82 196 M114 98 L118 196"/><path d="M72 196 L92 196 M108 196 L128 196"/><line x1="30" y1="210" x2="170" y2="210" class="dm-ground"/></g>
      <g class="dm-mv dm-mvA">
        <circle cx="100" cy="32" r="14"/><line x1="100" y1="48" x2="100" y2="118"/>
        <line x1="82" y1="54" x2="82" y2="96"/><line x1="118" y1="54" x2="118" y2="96"/>
        <rect x="72" y="90" width="20" height="16" rx="5" class="dm-weight"/><rect x="108" y="90" width="20" height="16" rx="5" class="dm-weight"/>
      </g>
    </svg>`;
  },

  calf() {
    return `<svg class="dm-fig dm-calf" viewBox="0 0 200 230" role="img" aria-label="Standing calf raise">
      <line x1="30" y1="210" x2="170" y2="210" class="dm-ground"/>
      <g class="dm-mv dm-mvA">
        ${_frontBody()}
        <line x1="70" y1="54" x2="70" y2="148"/><line x1="130" y1="54" x2="130" y2="148"/>
        <rect x="59" y="148" width="22" height="16" rx="5" class="dm-weight"/><rect x="119" y="148" width="22" height="16" rx="5" class="dm-weight"/>
      </g>
    </svg>`;
  },

  tri() {
    return `<svg class="dm-fig dm-tri" viewBox="0 0 200 230" role="img" aria-label="Overhead triceps extension">
      <g class="dm-static">${_frontBody()}<line x1="100" y1="46" x2="100" y2="14"/><line x1="30" y1="210" x2="170" y2="210" class="dm-ground"/></g>
      <g class="dm-mv dm-mvA" style="--ox:100px;--oy:14px"><line x1="100" y1="14" x2="116" y2="26"/><path d="M116 20 L120 36" class="dm-weight"/><rect x="110" y="4" width="24" height="16" rx="5" class="dm-weight"/></g>
    </svg>`;
  },

  kickback() {
    return `<svg class="dm-fig dm-kick" viewBox="0 0 200 230" role="img" aria-label="Dumbbell kickback">
      <g class="dm-static">${_sideBentBody()}<line x1="30" y1="210" x2="170" y2="210" class="dm-ground"/></g>
      <g class="dm-mv dm-mvA" style="--ox:118px;--oy:74px"><line x1="118" y1="74" x2="118" y2="122"/><line x1="118" y1="122" x2="118" y2="170"/><rect x="108" y="170" width="20" height="16" rx="5" class="dm-weight"/></g>
    </svg>`;
  },

  row() {
    return `<svg class="dm-fig dm-row" viewBox="0 0 200 230" role="img" aria-label="Dumbbell row">
      <g class="dm-static">${_sideBentBody()}<line x1="30" y1="210" x2="170" y2="210" class="dm-ground"/></g>
      <g class="dm-mv dm-mvA" style="--ox:118px;--oy:74px"><line x1="118" y1="74" x2="118" y2="118"/><line x1="118" y1="118" x2="118" y2="168"/><rect x="108" y="168" width="20" height="16" rx="5" class="dm-weight"/></g>
    </svg>`;
  },

  rdl() {
    return `<svg class="dm-fig dm-rdl" viewBox="0 0 200 230" role="img" aria-label="Dumbbell Romanian deadlift">
      <g class="dm-static"><path d="M62 100 L52 198 M62 100 L88 198"/><path d="M44 198 L64 198 M84 198 L102 198"/><line x1="30" y1="210" x2="170" y2="210" class="dm-ground"/></g>
      <g class="dm-mv dm-mvA" style="--ox:62px;--oy:100px"><path d="M62 100 L118 74"/><circle cx="132" cy="66" r="12"/><line x1="118" y1="74" x2="118" y2="168"/><rect x="108" y="168" width="20" height="16" rx="5" class="dm-weight"/></g>
    </svg>`;
  },

  bench() {
    return `<svg class="dm-fig dm-bench" viewBox="0 0 200 230" role="img" aria-label="Dumbbell bench press">
      <g class="dm-static">${_lyingBody()}</g>
      <g class="dm-mv dm-mvA" style="--ox:106px;--oy:104px"><line x1="106" y1="104" x2="122" y2="58"/><rect x="113" y="42" width="18" height="16" rx="5" class="dm-weight"/></g>
      <g class="dm-mv dm-mvB" style="--ox:62px;--oy:98px"><line x1="62" y1="98" x2="46" y2="52"/><rect x="37" y="36" width="18" height="16" rx="5" class="dm-weight"/></g>
    </svg>`;
  },

  fly() {
    return `<svg class="dm-fig dm-fly" viewBox="0 0 200 230" role="img" aria-label="Dumbbell fly">
      <g class="dm-static">${_lyingBody()}</g>
      <g class="dm-mv dm-mvA" style="--ox:106px;--oy:102px"><line x1="106" y1="102" x2="166" y2="108"/><rect x="162" y="96" width="18" height="16" rx="5" class="dm-weight"/></g>
      <g class="dm-mv dm-mvB" style="--ox:62px;--oy:96px"><line x1="62" y1="96" x2="2" y2="102"/><rect x="4" y="90" width="18" height="16" rx="5" class="dm-weight"/></g>
    </svg>`;
  },

  pullover() {
    return `<svg class="dm-fig dm-pull" viewBox="0 0 200 230" role="img" aria-label="Dumbbell pullover">
      <g class="dm-static">${_lyingBody()}</g>
      <g class="dm-mv dm-mvA" style="--ox:80px;--oy:100px"><path d="M80 100 L10 92"/><line x1="8" y1="92" x2="8" y2="76"/><rect x="4" y="74" width="24" height="16" rx="5" class="dm-weight"/></g>
    </svg>`;
  }
};

function exerciseDemoSVG(anim) {
  const fn = DEMOS[anim];
  return fn ? fn() : DEMOS.curl();
}