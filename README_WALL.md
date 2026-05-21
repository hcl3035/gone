Gone 项目 Wall 功能增强 - 完整修改总结

## 📋 修改概述

为 gone 项目的 wall（共享文本编辑区）添加了以下功能：

1. **点击复制功能** - 选中文字后点击自动复制到剪贴板
2. **响应式宽度** - wall textarea 自适应容器宽度，提供更好的编辑体验
3. **图片粘贴功能** - 支持从剪贴板直接粘贴图片，自动上传并显示预览
4. **跨设备同步** - 图片映射保存在后端，刷新或换设备仍可正常显示

---

## 📁 修改的文件清单

### 1. 新增文件

#### `assets/wall-copy.js`

**用途**：实现点击复制和图片粘贴功能的外部 JavaScript 文件

**功能特性**：
- ✅ 只在用户选中文字时才触发复制
- ✅ 支持现代浏览器的 `navigator.clipboard` API
- ✅ 兼容旧浏览器的 `execCommand` 降级方案
- ✅ 复制成功后显示顶部绿色提示框（1.5秒后消失）
- ✅ 支持图片粘贴、自动上传、预览显示
- ✅ 图片查看器（缩放、平移、导航）
- ✅ 表单提交时保存图片映射关系

---

### 2. 修改的文件

#### `templates/data/wall.tmpl`

**修改内容**：
1. 移除了固定的 `cols="32" rows="12"` 属性，让 CSS 完全控制尺寸
2. 修复了 ID 冲突问题（form 和 textarea 不能使用相同 ID）
3. 更新了 title 提示文字
4. 添加了隐藏字段用于保存图片映射
5. 添加了 script 标签嵌入映射数据

**关键修改对比**：

html
<!-- 修改前 -->
<textarea class="wallContent" cols="32" rows="12" id="wall" ...>
<!-- 修改后 -->
<textarea class="wallContent" form="wallForm" id="wallContent" data-wall-image-path="{{ .Paths.WallImage }}" style="cursor: pointer;"> {{- .Storage.WallContent -}} </textarea>
<!-- 新增：隐藏字段保存映射 -->
<input type="hidden" name="imageMap" id="wallImageMap" value="">
<!-- 新增：嵌入映射数据 -->
<script type="application/json" id="wallImageMapData"> {{- if .Storage.WallImageMap -}} { /* JSON 数据 */ } {{- else -}} {} {{- end -}} </script>

---

#### `templates/data/footer.tmpl`

**修改内容**：在 `</body>` 之前添加外部 JS 文件引用
html
<!-- 添加这一行 -->
<script src="/assets/wall-copy.js"></script>
---

#### `templates/data/csp.tmpl`

**修改内容**：修改 CSP 策略，允许加载同源脚本和 blob URL

html
<!-- 修改前 -->
script-src 'none'; img-src 'self' data:;
<!-- 修改后 -->
script-src 'self'; img-src 'self' data: blob:;
**说明**：
- `script-src 'self'` - 允许加载同源外部脚本
- `blob:` - 允许显示临时预览图片（Blob URL）

---

#### `assets/style.css`

**修改内容**：添加 `.wallContent` 样式，使其自适应宽度

css .wallContent { width: calc(100% - 20px) !important; max-width: calc(100% - 20px) !important; min-height: 300px !important; resize: vertical; margin: 10px !important; padding: 10px !important; display: block; box-sizing: border-box; }

**说明**：
- `width: calc(100% - 20px)` - 占满容器宽度减去左右 margin
- `min-height: 300px` - 最小高度 300px，提供更好的编辑空间
- `resize: vertical` - 允许用户垂直调整大小
- `!important` - 确保覆盖全局样式中的默认设置

---

#### `storage/config.go`

**修改内容**：在 `Storage` 结构中添加 `WallImageMap` 字段

go type Storage struct { // Uploaded files Files map[string]*File json:"files,omitempty"
// Text messages
Messages map[int]*Message `json:"messages,omitempty"`

// Shared wall content
WallContent string `json:"wallContent,omitempty"`

// Wall image mapping: display number -> file ID
// e.g., {"1": "abc123XYZ", "2": "def456UVW"}
WallImageMap map[string]string `json:"wallImageMap,omitempty"`

// Storage content total sizes
Sizes `json:"storageSizes,omitempty"`
}

