// wall-drawing.js - 涂鸦绘制功能
(function() {
    'use strict';

    const State = window.WallState;
    const Utils = window.WallUtils;

    window.WallDrawing = {
        setupToolsWithoutInit: function(modal) {
            const colorPicker = modal.querySelector('.color-picker');
            const brushSize = modal.querySelector('.brush-size');
            const opacitySlider = modal.querySelector('.opacity-slider');
            const opacityValue = modal.querySelector('.opacity-value');
            const undoBtn = modal.querySelector('.draw-undo');
            const redoBtn = modal.querySelector('.draw-redo');
            const clearBtn = modal.querySelector('.draw-clear');
            const downloadBtn = modal.querySelector('.download-annotated');
            
            const self = this;
            
            // 工具切换
            const toolButtons = modal.querySelectorAll('[data-tool]');
            toolButtons.forEach(function(btn) {
                btn.onclick = function() {
                    toolButtons.forEach(function(b) { b.classList.remove('active'); });
                    this.classList.add('active');
                    State.currentTool = this.dataset.tool;
                    State.isDrawingMode = true;
                    
                    const cursorMap = {
                        'hand': 'grab',
                        'select': 'default',
                        'text': 'text',
                        'eraser': 'cell'
                    };
                    const cursor = cursorMap[State.currentTool] || 'crosshair';
                    self.updateAllCursors(cursor);
                    self.enableAllCanvases();
                };
            });

            colorPicker.onchange = function() {
                State.drawColor = this.value;
            };

            brushSize.oninput = function() {
                State.drawWidth = parseInt(this.value);
            };

            opacitySlider.oninput = function() {
                State.drawOpacity = parseFloat(this.value);
                if (opacityValue) {
                    opacityValue.textContent = Math.round(State.drawOpacity * 100) + '%';
                }
                console.log('透明度已更新:', State.drawOpacity);
            };

            undoBtn.onclick = function() {
                const history = State.drawingHistory[State.activeCanvasIndex];
                if (history && history.length > 0) {
                    if (!State.redoHistory[State.activeCanvasIndex]) {
                        State.redoHistory[State.activeCanvasIndex] = [];
                    }
                    State.redoHistory[State.activeCanvasIndex].push(history.pop());
                    self.restoreCanvas();
                }
            };

            redoBtn.onclick = function() {
                const redo = State.redoHistory[State.activeCanvasIndex];
                if (redo && redo.length > 0) {
                    State.drawingHistory[State.activeCanvasIndex].push(redo.pop());
                    self.restoreCanvas();
                }
            };

            clearBtn.onclick = function() {
                const canvas = State.layerCanvases[State.activeCanvasIndex];
                if (canvas && canvas.ctx) {
                    self.saveState();
                    canvas.ctx.clearRect(0, 0, canvas.width, canvas.height);
                }
            };

            downloadBtn.onclick = function() {
                self.downloadAnnotated();
            };

            // 注意：不调用initLayers，等待图片加载完成
        },

        setupTools: function(modal) {
            this.setupToolsWithoutInit(modal);
            // 为了兼容性，仍然保留原方法
        },

        initLayers: function(modal) {
            const container = modal.querySelector('.layers-container');
            if (!container) {
                console.error('layers-container not found');
                return;
            }

            console.log('initLayers called, container children:', container.children.length);

            // 关键修复：只清除Canvas，不清除图片
            const oldCanvases = container.querySelectorAll('.annotation-layer');
            oldCanvases.forEach(canvas => canvas.remove());
            
            State.layerCanvases = [];
            State.drawingHistory = [[]];
            State.redoHistory = [[]];

            const layer = this.createLayer(modal, 0);
            if (layer) {
                State.layerCanvases[0] = layer;
                this.bindCanvasEvents(layer.canvas, 0);
                console.log('Layer 0 created successfully:', layer);
            } else {
                console.error('Failed to create layer 0');
            }
        },

        createLayer: function(modal, layerIndex) {
            const layersContainer = modal.querySelector('.layers-container');
            if (!layersContainer) {
                console.error('layers-container not found in createLayer');
                return null;
            }

            // 关键修复：直接从layers-container查找图片
            const img = layersContainer.querySelector('.modal-image');
            if (!img) {
                console.error('modal-image not found in layers-container');
                console.log('layers-container children count:', layersContainer.children.length);
                for (let i = 0; i < layersContainer.children.length; i++) {
                    console.log('Child', i, ':', layersContainer.children[i].className, layersContainer.children[i].tagName);
                }
                return null;
            }
            
            if (!img.complete || !img.naturalWidth) {
                console.error('modal-image not loaded or has no natural width');
                console.log('img.complete:', img.complete, 'img.naturalWidth:', img.naturalWidth);
                return null;
            }

            const canvas = document.createElement('canvas');
            canvas.className = 'annotation-layer';
            canvas.style.position = 'absolute';
            canvas.style.top = '0';
            canvas.style.left = '0';
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            canvas.style.pointerEvents = 'auto';
            canvas.style.zIndex = layerIndex;
            canvas.style.cursor = 'crosshair';

            console.log('Image natural size:', img.naturalWidth, 'x', img.naturalHeight);

            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;

            layersContainer.appendChild(canvas);

            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            
            console.log('Canvas created:', canvas.width, 'x', canvas.height);

            return {
                canvas: canvas,
                ctx: ctx,
                index: layerIndex,
                element: canvas
            };
        },

        bindCanvasEvents: function(canvas, layerIndex) {
            let startX = 0;
            let startY = 0;
            let tempCanvas = null;
            let tempCtx = null;
            const self = this;
            
            // 用于直线画笔的快照
            let brushSnapshot = null;

            // 获取图片引用（从layers-container内部）
            const img = canvas.parentElement.querySelector('.modal-image');

            canvas.addEventListener('mousedown', function(e) {
                if (!State.isDrawingMode || layerIndex !== State.activeCanvasIndex) return;

                // 关键修复：直接使用鼠标相对于canvas的位置，考虑缩放
                const rect = canvas.getBoundingClientRect();
                
                console.log('=== MouseDown 调试 ===');
                console.log('屏幕坐标:', e.clientX, e.clientY);
                console.log('Canvas rect:', rect);
                console.log('Canvas 原始尺寸:', canvas.width, 'x', canvas.height);
                console.log('Canvas 显示尺寸:', rect.width, 'x', rect.height);
                console.log('State.scale:', State.currentScale);
                console.log('State.translate:', State.translateX, State.translateY);
                
                // 计算鼠标在canvas显示区域内的相对位置（0-1之间）
                const relativeX = (e.clientX - rect.left) / rect.width;
                const relativeY = (e.clientY - rect.top) / rect.height;
                
                console.log('相对位置:', relativeX.toFixed(4), relativeY.toFixed(4));
                
                // 转换为原始图片坐标
                startX = relativeX * canvas.width;
                startY = relativeY * canvas.height;

                console.log('计算的原始坐标:', startX.toFixed(2), startY.toFixed(2));
                console.log('==================');

                if (State.currentTool === 'text') {
                    window.WallText.showInput(e.clientX, e.clientY);
                } else if (['arrow', 'rect', 'circle'].includes(State.currentTool)) {
                    tempCanvas = document.createElement('canvas');
                    tempCanvas.width = canvas.width;
                    tempCanvas.height = canvas.height;
                    tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
                    tempCtx.drawImage(canvas, 0, 0);
                    State.isDrawing = true;
                } else if (State.currentTool === 'brush') {
                    State.isDrawing = true;
                    self.saveState();

                    const ctx = State.layerCanvases[layerIndex].ctx;
                    ctx.beginPath();
                    ctx.moveTo(startX, startY);
                } else if (State.currentTool === 'straight-line') {
                    State.isDrawing = true;
                    self.saveState();
                    
                    const ctx = State.layerCanvases[layerIndex].ctx;
                    brushSnapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
                } else if (State.currentTool === 'eraser') {
                    State.isDrawing = true;
                    self.saveState();

                    const ctx = State.layerCanvases[layerIndex].ctx;
                    ctx.beginPath();
                    ctx.moveTo(startX, startY);
                }
            });

            canvas.addEventListener('mousemove', function(e) {
                if (!State.isDrawing || !State.isDrawingMode || layerIndex !== State.activeCanvasIndex) return;

                // 关键修复：直接使用鼠标相对于canvas的位置
                const rect = canvas.getBoundingClientRect();
                
                // 计算鼠标在canvas显示区域内的相对位置（0-1之间）
                const relativeX = (e.clientX - rect.left) / rect.width;
                const relativeY = (e.clientY - rect.top) / rect.height;
                
                // 转换为原始图片坐标
                const x = relativeX * canvas.width;
                const y = relativeY * canvas.height;

                const ctx = State.layerCanvases[layerIndex].ctx;

                if (State.currentTool === 'brush') {
                    // 普通画笔：连续曲线，透明度均匀
                    ctx.strokeStyle = State.drawColor;
                    ctx.lineWidth = State.drawWidth;
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    ctx.globalAlpha = parseFloat(State.drawOpacity) || 1;
                    ctx.lineTo(x, y);
                    ctx.stroke();
                } else if (State.currentTool === 'straight-line') {
                    // 直线画笔：恢复快照后绘制直线
                    if (brushSnapshot) {
                        ctx.putImageData(brushSnapshot, 0, 0);
                    }
                    
                    ctx.beginPath();
                    ctx.moveTo(startX, startY);
                    ctx.strokeStyle = State.drawColor;
                    ctx.lineWidth = State.drawWidth;
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    ctx.globalAlpha = parseFloat(State.drawOpacity) || 1;
                    ctx.lineTo(x, y);
                    ctx.stroke();
                    ctx.globalAlpha = 1;
                } else if (State.currentTool === 'eraser') {
                    ctx.globalCompositeOperation = 'destination-out';
                    ctx.lineWidth = State.drawWidth * 5;
                    ctx.lineCap = 'round';
                    ctx.lineTo(x, y);
                    ctx.stroke();
                    ctx.globalCompositeOperation = 'source-over';
                } else if (['arrow', 'rect', 'circle'].includes(State.currentTool)) {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.putImageData(tempCtx.getImageData(0, 0, canvas.width, canvas.height), 0, 0);

                    ctx.strokeStyle = State.drawColor;
                    ctx.lineWidth = State.drawWidth;
                    ctx.globalAlpha = parseFloat(State.drawOpacity) || 1;

                    if (State.currentTool === 'arrow') {
                        self.drawArrow(ctx, startX, startY, x, y);
                    } else if (State.currentTool === 'rect') {
                        ctx.strokeRect(startX, startY, x - startX, y - startY);
                    } else if (State.currentTool === 'circle') {
                        const radius = Math.sqrt(Math.pow(x - startX, 2) + Math.pow(y - startY, 2));
                        ctx.beginPath();
                        ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
                        ctx.stroke();
                    }
                    
                    ctx.globalAlpha = 1;
                }
            });

            canvas.addEventListener('mouseup', function(e) {
                if (!State.isDrawing || layerIndex !== State.activeCanvasIndex) return;
                State.isDrawing = false;

                if (State.currentTool === 'brush' || State.currentTool === 'eraser') {
                    const ctx = State.layerCanvases[layerIndex].ctx;
                    ctx.globalAlpha = 1;
                    ctx.beginPath();
                }
                
                if (State.currentTool === 'straight-line') {
                    const ctx = State.layerCanvases[layerIndex].ctx;
                    ctx.globalAlpha = 1;
                    ctx.beginPath();
                    brushSnapshot = null;
                }
                
                self.saveState();

                if (['arrow', 'rect', 'circle'].includes(State.currentTool)) {
                    // 关键修复：使用相同方法计算终点坐标
                    const rect = canvas.getBoundingClientRect();
                    const relativeX = (e.clientX - rect.left) / rect.width;
                    const relativeY = (e.clientY - rect.top) / rect.height;
                    const endX = relativeX * canvas.width;
                    const endY = relativeY * canvas.height;

                    State.shapeAnnotations.push({
                        layer: layerIndex,
                        type: State.currentTool,
                        start: { x: startX, y: startY },
                        end: { x: endX, y: endY },
                        color: State.drawColor,
                        width: State.drawWidth
                    });
                }
            });

            canvas.addEventListener('mouseout', function() {
                if (State.isDrawing) {
                    if (State.currentTool === 'brush' || State.currentTool === 'eraser') {
                        const ctx = State.layerCanvases[layerIndex].ctx;
                        ctx.globalAlpha = 1;
                        ctx.beginPath();
                    }
                    if (State.currentTool === 'straight-line') {
                        brushSnapshot = null;
                    }
                }
                State.isDrawing = false;
            });
        },

        drawArrow: function(ctx, fromX, fromY, toX, toY) {
            const headLength = 15;
            const angle = Math.atan2(toY - fromY, toX - fromX);
            
            ctx.beginPath();
            ctx.moveTo(fromX, fromY);
            ctx.lineTo(toX, toY);
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(toX, toY);
            ctx.lineTo(toX - headLength * Math.cos(angle - Math.PI / 6), 
                      toY - headLength * Math.sin(angle - Math.PI / 6));
            ctx.lineTo(toX - headLength * Math.cos(angle + Math.PI / 6), 
                      toY - headLength * Math.sin(angle + Math.PI / 6));
            ctx.closePath();
            ctx.fillStyle = State.drawColor;
            ctx.fill();
        },

        saveState: function() {
            if (!State.drawingHistory[State.activeCanvasIndex]) {
                State.drawingHistory[State.activeCanvasIndex] = [];
            }

            const canvas = State.layerCanvases[State.activeCanvasIndex];
            if (canvas && canvas.element) {
                State.drawingHistory[State.activeCanvasIndex].push(canvas.element.toDataURL());
                State.redoHistory[State.activeCanvasIndex] = [];
            }
        },

        restoreCanvas: function() {
            const canvas = State.layerCanvases[State.activeCanvasIndex];
            if (!canvas || !canvas.element) return;

            const history = State.drawingHistory[State.activeCanvasIndex];
            if (!history || history.length === 0) return;

            const img = new Image();
            const self = this;
            img.onload = function() {
                canvas.ctx.clearRect(0, 0, canvas.element.width, canvas.element.height);
                canvas.ctx.drawImage(img, 0, 0);
                if (window.refreshTextAnnotations) {
                    window.refreshTextAnnotations();
                }
            };
            img.src = history[history.length - 1];
        },

        updateAllCursors: function(cursorType) {
            State.layerCanvases.forEach(layer => {
                if (layer && layer.element) {
                    layer.element.style.cursor = cursorType;
                }
            });
        },

        enableAllCanvases: function() {
            State.layerCanvases.forEach((layer, index) => {
                if (layer && layer.element) {
                    layer.element.style.pointerEvents = index === State.activeCanvasIndex ? 'auto' : 'none';
                }
            });
        },

        downloadAnnotated: function() {
            const modal = document.getElementById('imageModal');
            if (!modal) return;
            
            const img = modal.querySelector('.modal-image');
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = img.naturalWidth;
            tempCanvas.height = img.naturalHeight;
            const ctx = tempCanvas.getContext('2d');
            
            ctx.drawImage(img, 0, 0);
            
            State.layerCanvases.forEach((layer, index) => {
                if (layer && layer.element && State.layers[index].visible) {
                    ctx.drawImage(layer.element, 0, 0);
                }
            });

            const link = document.createElement('a');
            link.download = 'annotated-image-' + Date.now() + '.png';
            link.href = tempCanvas.toDataURL('image/png');
            link.click();
            
            Utils.showNotification('图片已下载');
        }
    };
})();
