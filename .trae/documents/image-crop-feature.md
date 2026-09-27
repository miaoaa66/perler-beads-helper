# 拼豆工具 - 图片裁剪功能实现计划

## 1. Summary（概述）

在现有单文件应用 `index.html` 的「操作面板」抽屉中新增一个「图片裁剪」按钮。点击后打开一个**居中弹窗(Masked Modal)**，在弹窗内**重新上传一张新图片**，然后通过可拖拽、可缩放的裁剪框框选范围。裁剪框支持三种比例锁定方式（预设比例 / 自定义比例 / 自定义宽高像素，三者均只锁定裁剪框的宽高比）。点击「裁剪并保存」后将裁剪结果**下载保存到本地**（PNG 图片），供用户自行上传到豆板，**不替换**主画布的 `originalImage`。

所有改动集中在 `index.html` 单文件内，纯原生实现（不引入任何第三方库，符合用户偏好）。

## 2. Current State Analysis（现状分析）

- `index.html` 是一个 Vue 3 单文件应用，使用全局 `Vue`（`./static/vue.3.5.38.js`），Composition API + `setup()`。
- 现有的图片处理链路：
  - `processFile(file)`：校验格式/大小 → `FileReader` → `Image` → 设置 `originalImage` 和 `imageInfo` → `generatePixelArt()`。
  - `generatePixelArt()`：把原图按 `pixelWidth`/`pixelHeight` 做 **cover 居中裁剪 + 下采样**，得到 `pixelData`（[index.html#L669-L704](file:///f:/3project/it/ai实现/拼豆工具/index.html#L669-L704)）。
- 现有 UI 结构：`.drawer-container` 内 `.drawer-content` 是「操作面板」抽屉，`toggleDrawer` 控制开合（[index.html#L313-L357](file:///f:/3project/it/ai实现/拼豆工具/index.html#L313-L357)）。
- `setup()` 内维护的状态与返回对象见 [index.html#L431-L981](file:///f:/3project/it/ai实现/拼豆工具/index.html#L431-L981)。
- 当前**没有任何**手动裁剪能力，用户上传后只能被动接受 cover 裁剪。

关键约束：文件是 `.html`，无构建、无包管理器、无测试框架，验证方式为浏览器手动操作。

## 3. Proposed Changes（改动方案）

所有改动均在 `f:\3project\it\ai实现\拼豆工具\index.html`。

### 3.1 新增 CSS 样式（追加到 `<style>` 内）

在现有 `</style>` 前追加以下类：

- `.crop-modal-overlay`：`position: fixed; inset: 0; z-index: 200; background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center;`
- `.crop-modal`：`background: #16213e; border-radius: 12px; padding: 20px; width: 90%; max-width: 860px; max-height: 90vh; display: flex; flex-direction: column;`（深色风格与现有主题一致）
- `.crop-modal-header` / `.crop-modal-header h3` / 关闭按钮样式（关闭按钮左对齐、标题右侧，符合用户偏好）。
- `.crop-upload-zone`：未上传图片时的提示区（虚线框 + 文案），复用现有 `.empty-state` 视觉风格。
- `.crop-ratio-section`：比例选择区（`.ratio-group` 横向 flex + gap）。
- `.ratio-btn`：预设比例按钮；`.ratio-btn.active` 高亮（沿用主题色 `linear-gradient(135deg, #00d9ff, #00a8cc)`）。
- `.crop-stage`：图片裁剪区容器，`position: relative; background: #0f3460; width: 100%; max-height: 55vh; display: flex; justify-content: center; align-items: center; overflow: hidden;` 内含图片与裁剪框。
- `.crop-source-img`：`max-width: 100%; max-height: 100%; display: block; user-select: none;`
- `.crop-box`：绝对定位裁剪框，`border: 1px solid #00d9ff; box-shadow: 0 0 0 9999px rgba(0,0,0,0.5); cursor: move; position: absolute;`
- `.crop-handle`：8 个缩放手柄，`position: absolute; background: #00d9ff; width/height: 10px;`，按方位设置定位（`nw/n/ne/e/se/s/sw/w`）及对应 `cursor`（`nwse-resize`、`ns-resize`、`nesw-resize`、`ew-resize` 等）。
- `.crop-modal-footer`：底部按钮区，`display: flex; justify-content: flex-end; gap: 8px;`（沿用 `.btn` / `.btn-secondary` 类，圆角一致、颜色区分边界）。

### 3.2 新增 HTML（模板内）

**（A）操作面板抽屉内**：在「重置位置」按钮之后新增一个「图片裁剪」按钮：

```html
<button class="btn btn-secondary" @click="openCropModal">
  图片裁剪
</button>
```

> 说明：裁剪弹窗内**重新上传新图片**，与主画布当前图片无关，因此此按钮**始终可点击、无 disabled 绑定**。

**（B）`#app` 末尾（mainCanvas 相关节点之外、`</div>` 之前）**：新增裁剪弹窗结构：

```html
<div v-if="cropModalOpen" class="crop-modal-overlay" @mousedown.self="closeCropModal">
  <div class="crop-modal">
    <div class="crop-modal-header">
      <button class="crop-close" @click="closeCropModal">×</button>
      <h3>图片裁剪</h3>
    </div>

    <!-- 未上传：上传区 -->
    <div v-else="!cropImage" class="crop-upload-zone">
      <input type="file" accept="image/*" @change="handleCropImageUpload">
      <p>点击选择或拖拽图片到此处</p>
    </div>

    <!-- 已上传：比例选择 + 裁剪区 -->
    <template v-else>
      <div class="crop-ratio-section">
        <div class="ratio-group">
          <button v-for="p in presetRatios" :key="p.label"
                  class="ratio-btn" :class="{ active: activeRatio === p.label }"
                  @click="setPresetRatio(p)">{{ p.label }}</button>
        </div>
        <div class="ratio-group">
          <label>自定义比例</label>
          <input type="number" v-model.number="customRatioW" min="1" @input="applyCustomRatio">
          <span>:</span>
          <input type="number" v-model.number="customRatioH" min="1" @input="applyCustomRatio">
        </div>
        <div class="ratio-group">
          <label>自定义宽高像素</label>
          <input type="number" v-model.number="customPxW" min="1" @input="applyCustomPixels">
          <span>×</span>
          <input type="number" v-model.number="customPxH" min="1" @input="applyCustomPixels">
        </div>
        <input type="range" v-model.number="cropZoom" min="0.5" max="3" step="0.1"> （缩放原图显示，可选增强）
      </div>

      <div class="crop-stage" ref="cropStage"
           @mousedown="handleCropMouseDown" @mousemove="handleCropMouseMove"
           @mouseup="handleCropMouseUp" @mouseleave="handleCropMouseUp">
        <img ref="cropImageEl" :src="cropImageSrc" class="crop-source-img"
             @dragstart.prevent>
        <div class="crop-box" :style="cropBoxStyle" @mousedown.stop="startMoveCrop">
          <div class="crop-handle" style="..." v-for="h in handles" ...></div>
        </div>
      </div>
    </template>

    <div class="crop-modal-footer">
      <button class="btn btn-secondary" @click="closeCropModal">取消</button>
      <button class="btn" @click="applyCrop" :disabled="!cropImage">裁剪并保存</button>
    </div>
  </div>
</div>
```

> 手柄用 `v-for` 遍历 8 个方向常量 `handles = ['nw','n','ne','e','se','s','sw','w']`，用对象映射定位与光标样式；每个手柄 `@mousedown.stop="startResizeCrop(h)"`。

### 3.3 新增 JS 状态（`setup()` 内，紧跟现有 ref 声明后）

```js
// 裁剪弹窗
const cropModalOpen = ref(false);
const cropImage = ref(null);        // 弹窗内上传的 Image 对象
const cropImageSrc = ref('');       // 图片 dataURL 用于 <img> 显示
const cropImageEl = ref(null);      // 显示图片 DOM
const cropStage = ref(null);        // 裁剪容器 DOM
// 比例锁定
const cropAspectRatio = ref(null);  // null=自由, 数字=w/h 比例
const activeRatio = ref('自由');
const customRatioW = ref(1), customRatioH = ref(1);
const customPxW = ref(1), customPxH = ref(1);
// 裁剪框（相对 stage 坐标，像素）
const cropRect = ref({ x: 0, y: 0, w: 100, h: 100 });
// 拖拽状态
const cropDragMode = ref(null);     // null | 'move' | 手柄方向
const cropDragStart = ref({ mouseX: 0, mouseY: 0, rect: {x:0,y:0,w:0,h:0} });
```

预设比例常量：

```js
const presetRatios = [
  { label: '自由', ratio: null },
  { label: '1:1', ratio: 1 },
  { label: '4:3', ratio: 4 / 3 },
  { label: '3:4', ratio: 3 / 4 },
  { label: '16:9', ratio: 16 / 9 },
  { label: '9:16', ratio: 9 / 16 },
  { label: '3:2', ratio: 3 / 2 },
  { label: '2:3', ratio: 2 / 3 }
];
const handles = ['nw','n','ne','e','se','s','sw','w'];
```

### 3.4 新增 JS 函数（`setup()` 内）

**打开/关闭：**
- `openCropModal()`：`cropModalOpen.value = true`；重置 `cropImage=null`、`cropImageSrc=''`、`cropRect`、比例相关状态为默认（自由比例）。
- `closeCropModal()`：`cropModalOpen.value = false; cropImage.value = null; cropImageSrc.value = '';`

**上传：**
- `handleCropImageUpload(event)`：复用现有校验逻辑（格式/大小，同 `processFile` 里的限制），读文件 → `Image` → 设置 `cropImage`、`cropImageSrc` → `nextTick` 后调用 `initCropRect()`。

**比例：**
- `setPresetRatio(p)`：`activeRatio=p.label`；`cropAspectRatio.value = p.ratio`；`nextTick(initCropRect)`。
- `applyCustomRatio()`：若 `customRatioW>0 && customRatioH>0`，`cropAspectRatio = customRatioW/customRatioH`；`activeRatio='自定义'`；调整当前 `cropRect` 保持比例（居中缩放）。
- `applyCustomPixels()`：同上，`cropAspectRatio = customPxW/customPxH`。

**裁剪框初始化与几何：**
- `initCropRect()`：读取 `cropImageEl` 与 `cropStage` 的 `getBoundingClientRect()`，计算图片显示尺寸；若 `cropAspectRatio` 为 null，初始框 = 显示图片的 80% 居中；否则在其内取满足比例的最大居中框。结果写入 `cropRect`。
- 辅助：图片在 stage 内的偏移 `imgOffsetLeft/Top` 与显示缩放 `displayScale`（在计算时实时获取，不落地为状态，避免响应式负担）。

**拖拽交互：**
- `startMoveCrop(e)`：`cropDragMode='move'`；记录 `cropDragStart`。
- `startResizeCrop(h)`：`cropDragMode=h`；记录 `cropDragStart`。
- `handleCropMouseMove(e)`：若 `cropDragMode` 为 null 返回；计算相对 `cropDragStart` 的 `dx/dy`；根据模式更新 `cropRect`：
  - `move`：平移，并 clamp 到图片显示范围内。
  - 手柄缩放：从锚点（对角方向）计算新宽高；有比例锁定时强制宽高比；四角手柄按比例推导宽高，边手柄按比例推导对边。始终 clamp 最小尺寸（10px）与图片边界。
- `handleCropMouseUp()`：`cropDragMode=null`。

**确认裁剪并保存：**
- `applyCrop()`：读取 stage/img 的 rect，计算 `scale = cropImage.naturalWidth / imgRect.width`；把 `cropRect`（stage 坐标）转为原图像素坐标 `sx/sy/sw/sh`；创建临时 `canvas`，尺寸为 `Math.round(sw) × Math.round(sh)`，`ctx.drawImage(cropImage, sx, sy, sw, sh, 0, 0, outW, outH)`；`outCanvas.toDataURL('image/png')` → 创建 `<a download>` 触发下载（文件名 `拼豆裁剪_${outW}x${outH}.png`，沿用 `downloadPixelArt` 的下载方式）；下载完成后 `cropModalOpen=false` 关闭弹窗，**不修改主画布的 `originalImage`**。

### 3.5 修改 return 对象

在 `setup()` 的 `return { ... }` 中追加所有新增状态与函数，供模板使用：
`cropModalOpen, cropImage, cropImageSrc, cropImageEl, cropStage, cropRect, cropBoxStyle（computed）, cropAspectRatio, activeRatio, presetRatios, handles, customRatioW, customRatioH, customPxW, customPxH, openCropModal, closeCropModal, handleCropImageUpload, setPresetRatio, applyCustomRatio, applyCustomPixels, startMoveCrop, startResizeCrop, handleCropMouseDown, handleCropMouseMove, handleCropMouseUp, applyCrop`。

其中 `cropBoxStyle` 为 computed，把 `cropRect` 转为内联样式 `{ left, top, width, height }`（均为 px）。

### 3.6 结构说明

- 通过 `v-if="cropModalOpen"` 控制弹窗显隐，点击遮罩（`.self`）或关闭/取消按钮关闭。
- 弹窗内图片区域完全独立于主画布，不影响现有 `preview-container` 的缩放/拖拽逻辑。

## 4. Assumptions & Decisions（假设与决策）

1. **图片来源**：每次在裁剪弹窗内重新上传新图片（用户已确认），与主画布当前图片无关。
2. **比例语义**：「预设比例 / 自定义比例 / 自定义宽高像素」三者都**只锁定裁剪框宽高比**；裁剪结果按框选区域的原图像素尺寸直接输出保存，不经过主面板的像素采样（用户已确认）。
3. **呈现形式**：采用**居中弹窗（Modal）**而非抽屉或新页面——抽屉已被「操作面板」占用，且裁剪需要较大横向空间，modal 最合适；单文件应用不接受额外页面文件。
4. **技术栈**：纯原生 Vue + DOM 事件实现裁剪框，不引入 cropper.js 等第三方库（符合用户「优先纯原生」偏好）。
5. **裁剪输出格式**：统一输出 PNG（含透明通道），保证透明背景图裁剪后 alpha 正确保留；裁剪结果直接下载到本地，供用户自行上传豆板。
6. **裁剪框色系**：沿用主题青色 `#00d9ff` 与深色底 `#16213e`/`#0f3460`，与现有 UI 一致。
7. **按钮定位**：裁剪按钮放在「重置位置」之后，作为操作面板最后一项（不移动现有按钮顺序）。

## 5. Verification（验证步骤）

用浏览器打开 `index.html`，手动逐项验证：

1. **入口**：点击「操作面板」抽屉展开，能看到「图片裁剪」按钮。
2. **打开弹窗**：点击「图片裁剪」→ 出现居中裁剪弹窗，含上传区。
3. **上传图片**：在弹窗内上传一张图片 → 显示图片，出现默认裁剪框（图片 80% 居中）。
4. **预设比例**：依次点击 `1:1 / 4:3 / 16:9 / 自由` 等按钮 → 裁剪框按要求保持比例、按钮高亮正确。
5. **自定义比例**：输入 `3` 和 `2` → 裁剪框变为 3:2 比例。
6. **自定义宽高像素**：输入 `300` 和 `200` → 裁剪框变为 3:2 比例（等价锁比例）。
7. **拖拽移动**：按住裁剪框内部拖动 → 整个框移动，且不超出图片范围。
8. **缩放**：拖动四角/四边手柄 → 框大小改变；锁定比例时四角缩放保持比例；限制最小尺寸与图片边界。
9. **裁剪并保存**：点击「裁剪并保存」→ 浏览器下载一张裁剪后的 PNG 图片到本地，尺寸等于框选区域的原图像素；弹窗关闭，主画布原有图片与像素画**保持不变**。
10. **取消**：点击「取消」或遮罩 → 弹窗关闭，主画布原有图片不变。
11. **回归**：确认原有功能（上传、宽高调整、颜色数量、翻转、缩放、拖动、下载）均不受影响。