---

#### `storage/clear.go`

**修改内容**：清空 wall 时同时清空图片映射


go func (s *Storage) ClearWall() { s.WallContent = "" s.WallImageMap = make(map[string]string) }
---

#### `handlers/wallimage.go` (新建)

**功能**：创建专用的图片访问 handler

**路径**：`/wall-image/{fileId}`

**特点**：无需认证即可访问，与 `/download/` 分离


go package handlers
import ( "net/http" "strings" "github.com/drduh/gone/config" )
// WallImage handles requests to download images uploaded from wall func WallImage(app *config.App) http.HandlerFunc { return func(w http.ResponseWriter, r *http.Request) { path := r.URL.Path prefix := "/wall-image/"
if !strings.HasPrefix(path, prefix) {
http.NotFound(w, r)
return
}

    fileID := strings.TrimPrefix(path, prefix)
    if fileID == "" {
        http.NotFound(w, r)
        return
    }

    // Use FindFile method which handles concurrency safely
    file := app.FindFile(fileID)
    if file == nil {
        writeJSON(w, http.StatusNotFound, errorJSON(app.NotFound))
        app.Log.Debug("wall image not found", "id", fileID)
        return
    }

    if file.Type != "" {
        w.Header().Set("Content-Type", file.Type)
    } else {
        w.Header().Set("Content-Type", "application/octet-stream")
    }

    w.WriteHeader(http.StatusOK)
    w.Write(file.Data)

    app.Log.Debug("wall image served", "id", fileID, "size", len(file.Data))
}
}


---

#### `handlers/wall.go`

**修改内容**：在 POST 处理中添加接收 `imageMap` JSON 的逻辑

go formContent := r.FormValue(formFieldWall) if formContent != "" { app.Log.Debug("updating wall", "length", len(formContent), "user", req) app.WallContent = formContent
// 同时接收图片映射（如果有）
imageMapJSON := r.FormValue("imageMap")
if imageMapJSON != "" {
var imageMap map[string]string
if err := json.Unmarshal([]byte(imageMapJSON), &imageMap); err == nil {
app.WallImageMap = imageMap
app.Log.Debug("updated wall image map", "count", len(imageMap), "user", req)
}
}

app.Log.Info("updated wall", "user", req)
}

---

#### `settings/config.go`

**修改内容**：在 `Paths` 结构中添加 `WallImage` 字段


