/* Component preview tests (not used in the final render). */
(function (G) {
  'use strict';
  const K = G.K, N = G.N, A = G.ARCH, PR = G.PROPS, FX = G.FX, F = G.FIG;
  const T = G.TESTS = G.TESTS || {};

  T.nature = (d, t) => {
    N.sun(d, [1500, 220], 70, {}, t);
    N.mountains(d, { peaks: [{ x: 200, h: 420, w: 380 }, { x: 700, h: 520, w: 420 }, { x: 1300, h: 380, w: 360 }, { x: 1800, h: 470, w: 400 }], base: 760, seed: 3, fill: K.R.pal.fillFar, w: 2.4 });
    N.mist(d, { y: 640, h: 80, amp: 8, seed: 4 }, t);
    N.mountains(d, { peaks: [{ x: 400, h: 300, w: 500 }, { x: 1500, h: 260, w: 520 }], base: 860, seed: 5, fill: K.R.pal.fillMid, w: 3 });
    N.cloud(d, 420, 260, 1.2, { seed: 3 });
    N.cloud(d, 1100, 180, 0.9, { seed: 7, tailDir: 1 });
    N.river(d, { x0: 0, x1: 1920, y0: 860, y1: 1080, seed: 2 }, t);
    N.pine(d, 260, 900, 1.1, { seed: 4 }, t);
    N.bamboo(d, 1700, 1000, 520, { seed: 6 }, t);
    N.rock(d, 1400, 960, 60, { seed: 8 });
    N.grass(d, 1200, 1000, 40, { seed: 2 }, t);
    for (let i = 0; i < 4; i++) N.bird(d, 900 + i * 60, 300 + (i % 2) * 30, 1, t, { seed: i });
    N.crane(d, 700, 420, 1, t, {});
  };

  T.figures = (d, t) => {
    const looks = [
      { hair: 'bun', ribbon: true, gourd: true, seed: 1 },
      { hair: 'bun', ribbon: false, beard: 'full', build: 1.3, seed: 2 },
      { hair: 'long', ribbon: false, oneArm: true, seed: 3 },
      { hair: 'bun', ribbon: true, seed: 4 },
      { hair: 'messy', ribbon: false, beard: 'messy', seed: 5, hairColor: '#fff3e2' },
      { hair: 'bun', ribbon: false, beard: 'long', long: true, seed: 6, hairColor: '#fff3e2' },
    ];
    const poses = [
      { },
      Object.assign({}, F.walkPose(t * 0.8)),
      { lean: 18, hp1: 55, kn1: 60, hp2: -35, kn2: 5, sh1: 88, el1: 0, sh2: -40, el2: 30, wind: 0.8 },
      { lean: 10, hp1: 40, kn1: 40, hp2: -30, kn2: 5, sh1: 90, el1: 0, sh2: 85, el2: 5, wind: 0.5 },
      { lean: -5, hp1: 70, kn1: 110, hp2: -35, kn2: 70, sh1: 120, el1: 20, sh2: -60, el2: 20, wind: 1 },
      { sh1: 40, el1: 60, sh2: 10, el2: 20 },
    ];
    for (let i = 0; i < 6; i++) {
      const x = 170 + i * 300;
      const pose = Object.assign({ root: [x, 620], H: 420, dir: i % 2 ? -1 : 1 }, poses[i]);
      F.figure(d, pose, Object.assign({ hand1: i === 3 ? 'palm' : 'fist', hand2: i === 3 ? 'palm' : 'fist' }, looks[i]), t);
      if (i === 0) {
        const J = F.joints(Object.assign({}, F.POSE0, pose), Object.assign({}, F.LOOK0, looks[i]));
        PR.sword(d, J.A1.W, 70, 180, {}, t);
      }
    }
    // small disciples row
    for (let i = 0; i < 10; i++) {
      F.figure(d, Object.assign({ root: [120 + i * 175, 960], H: 150, dir: 1 }, F.walkPose(t * 0.9 + i * 0.13)), { detail: 'low', ribbon: false, seed: 50 + i, sash: false }, t);
    }
  };

  T.arch = (d, t) => {
    A.building(d, 80, 520, 260, 360, { seed: 101, roof: 'tank', sign: '舍我樓' });
    A.building(d, 420, 520, 200, 260, { seed: 102 });
    A.tunnel(d, 900, 520, 220, 260, { plaque: '世新大學' });
    A.paifang(d, 1450, 520, 420, 380, { plaque: '世新' });
    A.house(d, 60, 1000, 220, 150, { seed: 241 });
    A.house(d, 300, 1000, 240, 170, { seed: 242, lit: true });
    A.lantern(d, [620, 640], 30, t, { seed: 3 });
    A.torch(d, [720, 900], 90, t, { seed: 4 });
    A.printingPress(d, [1000, 860], 110, t, { label: '小世界' });
    A.banner(d, [1300, 1060], 380, 120, 260, t, { text: '世新' });
    A.swordMound(d, [1650, 1000], 150, {});
  };

  T.props = (d, t) => {
    PR.emblem(d, [260, 260], 180, {});
    PR.wordmark(d, 260, 520, {});
    PR.book(d, [800, 280], 440, 300, { open: 0.25, title: '武功秘笈' });
    PR.book(d, [1400, 280], 440, 300, { open: 1, flip: 2.4, pageText: (i) => [{ t: '第' + (i + 1) + '頁', y: 0.3 }] });
    PR.scroll(d, 700, 520, 180, 460, 0.9, {});
    PR.newspaper(d, [1050, 700], 300, 380, { title: '小世界', date: '1957.3', photo: true, seed: 701 });
    PR.newspaper(d, [1450, 650], 200, 150, { title: '小世界', bend: 0.6, ang: -15, seed: 702 });
    PR.leadType(d, [1600, 820], 70, '新', {});
    PR.phone(d, [1800, 820], 150, 290, {});
    PR.camera(d, [1350, 900], 110, {});
    PR.mic(d, [1500, 950], 110, {});
    PR.writingBrush(d, [300, 900], -40, 260, {});
    PR.seal(d, [560, 900], 110, '秘笈', {});
    PR.heavySword(d, [120, 1000], -20, 300, {});
    PR.saber(d, [900, 980], 20, 160, {});
    FX.revealText(d, '世新大學新聞系的武功秘笈', 960, 1050, (t % 3) / 2, { size: 60 });
  };

  T.creatures = (d, t) => {
    const path = K.spline([[100, 900], [500, 600], [900, 700], [1300, 350], [1800, 450]], 12);
    F.dragon(d, path, 0.9, t, { len: 1000, width: 80 });
    F.eagle(d, [400, 250], 120, t, {});
    F.eagle(d, [1600, 820], 110, t, { mode: 'perch', dir: -1 });
    N.bigWave(d, 1100, 1060, 300, { phase: 0.8, seed: 5 });
  };

  // dragon head close-ups: flying right, diving down-right (as in the
  // writing scene) and flying left
  T.dragonHead = (d, t) => {
    F.dragon(d, K.spline([[-300, 380], [300, 300], [720, 330]], 10), 1, t, { len: 700, width: 140 });
    F.dragon(d, K.spline([[1050, -60], [1300, 150], [1500, 420], [1600, 640]], 10), 1, t, { len: 600, width: 100 });
    F.dragon(d, K.spline([[1300, 1000], [800, 1000], [420, 880]], 10), 1, t, { len: 600, width: 100 });
  };

  T.fx = (d, t) => {
    FX.slashArc(d, [500, 500], 300, -150, 20, 0.45, {});
    FX.burst(d, [1100, 400], 200, 0.4, {});
    FX.sparks(d, [1500, 400], 0, 0.3, {});
    FX.dust(d, [600, 900], 0, 0.6, {});
    FX.qiSwirl(d, [1300, 800], 120, t, {});
    FX.streak(d, [100, 150], [900, 120], 0.4, {});
    FX.formLabel(d, 1800, 150, 1, { num: '第一式', name: '獨孤九劍', skill: '採訪' });
  };
})(typeof window !== 'undefined' ? window : globalThis);
(function (G) {
  const K = G.K, N = G.N, F = G.FIG;
  G.TESTS.birds = (d, t) => {
    for (let i = 0; i < 4; i++) N.crane(d, 300 + i * 440, 300, 1.6, t + i * 0.26, { rate: 2.6 });
    for (let i = 0; i < 4; i++) F.eagle(d, [300 + i * 440, 780], 150, t + i * 0.3, { mode: 'fly', dir: -1, rate: 4 });
  };
})(typeof window !== 'undefined' ? window : globalThis);
