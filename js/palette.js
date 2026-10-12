/**
 * 真实拼豆色板数据入口（供颜色量化映射到真实豆色使用）
 *
 * 各品牌色卡已拆分到 js/palette/ 目录，单独维护，通过 PBH.definePalette 注册：
 *  - perler.js        Perler（美国 · 5mm midi）
 *  - hama.js          Hama（丹麦 · 5mm midi）
 *  - mixiaowo.js      咪小窝（MARD 色卡对照）
 *  - mard-221.js      MARD 221
 *  - mard-291.js      MARD 291
 *  - coco-291.js      COCO 291
 *  - artkal.js        Artkal
 *  - artkal-mini.js   Artkal Mini
 *
 * 色卡数据参照各品牌公开色卡整理（色号 + HEX），仅作选色参考。
 * 注：屏幕 HEX 与实物豆子存在批次/光线差异，最终以实物为准。
 */
(function (PBH) {
  'use strict';

  /** 全部色板的注册表，也是对外暴露的 PBH.palettes */
  const PALETTES = (PBH.palettes = PBH.palettes || {});

  /**
   * 注册一个品牌色板。
   * @param {string} key    唯一键（同时用作下拉框的 value）
   * @param {string} label  下拉框显示名
   * @param {string} note   规格说明（尺寸 / 产地 / 色数），用于下拉框下方与色卡页展示
   * @param {Array}  colors 色卡项：{ code, name, hex, r, g, b }
   * @param {Object} [meta] 结构化元信息，供豆色卡浏览 / 品牌对照使用：
   *                        { url: 官网或官方渠道, origin: 产地, size: 豆子直径 mm（未知为 null） }
   */
  PBH.definePalette = function (key, label, note, colors, meta) {
    PALETTES[key] = {
      key: key,
      label: label,
      note: note,
      colors: colors || [],
      meta: meta || {}
    };
  };

  // 原始色：不做豆色映射，直接沿用图片量化结果
  PBH.definePalette('original', '原始色', '不做豆色映射，直接沿用图片量化结果', []);
})(window.PBH);