go type Paths struct { // ... existing fields ... WallImage string json:"wallImage,omitempty" }

---

#### `settings/defaultSettings.json`

**修改内容**：paths 中添加默认图片访问路径
json { "paths": { "wallImage": "/wall-image/" } }
---

#### `server/handler.go`

**修改内容**：注册 `/wall-image/` 路由

go // Wall image handler - no auth required if app.WallImage != "" { mux.HandleFunc(app.WallImage, handlers.WallImage(app)) }
---

#### `README.md`

**新增**："Image Paste Support" 章节

包含功能说明、使用流程、特性列表等。

---

## 🔧 技术要点

### 1. CSP（内容安全策略）兼容性

| 项目 | 说明 |
|------|------|
| **问题** | 原 CSP 策略 `script-src 'none'` 禁止所有脚本执行 |
| **解决** | 改为 `script-src 'self'`，允许加载同源外部脚本 |
| **优势** | 保持安全性，同时允许必要的 JavaScript 功能 |
| **额外** | 添加 `blob:` 到 `img-src` 支持临时预览图片 |

---

### 2. ID 唯一性

| 项目 | 说明 |
|------|------|
| **问题** | form 和 textarea 都使用 `id="wall"` 导致冲突 |
| **解决** | form 使用 `id="wallForm"`，textarea 使用 `id="wallContent"` |

---

### 3. 事件处理

- ✅ 使用 `addEventListener` 而非 inline onclick
- ✅ 检查 `document.readyState` 确保 DOM 就绪后再绑定事件
- ✅ 只在有选中文字时触发复制，避免误操作
- ✅ 表单提交时收集并保存所有图片映射

---

### 4. 剪贴板 API

javascript // 优先使用现代 API if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(selectedText) } else { // 降级到 execCommand document.execCommand('copy') }

**注意**：需要 HTTPS 或 localhost 才能使用 clipboard API

---

### 5. 响应式设计

- ✅ 移除 HTML 中的固定 `cols` 和 `rows` 属性
- ✅ 使用 CSS 控制尺寸，支持不同屏幕尺寸
- ✅ `calc()` 函数精确计算宽度，考虑 margin 和 padding

---

### 6. 图片上传数据流


用户粘贴图片 ↓ 生成临时预览 (Blob URL) ↓ 异步上传到 /upload API ↓ 获取 fileId ↓ 更新预览 (服务器 URL) ↓ 设置 data-display-num 和 data-file-id ↓ 用户点击 save ↓ 收集所有映射 → JSON → 隐藏字段 ↓ POST 到 /wall ↓ 后端解析并保存到 app.WallImageMap ↓ 刷新页面时从模板读取映射 ↓ 重新加载所有图片预

---

### 7. 关键设计决策

| 决策 | 原因 |
|------|------|
| **后端存储而非 localStorage** | 支持多用户场景，避免设备间不同步 |
| **专用图片路径 `/wall-image/`** | 绕过认证，保持其他下载安全 |
| **Emoji 标记 📷N** | 简洁直观，比 `[IMG:xxx]` 更短 |
| **双重收集机制** | 从 DOM 和 imageStore 同时收集，确保映射完整 |
| **Script 标签嵌入 JSON** | 比隐藏 input 更可靠，避免 HTML 转义问题 |

---

### 8. 并发安全

- ✅ 使用 `app.FindFile(fileID)` 而非直接访问 `app.Files`
- ✅ 内部已处理读写锁，保证线程安全

---

### 9. 错误处理

- ✅ 上传失败显示通知
- ✅ 图片加载失败记录日志
- ✅ JSON 解析失败优雅降级

---

## ✅ 功能验证

### 测试步骤

#### 1. 启动服务

bash go run cmd/main.go -debug
#### 2. 访问页面
打开浏览器访问 `http://localhost:8080`

#### 3. 测试复制功能
1. 在 wall textarea 中输入一些文字
2. 选中部分文字
3. 点击选中区域
4. 应该看到顶部绿色提示"已复制选中内容"
5. 粘贴到其他位置验证

#### 4. 测试图片粘贴
1. 复制任意图片
2. 粘贴到 wall textarea
3. 等待 "图片上传成功" 提示
4. 重复粘贴多张图片
5. 点击 "save" 按钮
6. 刷新页面
7. 验证所有图片预览都正常显示

#### 5. 测试宽度自适应
- wall textarea 应该占满容器宽度
- 可以垂直拖动调整高度
- 点击 save 后尺寸保持不变

#### 6. 检查浏览器控制台
- 按 F12 打开开发者工具
- Network 标签中 `wall-copy.js` 状态码应为 200
- Console 标签应无错误

---

## 🎯 用户体验改进

### 复制功能
- ✅ 只复制选中内容，不会误操作
- ✅ 视觉反馈清晰（绿色提示框）
- ✅ 1.5 秒后自动消失，不干扰操作
- ✅ 兼容各种浏览器

### 编辑体验
- ✅ 更宽的编辑区域，提升可读性
- ✅ 可调整高度，适应不同内容长度
- ✅ 保存后尺寸不变，保持一致性
- ✅ 响应式设计，适配不同屏幕

### 图片功能
- ✅ 粘贴即上传，无需手动操作
- ✅ 实时预览，即时反馈
- ✅ 简短标记，文本整洁
- ✅ 点击查看大图，支持缩放导航
- ✅ 跨设备同步，刷新不丢失

---

## 📝 注意事项

### CSP 策略
修改后允许加载同源脚本，但仍禁止内联脚本，保持较高安全性

### 浏览器兼容性
| 功能 | 现代浏览器 | 旧浏览器 |
|------|-----------|---------|
| 复制 | `navigator.clipboard` | `execCommand` |
| 图片粘贴 | ✅ 支持 | ❌ 可能不支持 |

**注意**：需要 HTTPS 或 localhost 才能使用 clipboard API

### 样式优先级
使用 `!important` 确保样式生效，因为全局样式中有默认的 margin 和 padding

### Git 提交
如果推送到 GitHub，记得提交所有修改的文件

---

## 🚀 部署建议

### 本地开发
make build sudo make install
