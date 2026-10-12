/**
 * 豆色卡浏览器
 *
 * 把 palette.js 注册的各品牌色卡以可视网格展示，方便按品牌浏览、搜索色号、
 * 复制色号，并一键把当前品牌设为出图豆色板；另提供品牌对照表。
 *
 * 依赖：PBH.palettes（palette.js 与 js/palette/*.js 先于本文件加载）、PBH.fn.applyColorQuantization。
 */
(function (PBH) {
  'use strict';
  const { ref, computed } = Vue;

  // ===== 状态 =====
  /** 弹窗开关 */
  const ccOpen = ref(false);
  /** 当前视图：card（色卡）/ compare（品牌对照） */
  const ccTab = ref('card');
  /** 当前浏览的品牌 key */
  const ccActiveKey = ref('');
  /** 色号 / 色名 / HEX 过滤关键字 */
  const ccSearch = ref('');
  /** 最近一次复制的文本，用于显示提示，空串表示不显示 */
  const ccCopied = ref('');
  let ccCopiedTimer = null;

  /**
   * 从规格文案里兜底解析豆子直径（mm），meta.size 缺失时使用
   * @param {string} note - 规格说明，如 '美国 · 5mm midi · 58 色'
   * @returns {number|null}
   */
  const parseSizeMm = (note) => {
    const m = /(\d+(?:\.\d+)?)\s*mm/i.exec(note || '');
    return m ? parseFloat(m[1]) : null;
  };

  /**
   * 品牌清单：排除「原始色」，并派生产地 / 尺寸 / 成品边长等展示字段
   */
  const ccBrands = computed(() => {
    const all = PBH.palettes || {};
    return Object.keys(all)
      .filter((k) => k !== 'original' && all[k].colors && all[k].colors.length)
      .map((k) => {
        const p = all[k];
        const meta = p.meta || {};
        const size = typeof meta.size === 'number' ? meta.size : parseSizeMm(p.note);
        const note = p.note || '';
        return {
          key: k,
          label: p.label,
          note: note,
          count: p.colors.length,
          url: meta.url || '',
          origin: meta.origin || note.split('·')[0].trim(),
          size: size,
          // 58×58 拼豆成品的边长（cm），按豆子标称直径估算，便于和豆板规格对照
          board: size ? (58 * size / 10).toFixed(1) : null
        };
      });
  });

  /** 当前浏览的品牌；ccActiveKey 失效时回退到首个品牌 */
  const ccActive = computed(() => {
    const list = ccBrands.value;
    return list.find((b) => b.key === ccActiveKey.value) || list[0] || null;
  });

  /** 当前品牌过滤后的色卡列表 */
  const ccColors = computed(() => {
    if (!ccActive.value) return [];
    const raw = (PBH.palettes[ccActive.value.key] || {}).colors || [];
    const q = ccSearch.value.trim().toLowerCase();
    if (!q) return raw;
    return raw.filter((c) =>
      String(c.code || '').toLowerCase().indexOf(q) !== -1 ||
      String(c.name || '').toLowerCase().indexOf(q) !== -1 ||
      String(c.hex || '').toLowerCase().indexOf(q) !== -1
    );
  });

  // ===== 交互 =====

  /**
   * 打开豆色卡弹窗
   * @param {string} [key] - 想优先浏览的品牌 key（通常是当前豆色板），无效则沿用/回退
   */
  const openColorCard = (key) => {
    const list = ccBrands.value;
    if (list.some((b) => b.key === key)) {
      ccActiveKey.value = key;
    } else if (!list.some((b) => b.key === ccActiveKey.value)) {
      ccActiveKey.value = (list[0] || {}).key || '';
    }
    ccSearch.value = '';
    ccOpen.value = true;
  };

  const closeColorCard = () => {
    ccOpen.value = false;
  };

  /**
   * 切换弹窗视图
   * @param {'card'|'compare'} tab
   */
  const setColorCardTab = (tab) => {
    ccTab.value = tab;
  };

  /**
   * 切换浏览的品牌
   * @param {string} key
   */
  const setColorCardBrand = (key) => {
    ccActiveKey.value = key;
    ccSearch.value = '';
  };

  /** 把当前品牌设为出图豆色板并关闭弹窗 */
  const useColorCard = () => {
    if (!ccActive.value) return;
    PBH.state.paletteKey.value = ccActive.value.key;
    if (typeof PBH.fn.applyColorQuantization === 'function') {
      PBH.fn.applyColorQuantization();
    }
    ccOpen.value = false;
  };

  /** 显示「已复制」提示：连续复制时重置计时，避免提示提前消失 */
  const flashCopied = (text) => {
    ccCopied.value = text;
    if (ccCopiedTimer) clearTimeout(ccCopiedTimer);
    ccCopiedTimer = setTimeout(() => { ccCopied.value = ''; }, 1400);
  };

  /**
   * 复制色号（无色号时退化为 HEX），并给出提示
   * @param {Object} color - 色卡项 { code, name, hex }
   */
  const copyColorCode = (color) => {
    if (!color) return;
    const text = color.code || color.hex || '';
    if (!text) return;

    const fallback = () => {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.top = '-1000px';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        flashCopied(text);
      } catch (e) {
        flashCopied(text);
      }
    };

    // 非 https / 部分浏览器下 clipboard API 不可用，需回退到 execCommand
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => flashCopied(text)).catch(fallback);
    } else {
      fallback();
    }
  };

  // 状态与交互统一挂到 PBH，供 setup() 汇总注入模板
  Object.assign(PBH.state, {
    ccOpen, ccTab, ccActiveKey, ccSearch, ccCopied,
    ccBrands, ccActive, ccColors
  });
  Object.assign(PBH.fn, {
    openColorCard, closeColorCard, setColorCardTab, setColorCardBrand,
    useColorCard, copyColorCode
  });
})(window.PBH);
